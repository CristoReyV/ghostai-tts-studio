/**
 * @file src/services/zipBuilder.ts
 * Generates the GhostAI-compatible .ghostai-tts-package.zip file.
 * Uses JSZip directly with Blobs for maximum performance and zero base64 overhead.
 */

import JSZip from "jszip";
import type { GhostAiTtsProject, OutputPackageManifest, StudioNarrationItem } from "../types/tts";
import { getGatewayBaseUrl } from "./gateway";

export interface BuildZipOptions {
  project: GhostAiTtsProject;
  items: StudioNarrationItem[];
  includeOnlyReady?: boolean;
}

export interface ZipBuildResult {
  blob: Blob;
  fileName: string;
  itemCount: number;
}

/**
 * Builds the ghostai-tts-package.zip archive containing manifest.json and audio/narration_XXX.mp3
 */
export async function buildGhostAiTtsPackage(options: BuildZipOptions): Promise<ZipBuildResult> {
  const zip = new JSZip();
  const readyItems = options.includeOnlyReady !== false
    ? options.items.filter((item) => item.status === "READY" && item.audioBlob)
    : options.items.filter((item) => item.audioBlob);

  if (readyItems.length === 0) {
    throw new Error("No hay narraciones generadas listas para empaquetar.");
  }

  const audioFolder = zip.folder("audio");
  if (!audioFolder) {
    throw new Error("Error interno al inicializar la carpeta del ZIP.");
  }

  const gatewayUrl = getGatewayBaseUrl();
  let gatewayHost = "tts-test.smartbrain.lat";
  try {
    gatewayHost = new URL(gatewayUrl).host;
  } catch (_) {}

  // Format manifest items with all original metadata preserved
  const manifestItems = readyItems.map((item, index) => {
    const pad = String(index + 1).padStart(3, "0");
    const extension = item.outputFormat?.startsWith("pcm") ? "wav" : "mp3";
    const relativeFileName = `audio/narration_${pad}.${extension}`;
    const pureFileName = `narration_${pad}.${extension}`;

    // Add audio binary blob directly into audio/
    if (item.audioBlob) {
      audioFolder.file(pureFileName, item.audioBlob);
    }

    // Clone item properties to preserve any custom properties
    const {
      status,
      audioBlob,
      audioUrl,
      error,
      responseBytes,
      duration,
      requestId,
      narrationId,
      ...originalProps
    } = item;

    return {
      ...originalProps,
      id: item.id,
      sceneId: item.sceneId,
      sceneIndex: item.sceneIndex,
      file: relativeFileName,
      voiceId: item.voiceId || "default",
      modelId: item.modelId || "eleven_multilingual_v2",
      duration: duration || 0,
      requestId: requestId || "",
    };
  });

  const manifest: OutputPackageManifest = {
    format: "ghostai-tts-package",
    version: "1.0",
    project: options.project,
    generatedWith: {
      provider: "elevenlabs",
      gateway: gatewayHost,
    },
    items: manifestItems,
  };

  // Add manifest.json at root of ZIP
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Generate binary ZIP Blob
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const projectNameClean = (options.project.name || "ghostai")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  const fileName = `${projectNameClean}-tts-package.zip`;

  return {
    blob,
    fileName,
    itemCount: readyItems.length,
  };
}

/**
 * Triggers a browser download of a given Blob.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
