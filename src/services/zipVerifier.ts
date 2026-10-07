/**
 * @file src/services/zipVerifier.ts
 * Client-side verification service for GhostAI TTS ZIP packages.
 * Validates manifest structure, audio files, MP3 header signatures,
 * and cryptographic SHA-256 checksums against Recovery Vault sessions.
 */

import JSZip from "jszip";
import type { ZipVerificationResult } from "../types/tts";
import { TtsErrorCode } from "../utils/errors";

export interface ExpectedSessionVerification {
  itemCount?: number;
  items?: Array<{
    narrationId: string;
    sceneId?: string | null;
    sceneIndex?: number | null;
    sha256?: string | null;
  }>;
}

/**
 * Computes SHA-256 hex string in the browser using Web Crypto API.
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digestBuffer = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates basic audio header signature (ID3 or MPEG Frame Sync for MP3, or RIFF for WAV).
 */
function isValidAudioHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;

  // 1. ID3v2 container: "ID3" (0x49, 0x44, 0x33)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return true;
  }

  // 2. MPEG frame sync: 11 bits set (0xFF followed by >= 0xE0)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return true;
  }

  // 3. RIFF (WAV) format
  if (
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46    // 'F'
  ) {
    return true;
  }

  return false;
}

/**
 * Verifies a downloaded .ghostai-tts-package.zip archive selected manually by user.
 *
 * @param file - File or Blob selected from <input type="file">
 * @param expectedSession - Optional expected session data for strong cryptographic verification
 */
export async function verifyGhostAiTtsZip(
  file: File | Blob,
  expectedSession?: ExpectedSessionVerification
): Promise<ZipVerificationResult> {
  const fileName = (file as File).name || "package.zip";

  // 1. Load ZIP
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (_err) {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: "El archivo seleccionado no es un archivo ZIP válido o está dañado.",
    };
  }

  // 2. Check manifest.json exists
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: "El paquete ZIP no contiene el archivo obligatorio 'manifest.json'.",
    };
  }

  // 3. Parse manifest.json
  let manifestText: string;
  try {
    manifestText = await manifestFile.async("text");
  } catch (_err) {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: "No se pudo leer el contenido de 'manifest.json'.",
    };
  }

  let manifest: any;
  try {
    manifest = JSON.parse(manifestText);
  } catch (_err) {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: "El archivo 'manifest.json' contiene una estructura JSON inválida.",
    };
  }

  // 4. Contract: format === "ghostai-tts"
  if (manifest.format !== "ghostai-tts") {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: `Formato de paquete incompatible: '${manifest.format}'. Se esperaba 'ghostai-tts'.`,
    };
  }

  // 5. Contract: version === "1.0"
  if (manifest.version !== "1.0") {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: `Versión de paquete incompatible: '${manifest.version}'. Se esperaba '1.0'.`,
    };
  }

  // 6. Project metadata
  if (!manifest.project || typeof manifest.project !== "object" || !manifest.project.name) {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: "El manifest no contiene la metadata obligatoria del proyecto ('project.name').",
    };
  }

  // 7. Items array
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    return {
      ok: false,
      errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
      error: "El manifest no contiene ninguna narración en 'items'.",
    };
  }

  // 8. Expected count match if expectedSession provided
  if (expectedSession && typeof expectedSession.itemCount === "number") {
    if (manifest.items.length !== expectedSession.itemCount) {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: `Cantidad de narraciones inconsistente: el ZIP contiene ${manifest.items.length}, se esperaban ${expectedSession.itemCount}.`,
      };
    }
  }

  // 9. Inspect all items and their audio files
  const seenIds = new Set<string>();
  const expectedItemsMap = new Map<string, { sha256?: string | null; sceneId?: string | null }>();

  if (expectedSession?.items) {
    for (const exp of expectedSession.items) {
      expectedItemsMap.set(exp.narrationId, exp);
    }
  }

  let verifiedItemsCount = 0;

  for (const item of manifest.items) {
    const narrationId = item.id;
    if (!narrationId || typeof narrationId !== "string") {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: "Se encontró un elemento en manifest sin 'id' válido.",
      };
    }

    if (seenIds.has(narrationId)) {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: `Se detectaron IDs de narración duplicados en el manifest: '${narrationId}'.`,
      };
    }
    seenIds.add(narrationId);

    if (!item.file || typeof item.file !== "string") {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: `La narración '${narrationId}' no declara la ruta de archivo ('file').`,
      };
    }

    // Check audio file in zip
    const audioEntry = zip.file(item.file);
    if (!audioEntry) {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: `El archivo de audio declarado '${item.file}' falta dentro del archivo ZIP.`,
      };
    }

    const audioBytes = await audioEntry.async("uint8array");
    if (audioBytes.byteLength === 0) {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: `El archivo de audio '${item.file}' está vacío (0 bytes).`,
      };
    }

    // Verify audio header
    if (!isValidAudioHeader(audioBytes)) {
      return {
        ok: false,
        errorCode: TtsErrorCode.ZIP_VERIFICATION_FAILED,
        error: `El archivo '${item.file}' no contiene un encabezado válido de audio MP3 o WAV.`,
      };
    }

    // Check cryptographic hash against expected session if present
    const expected = expectedItemsMap.get(narrationId);
    if (expected?.sha256) {
      const actualHash = await computeSha256(audioBytes);
      if (actualHash.toLowerCase() !== expected.sha256.toLowerCase()) {
        return {
          ok: false,
          errorCode: TtsErrorCode.ZIP_INTEGRITY_MISMATCH,
          error: `Discrepancia de integridad SHA-256 en el audio '${item.file}'. El contenido del archivo no coincide con la generación original.`,
        };
      }
    }

    verifiedItemsCount++;
  }

  // 10. Compute Package SHA-256
  const fileArrayBuffer = await (file as Blob).arrayBuffer();
  const packageSha256 = await computeSha256(fileArrayBuffer);

  return {
    ok: true,
    details: {
      format: manifest.format,
      version: manifest.version,
      fileName,
      totalItems: manifest.items.length,
      verifiedItems: verifiedItemsCount,
      packageSha256,
      itemHashesMatch: true,
    },
  };
}
