/**
 * @file src/services/parser.ts
 * Schema validator and parser for .ghostai-tts.json export packages.
 * Includes input compatibility adapter for GhostAI Flow (project.title, narrations)
 * while preserving full compatibility with Studio legacy shape (project.name, items).
 */

import type { GhostAiTtsFile, GhostAiTtsItem, GhostAiVoiceSettings, StudioNarrationItem } from "../types/tts";

export interface ParseResult {
  success: boolean;
  data?: GhostAiTtsFile;
  studioItems?: StudioNarrationItem[];
  errors: string[];
}

/**
 * Validates and parses a raw JSON string or object as a GhostAI TTS export file.
 * Preserves all original metadata without modifying IDs, narrationIds, or sceneIds.
 * Supports dual input shapes:
 * - Studio canonical: project.name + items
 * - Flow exported: project.title + narrations
 */
export function parseGhostAiTtsJson(input: string | unknown): ParseResult {
  const errors: string[] = [];

  let parsed: unknown;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      return {
        success: false,
        errors: [`JSON inválido o malformado: ${(e as Error).message}`],
      };
    }
  } else {
    parsed = input;
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      success: false,
      errors: ["El archivo importado debe ser un objeto JSON válido."],
    };
  }

  const raw = parsed as Record<string, unknown>;

  // 1. Format check (Strict)
  if (raw.format !== "ghostai-tts") {
    errors.push(`Formato inválido: se esperaba 'format: "ghostai-tts"', pero se encontró '${String(raw.format)}'.`);
  }

  // 2. Version check (Strict)
  if (!raw.version || (typeof raw.version !== "string" && typeof raw.version !== "number") || String(raw.version).trim() !== "1.0") {
    errors.push("El campo 'version' es obligatorio y debe ser '1.0'.");
  }

  // 3. Project check with name | title support and conflict detection
  let canonicalProjectName = "";
  if (!raw.project || typeof raw.project !== "object") {
    errors.push("El campo 'project' es obligatorio y debe ser un objeto con información del proyecto.");
  } else {
    const project = raw.project as Record<string, unknown>;
    const rawName = typeof project.name === "string" ? project.name.trim() : "";
    const rawTitle = typeof project.title === "string" ? project.title.trim() : "";

    // Conflict detection if both are present
    if (rawName && rawTitle && rawName !== rawTitle) {
      errors.push("Conflicto en la información del proyecto: 'project.name' y 'project.title' tienen valores diferentes.");
    }

    canonicalProjectName = rawName || rawTitle;
    if (!canonicalProjectName) {
      errors.push("El campo 'project.name' o 'project.title' es obligatorio y debe contener el nombre del proyecto.");
    }
  }

  // 4. Collection check with items | narrations support and conflict detection
  const hasItems = Array.isArray(raw.items);
  const hasNarrations = Array.isArray(raw.narrations);

  let rawList: unknown[] | null = null;

  if (hasItems && hasNarrations) {
    const itemsArr = raw.items as unknown[];
    const narrArr = raw.narrations as unknown[];
    if (itemsArr.length !== narrArr.length) {
      errors.push("Contrato ambiguo: el archivo contiene 'items' y 'narrations' con cantidades diferentes.");
    } else {
      let hasConflict = false;
      for (let i = 0; i < itemsArr.length; i++) {
        const it1 = (itemsArr[i] || {}) as Record<string, unknown>;
        const it2 = (narrArr[i] || {}) as Record<string, unknown>;
        const id1 = typeof it1.id === "string" ? it1.id.trim() : typeof it1.narrationId === "string" ? it1.narrationId.trim() : "";
        const id2 = typeof it2.id === "string" ? it2.id.trim() : typeof it2.narrationId === "string" ? it2.narrationId.trim() : "";
        if (id1 !== id2 || it1.sceneId !== it2.sceneId || it1.text !== it2.text) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) {
        errors.push("Contrato ambiguo: el archivo contiene 'items' y 'narrations' con datos contradictorios.");
      }
    }
    rawList = itemsArr;
  } else if (hasItems) {
    rawList = raw.items as unknown[];
  } else if (hasNarrations) {
    rawList = raw.narrations as unknown[];
  } else {
    errors.push("El campo 'items' o 'narrations' es obligatorio y debe ser una lista de narraciones.");
  }

  if (rawList && rawList.length === 0) {
    errors.push("El paquete no contiene ninguna narración ('items' o 'narrations' está vacío).");
  }

  // 5. Individual items validation
  if (rawList && rawList.length > 0) {
    const seenIds = new Set<string>();

    rawList.forEach((item: unknown, index: number) => {
      const idx = index + 1;
      if (!item || typeof item !== "object") {
        errors.push(`Item #${idx}: Debe ser un objeto.`);
        return;
      }

      const it = item as Record<string, unknown>;

      // Determine canonical ID:
      // Priority 1: 'id'
      // Priority 2: 'narrationId' fallback
      const rawId = typeof it.id === "string" ? it.id.trim() : "";
      const rawNarrationId = typeof it.narrationId === "string" ? it.narrationId.trim() : "";
      const canonicalId = rawId || rawNarrationId;

      if (!canonicalId) {
        errors.push(`Item #${idx}: Falta el identificador único de la narración ('id' o 'narrationId').`);
      } else {
        if (seenIds.has(canonicalId)) {
          errors.push(`Item #${idx}: El ID '${canonicalId}' está duplicado en el paquete.`);
        }
        seenIds.add(canonicalId);
      }

      // Check sceneId (must be preserved exactly as received)
      if (!it.sceneId || typeof it.sceneId !== "string" || !it.sceneId.trim()) {
        errors.push(`Item #${idx} (ID: ${canonicalId || "desconocido"}): Falta el 'sceneId' de la escena de GhostAI.`);
      }

      // Check sceneIndex
      if (typeof it.sceneIndex !== "number") {
        errors.push(`Item #${idx} (ID: ${canonicalId || "desconocido"}): 'sceneIndex' debe ser un número entero.`);
      }

      // Check text
      if (typeof it.text !== "string" || !it.text.trim()) {
        errors.push(`Item #${idx} (ID: ${canonicalId || "desconocido"}): El 'text' no puede estar vacío.`);
      }

      // Validate speed if provided
      if (it.speed !== undefined && (typeof it.speed !== "number" || it.speed <= 0 || it.speed > 4)) {
        errors.push(`Item #${idx}: 'speed' debe ser un número entre 0.25 y 4.0.`);
      }
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  // 6. Normalize all items to canonical Studio model while preserving all original metadata
  const rawProject = raw.project as Record<string, unknown>;
  const normalizedProject = {
    ...rawProject,
    name: canonicalProjectName,
    title: typeof rawProject.title === "string" ? rawProject.title : canonicalProjectName,
    exportedAt: rawProject.exportedAt ? String(rawProject.exportedAt) : new Date().toISOString(),
  };

  const normalizedItems: GhostAiTtsItem[] = (rawList as Record<string, unknown>[]).map((rawItem) => {
    const rawId = typeof rawItem.id === "string" ? rawItem.id.trim() : "";
    const rawNarrationId = typeof rawItem.narrationId === "string" ? rawItem.narrationId.trim() : "";
    const canonicalId = rawId || rawNarrationId;

    // Handle voiceConfig adapter if present (Flow contract)
    let voiceId = typeof rawItem.voiceId === "string" ? rawItem.voiceId : undefined;
    let modelId = typeof rawItem.modelId === "string" ? rawItem.modelId : undefined;
    let speed = typeof rawItem.speed === "number" ? rawItem.speed : undefined;
    let voiceSettings = rawItem.voiceSettings as GhostAiVoiceSettings | undefined;

    if (rawItem.voiceConfig && typeof rawItem.voiceConfig === "object") {
      const vc = rawItem.voiceConfig as Record<string, unknown>;
      if (!voiceId && typeof vc.voiceId === "string") voiceId = vc.voiceId;
      if (!modelId && typeof vc.modelId === "string") modelId = vc.modelId;
      if (speed === undefined && typeof vc.speed === "number") speed = vc.speed;

      if (!voiceSettings && (vc.stability !== undefined || vc.clarity !== undefined || vc.speed !== undefined)) {
        voiceSettings = {
          stability: typeof vc.stability === "number" ? vc.stability : 0.5,
          similarityBoost: typeof vc.clarity === "number" ? vc.clarity : typeof vc.similarityBoost === "number" ? vc.similarityBoost : 0.75,
          speed: typeof vc.speed === "number" ? vc.speed : (speed || 1),
          style: 0,
          useSpeakerBoost: true,
        };
      }
    }

    return {
      ...rawItem,
      id: canonicalId,
      narrationId: rawNarrationId || canonicalId,
      sceneId: rawItem.sceneId as string,
      sceneIndex: rawItem.sceneIndex as number,
      text: rawItem.text as string,
      voiceId,
      modelId,
      speed,
      voiceSettings,
    };
  });

  const validFile: GhostAiTtsFile = {
    ...(raw as Record<string, unknown>),
    format: "ghostai-tts",
    version: String(raw.version),
    project: normalizedProject,
    items: normalizedItems,
  };

  // Convert to StudioNarrationItems with initial status PENDING
  const studioItems: StudioNarrationItem[] = normalizedItems.map((item: GhostAiTtsItem) => ({
    ...item,
    status: "PENDING",
  }));

  return {
    success: true,
    data: validFile,
    studioItems,
    errors: [],
  };
}
