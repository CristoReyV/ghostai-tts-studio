/**
 * @file src/utils/errors.ts
 * Central catalog of standardized TTS Error Codes and operational error sanitization.
 */

export const TtsErrorCode = {
  GHOSTAI_AUTH_INVALID: "GHOSTAI_AUTH_INVALID",
  GHOSTAI_CLIENT_SUSPENDED: "GHOSTAI_CLIENT_SUSPENDED",
  GHOSTAI_TOKEN_REVOKED: "GHOSTAI_TOKEN_REVOKED",
  ELEVENLABS_NOT_CONNECTED: "ELEVENLABS_NOT_CONNECTED",
  ELEVENLABS_AUTH_FAILED: "ELEVENLABS_AUTH_FAILED",
  ELEVENLABS_GENERATION_FAILED: "ELEVENLABS_GENERATION_FAILED",
  ELEVENLABS_RATE_LIMITED: "ELEVENLABS_RATE_LIMITED",
  RECOVERY_SESSION_CREATE_FAILED: "RECOVERY_SESSION_CREATE_FAILED",
  RECOVERY_STORAGE_FAILED: "RECOVERY_STORAGE_FAILED",
  RECOVERY_FETCH_FAILED: "RECOVERY_FETCH_FAILED",
  RECOVERY_EXPIRED: "RECOVERY_EXPIRED",
  ZIP_BUILD_FAILED: "ZIP_BUILD_FAILED",
  ZIP_TRANSFER_FAILED: "ZIP_TRANSFER_FAILED",
  POPUP_BLOCKED: "POPUP_BLOCKED",
  BRIDGE_TIMEOUT: "BRIDGE_TIMEOUT",
  RECEIVER_INHERITED_SANDBOX: "RECEIVER_INHERITED_SANDBOX",
  DOWNLOAD_TRIGGER_FAILED: "DOWNLOAD_TRIGGER_FAILED",
  ZIP_VERIFICATION_FAILED: "ZIP_VERIFICATION_FAILED",
  ZIP_INTEGRITY_MISMATCH: "ZIP_INTEGRITY_MISMATCH",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type TtsErrorCodeKey = keyof typeof TtsErrorCode;

/**
 * Sanitizes an error message by stripping out access keys, bearer tokens,
 * passwords, JWTs, and secret cookies.
 */
export function sanitizeOperationalError(err: unknown): string {
  if (!err) return "Error desconocido.";

  let raw = "";
  if (typeof err === "string") {
    raw = err;
  } else if (err instanceof Error) {
    raw = err.message;
  } else if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    raw = (obj.message as string) || (obj.error as string) || JSON.stringify(err);
  } else {
    raw = String(err);
  }

  const sanitized = raw
    .replace(/gai_live_[A-Za-z0-9_.-]+/g, "gai_live_[REDACTED]")
    .replace(/sk_[A-Za-z0-9_-]{20,}/g, "sk_[REDACTED]")
    .replace(/eyJh[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT_REDACTED]")
    .replace(/(?:Authorization|authorization):\s*(?:Bearer|Basic)\s+[^\s,;]+/gi, "Authorization: [REDACTED]")
    .replace(/(?:Bearer|bearer)\s+[A-Za-z0-9_.~+\/=-]{12,}/g, "Bearer [REDACTED]")
    .replace(/(?:key|token|secret|password|apiKey|api_key)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/(?:cookie|set-cookie):\s*[^;\r\n]+/gi, "Cookie: [REDACTED]");

  return sanitized.split("\n")[0].trim() || "Error operacional.";
}
