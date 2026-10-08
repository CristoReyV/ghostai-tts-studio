/**
 * @file src/utils/environment.ts
 * Utilities for runtime browsing context detection, bridge pairing, and filename sanitization.
 * Enforces secure cross-window communication between sandboxed frames and download receivers.
 */

export interface FrameAuditInfo {
  isEmbedded: boolean;
  isTopLevel: boolean;
  referrer: string;
  hasFrameElement: boolean;
  frameElementTag: string | null;
  sandboxAttribute: string | null;
}

/**
 * Returns true if the current window is executing inside an iframe or embedded browsing context.
 * Detects cross-origin frame access restrictions safely.
 */
export function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.top !== window.self;
  } catch (_err) {
    // A SecurityError thrown when accessing window.top indicates a cross-origin iframe context
    return true;
  }
}

/**
 * Retrieves non-sensitive diagnostic info about the current frame hierarchy.
 */
export function getFrameAuditInfo(): FrameAuditInfo {
  const embedded = isEmbeddedFrame();
  let hasFrame = false;
  let tag: string | null = null;
  let sandbox: string | null = null;

  if (typeof window !== "undefined") {
    try {
      if (window.frameElement) {
        hasFrame = true;
        tag = window.frameElement.tagName;
        sandbox = window.frameElement.getAttribute("sandbox");
      }
    } catch (_err) {
      // Cross-origin restriction prevents reading window.frameElement
    }
  }

  return {
    isEmbedded: embedded,
    isTopLevel: !embedded,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    hasFrameElement: hasFrame,
    frameElementTag: tag,
    sandboxAttribute: sandbox,
  };
}

/**
 * Checks whether the current window was opened specifically in receiver mode for a ZIP download.
 */
export function isDownloadReceiverMode(): boolean {
  if (typeof window === "undefined" || !window.location) {
    return false;
  }
  try {
    return window.location.search.includes("mode=receiver") || window.location.search.includes("mode=download-receiver");
  } catch {
    return false;
  }
}

/**
 * Checks whether the current window is in GhostAI Admin mode (?mode=admin).
 */
export function isAdminMode(): boolean {
  if (typeof window === "undefined" || !window.location) {
    return false;
  }
  try {
    return window.location.search.includes("mode=admin");
  } catch {
    return false;
  }
}


/**
 * Extracts ephemeral bridge pairing ID from current URL query parameters.
 */
export function getBridgeIdFromUrl(): string | null {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("bridge");
  } catch {
    return null;
  }
}

/**
 * Generates an ephemeral cryptographically random channel ID for pairing windows.
 */
export function generateBridgeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bridge_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Sanitizes a filename to prevent path traversal and control character vulnerabilities.
 * Strictly preserves the .zip extension and valid project naming.
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== "string") {
    return "ghostai-tts-package.zip";
  }

  // 1. Extract basename and filter out path traversal segments
  const segments = fileName
    .split(/[/\\]+/)
    .filter((s) => s.trim().length > 0 && s !== ".." && s !== ".");
  let clean = segments.pop() || "ghostai-tts-package";

  // 2. Remove control characters and duplicate dots
  clean = clean
    .replace(/\.\.+/g, ".")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "")
    .trim()
    .replace(/^[.\s_]+|[.\s_]+$/g, "");

  if (!clean) {
    clean = "ghostai-tts-package";
  }

  // 3. Ensure .zip extension
  if (!clean.toLowerCase().endsWith(".zip")) {
    clean = `${clean}.zip`;
  }

  return clean;
}


/**
 * Protocol message types for safe cross-window ZIP transfer.
 */
export const GHOSTAI_MESSAGE_TYPES = {
  RECEIVER_READY: "GHOSTAI_RECEIVER_READY",
  ZIP_TRANSFER: "GHOSTAI_ZIP_TRANSFER",
  PAYLOAD_RECEIVED: "GHOSTAI_PAYLOAD_RECEIVED",
  DOWNLOAD_TRIGGERED: "GHOSTAI_DOWNLOAD_TRIGGERED",
} as const;

export interface GhostAiZipTransferPayload {
  blob: Blob;
  fileName: string;
  itemCount: number;
  projectName: string;
  bridgeId: string;
}
