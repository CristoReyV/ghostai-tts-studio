/**
 * @file src/services/voicesDiagnostics.ts
 * Clasifica errores al consultar el catálogo de voces y arma un diagnóstico técnico SANITIZADO
 * (solo estado HTTP, código y requestId; nunca la API key, tokens ni cabeceras).
 */

export type VoicesErrorKind =
  | "auth"
  | "not_connected"
  | "key_invalid"
  | "permissions"
  | "forbidden"
  | "rate_limit"
  | "timeout"
  | "server"
  | "invalid_response"
  | "network"
  | "unknown";

export interface VoicesErrorInfo {
  kind: VoicesErrorKind;
  title: string;
  message: string;
  /** Línea técnica sanitizada para soporte. */
  diagnostic: string;
}

interface ErrLike {
  code?: string;
  statusCode?: number;
  requestId?: string;
}

const KEY_LIKE = /(sk_[A-Za-z0-9_-]{6,}|gai_[A-Za-z0-9_.-]{6,}|xi-api-key\s*[:=]\s*\S+|Bearer\s+\S+)/gi;

export function sanitizeDiagnostic(text: string): string {
  return text.replace(KEY_LIKE, "[oculto]");
}

export function describeVoicesError(err: unknown): VoicesErrorInfo {
  const e = (err ?? {}) as ErrLike;
  const code = e.code || "";
  const status = typeof e.statusCode === "number" ? e.statusCode : 0;

  let kind: VoicesErrorKind = "unknown";
  let message = "No se pudo recuperar el catálogo de voces. Tu conexión con ElevenLabs sigue activa.";

  if (code === "AUTH_REQUIRED" || code === "AUTH_INVALID" || code === "GHOSTAI_AUTH_INVALID") {
    kind = "auth";
    message = "Tu acceso GhostAI no es válido o expiró. Vuelve a conectarlo y reintenta.";
  } else if (code === "ELEVENLABS_NOT_CONNECTED" || status === 428) {
    kind = "not_connected";
    message = "La sesión de ElevenLabs no está disponible en este navegador. Vuelve a conectar tu API key.";
  } else if (code === "ELEVENLABS_KEY_MISSING_PERMISSIONS") {
    kind = "permissions";
    message =
      "La API key no tiene permiso de lectura de voces (voices_read). Habilita ese acceso en la configuración de la API key en ElevenLabs y pulsa Reintentar.";
  } else if (code === "ELEVENLABS_UNAUTHORIZED" || status === 401) {
    kind = "key_invalid";
    message = "ElevenLabs rechazó la API key (401). Cámbiala por una clave válida.";
  } else if (code === "ELEVENLABS_FORBIDDEN" || status === 403) {
    kind = "forbidden";
    message = "ElevenLabs denegó el acceso al catálogo (403). Revisa los permisos de la API key.";
  } else if (code === "ELEVENLABS_RATE_LIMIT" || status === 429) {
    kind = "rate_limit";
    message = "ElevenLabs limitó las solicitudes (429). Espera un momento y reintenta.";
  } else if (code === "ELEVENLABS_TIMEOUT" || status === 504) {
    kind = "timeout";
    message = "ElevenLabs tardó demasiado en responder. Reintenta en unos segundos.";
  } else if (code === "INVALID_RESPONSE") {
    kind = "invalid_response";
    message = "El servicio devolvió una respuesta de voces con un formato inesperado.";
  } else if (code === "NETWORK_ERROR" || status === 0) {
    kind = "network";
    message =
      "No se pudo contactar el servicio de voces (red, bloqueo del navegador o CORS). Comprueba tu conexión; la API key no se envía a ElevenLabs desde el navegador.";
  } else if (status >= 500) {
    kind = "server";
    message = "ElevenLabs o el servicio devolvieron un error del servidor. Reintenta más tarde.";
  }

  const parts = [`HTTP ${status || "sin respuesta"}`, code || "sin código"];
  if (e.requestId) parts.push(`requestId ${e.requestId}`);
  const titles: Record<VoicesErrorKind, string> = {
    auth: "ACCESO GHOSTAI NO VÁLIDO",
    not_connected: "ELEVENLABS NO DISPONIBLE EN ESTA SESIÓN",
    key_invalid: "API KEY RECHAZADA",
    permissions: "FALTA PERMISO DE VOCES EN LA API KEY",
    forbidden: "ACCESO AL CATÁLOGO DENEGADO",
    rate_limit: "LÍMITE DE SOLICITUDES",
    timeout: "ELEVENLABS NO RESPONDIÓ A TIEMPO",
    server: "ERROR DEL SERVIDOR",
    invalid_response: "RESPUESTA DE VOCES INVÁLIDA",
    network: "SIN CONEXIÓN CON EL SERVICIO DE VOCES",
    unknown: "NO PUDIMOS COMPROBAR TUS VOCES",
  };

  return { kind, title: titles[kind], message, diagnostic: sanitizeDiagnostic(parts.join(" · ")) };
}
