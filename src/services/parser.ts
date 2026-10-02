/**
 * @file src/services/parser.ts
 * Schema validator and parser for .ghostai-tts.json export packages.
 */

import type { GhostAiTtsFile, GhostAiTtsItem, StudioNarrationItem } from "../types/tts";

export interface ParseResult {
  success: boolean;
  data?: GhostAiTtsFile;
  studioItems?: StudioNarrationItem[];
  errors: string[];
}

/**
 * Validates and parses a raw JSON string or object as a GhostAI TTS export file.
 * Preserves all original metadata without modifying IDs or sceneIds.
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

  // 1. Format check
  if (raw.format !== "ghostai-tts") {
    errors.push(`Formato inválido: se esperaba 'format: "ghostai-tts"', pero se encontró '${String(raw.format)}'.`);
  }

  // 2. Version check
  if (!raw.version || (typeof raw.version !== "string" && typeof raw.version !== "number")) {
    errors.push("El campo 'version' es obligatorio y debe ser una cadena o número (ej: '1.0').");
  }

  // 3. Project check
  if (!raw.project || typeof raw.project !== "object") {
    errors.push("El campo 'project' es obligatorio y debe ser un objeto con información del proyecto.");
  } else {
    const project = raw.project as Record<string, unknown>;
    if (!project.name || typeof project.name !== "string" || !project.name.trim()) {
      errors.push("El campo 'project.name' es obligatorio.");
    }
  }

  // 4. Items array check
  if (!Array.isArray(raw.items)) {
    errors.push("El campo 'items' es obligatorio y debe ser una lista de narraciones.");
  } else if (raw.items.length === 0) {
    errors.push("El paquete no contiene ninguna narración ('items' está vacío).");
  } else {
    const seenIds = new Set<string>();

    raw.items.forEach((item: unknown, index: number) => {
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

  // Normalize all items to canonical 'id' while preserving exact sceneId and metadata
  const rawItems = raw.items as Record<string, unknown>[];
  const normalizedItems: GhostAiTtsItem[] = rawItems.map((rawItem) => {
    const rawId = typeof rawItem.id === "string" ? rawItem.id.trim() : "";
    const rawNarrationId = typeof rawItem.narrationId === "string" ? rawItem.narrationId.trim() : "";
    const canonicalId = rawId || rawNarrationId;

    return {
      ...rawItem,
      id: canonicalId,
      sceneId: rawItem.sceneId as string,
      sceneIndex: rawItem.sceneIndex as number,
      text: rawItem.text as string,
    };
  });

  const validFile: GhostAiTtsFile = {
    ...(parsed as GhostAiTtsFile),
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
