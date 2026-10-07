/**
 * @file src/services/gateway.ts
 * Client for the certified GhostAI TTS Gateway backend.
 */

import type {
  GatewayHealth,
  GatewayModel,
  GatewayVoice,
  GhostAiVoiceSettings,
  VoiceLibraryResponse,
  VoiceLibraryQueryParams,
  AddSharedVoiceRequest,
  AddSharedVoiceResponse,
} from "../types/tts";

export function getGatewayBaseUrl(): string {
  const envUrl = import.meta.env.VITE_TTS_GATEWAY_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "https://tts-test.smartbrain.lat";
}

/** Key used exclusively in sessionStorage for operator authentication */
export const OPERATOR_TOKEN_STORAGE_KEY = "ghostai_tts_operator_access";

let memorySessionToken: string | null = null;

let onAuthExpiredCallback: (() => void) | null = null;

/**
 * Registers a global callback for 401 session expirations.
 */
export function setOnAuthExpired(cb: (() => void) | null): void {
  onAuthExpiredCallback = cb;
}

/**
 * Reads operator auth token from sessionStorage.
 * Includes guard for test environments where window.sessionStorage is undefined.
 * Never reads from localStorage, cookies, URL, or persistent storage.
 */
export function getGatewayAuthToken(): string | null {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(OPERATOR_TOKEN_STORAGE_KEY);
    } catch {
      return memorySessionToken;
    }
  }
  return memorySessionToken;
}

/**
 * Stores validated operator auth token into sessionStorage.
 */
export function setGatewayAuthToken(token: string): void {
  const clean = token && token.trim() ? token.trim() : null;
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      if (clean) {
        window.sessionStorage.setItem(OPERATOR_TOKEN_STORAGE_KEY, clean);
      } else {
        window.sessionStorage.removeItem(OPERATOR_TOKEN_STORAGE_KEY);
      }
    } catch {}
  }
  memorySessionToken = clean;
}

/**
 * Removes operator auth token from sessionStorage.
 */
export function clearGatewayAuthToken(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(OPERATOR_TOKEN_STORAGE_KEY);
    } catch {}
  }
  memorySessionToken = null;
  onAuthExpiredCallback?.();
}

/**
 * Validates the operator Bearer token against GET /api/tts/auth/verify.
 * Does NOT call ElevenLabs, does NOT spend credits.
 * Does NOT store the token automatically — the caller stores it only on success.
 */
export async function verifyGatewayAuthToken(
  token: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; message?: string; authMode?: string; clientName?: string }> {
  if (!token || !token.trim()) {
    return { ok: false, message: "La clave de acceso no puede estar vacía." };
  }

  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/auth/verify`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
      signal,
    });

    if (res.ok) {
      let authMode: string | undefined;
      let clientName: string | undefined;
      try {
        const body = await res.json();
        authMode = body?.authMode;
        clientName = body?.client?.name;
      } catch {}
      return { ok: true, authMode, clientName };
    }

    if (res.status === 401) {
      let errMsg = "Clave de acceso no autorizada o inválida.";
      try {
        const body = await res.json();
        if (body?.error?.message) errMsg = body.error.message;
      } catch {}
      return { ok: false, message: errMsg };
    }

    if (res.status === 500) {
      return {
        ok: false,
        message: "El Gateway no tiene configurada la autenticación de operador en el servidor.",
      };
    }

    return { ok: false, message: `Error HTTP ${res.status} al verificar la clave de acceso.` };
  } catch (err) {
    return { ok: false, message: `Error de conexión: ${(err as Error).message}` };
  }
}

export interface GenerateAudioParams {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: GhostAiVoiceSettings;
  outputFormat?: string;
  languageCode?: string;
  signal?: AbortSignal;
  sessionId?: string;
  projectId?: string;
  projectTitle?: string;
  narrationId?: string;
  sceneId?: string;
  sceneIndex?: number;
}

export interface GenerateAudioResult {
  blob: Blob;
  requestId: string;
  outputFormat: string;
  durationMs: number;
  sessionId?: string | null;
  sha256?: string | null;
  recoveryWarning?: string | null;
}

export class TtsGatewayError extends Error {
  code: string;
  statusCode: number;
  requestId?: string;

  constructor(message: string, code: string, statusCode: number, requestId?: string) {
    super(message);
    this.name = "TtsGatewayError";
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

/**
 * Checks connectivity and configuration status of the TTS Gateway.
 */
export async function checkGatewayHealth(signal?: AbortSignal): Promise<GatewayHealth> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/health`;

  try {
    const res = await fetch(url, { method: "GET", signal });
    if (!res.ok) {
      throw new TtsGatewayError(`Gateway respondió con estado ${res.status}`, "GATEWAY_ERROR", res.status);
    }
    const data = (await res.json()) as GatewayHealth;
    return data;
  } catch (err) {
    if (err instanceof TtsGatewayError) throw err;
    throw new TtsGatewayError(
      `No se pudo conectar al Gateway en ${base}: ${(err as Error).message}`,
      "NETWORK_ERROR",
      0
    );
  }
}

/**
 * Fetches available voices from the Gateway.
 */
export async function fetchGatewayVoices(signal?: AbortSignal): Promise<GatewayVoice[]> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/voices`;

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    let errMsg = `Error ${res.status} al obtener voces`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) errMsg = errBody.error.message;
    } catch (_) {}
    throw new TtsGatewayError(errMsg, "FETCH_VOICES_FAILED", res.status);
  }

  const data = await res.json();
  return (data.voices || []) as GatewayVoice[];
}

/**
 * Fetches available models from the Gateway.
 */
export async function fetchGatewayModels(signal?: AbortSignal): Promise<GatewayModel[]> {
  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/models`;

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    let errMsg = `Error ${res.status} al obtener modelos`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) errMsg = errBody.error.message;
    } catch (_) {}
    throw new TtsGatewayError(errMsg, "FETCH_MODELS_FAILED", res.status);
  }

  const data = await res.json();
  return (data.models || []) as GatewayModel[];
}

/**
 * Requests TTS audio synthesis from the Gateway.
 * Returns raw Blob without unnecessary base64 conversion.
 */
export async function generateNarrationAudio(params: GenerateAudioParams): Promise<GenerateAudioResult> {
  const token = getGatewayAuthToken();
  if (!token || !token.trim()) {
    throw new TtsGatewayError(
      "Se requiere una clave de acceso de operador para generar narraciones.",
      "AUTH_REQUIRED",
      401
    );
  }

  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/generate`;

  const payload = {
    provider: "elevenlabs",
    voiceId: params.voiceId,
    text: params.text,
    modelId: params.modelId || "eleven_multilingual_v2",
    outputFormat: params.outputFormat || "mp3_44100_128",
    ...(params.languageCode ? { languageCode: params.languageCode } : {}),
    ...(params.voiceSettings ? { voiceSettings: params.voiceSettings } : {}),
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.projectTitle ? { projectTitle: params.projectTitle } : {}),
    ...(params.narrationId ? { narrationId: params.narrationId } : {}),
    ...(params.sceneId ? { sceneId: params.sceneId } : {}),
    ...(typeof params.sceneIndex === "number" ? { sceneIndex: params.sceneIndex } : {}),
  };

  const startTime = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
    credentials: "include",
    body: JSON.stringify(payload),
    signal: params.signal,
  });

  const durationMs = Math.round(performance.now() - startTime);
  const requestId = res.headers.get("X-TTS-Request-ID") || "";
  const outputFormat = res.headers.get("X-TTS-Output-Format") || payload.outputFormat;
  const sessionId = res.headers.get("X-TTS-Session-ID") || undefined;
  const sha256 = res.headers.get("X-TTS-Audio-SHA256") || undefined;
  const recoveryWarning = res.headers.get("X-TTS-Recovery-Warning") || undefined;

  if (!res.ok) {
    let errMsg = `Error HTTP ${res.status} al generar audio`;
    let errCode = "GENERATE_FAILED";
    let bodyReqId = requestId;

    try {
      const errData = await res.json();
      if (errData?.error?.message) errMsg = errData.error.message;
      if (errData?.error?.code) errCode = errData.error.code;
      if (errData?.requestId) bodyReqId = errData.requestId;
    } catch (_) {}

    // Only clear operator auth token if the error was operator auth failure,
    // NOT when the user's ElevenLabs BYOK key was rejected
    if (res.status === 401 && (errCode === "AUTH_REQUIRED" || errCode === "AUTH_INVALID")) {
      clearGatewayAuthToken();
    }

    if (res.status === 428 || errCode === "ELEVENLABS_NOT_CONNECTED") {
      throw new TtsGatewayError(
        errMsg || "Conecta tu cuenta de ElevenLabs antes de generar.",
        "ELEVENLABS_NOT_CONNECTED",
        res.status,
        bodyReqId || requestId
      );
    }

    throw new TtsGatewayError(errMsg, errCode, res.status, bodyReqId || requestId);
  }

  const blob = await res.blob();
  return {
    blob,
    requestId,
    outputFormat,
    durationMs,
    sessionId,
    sha256,
    recoveryWarning,
  };
}

export interface ByokStatusResponse {
  connected: boolean;
  provider?: string;
}

export interface ByokConnectResponse {
  ok: boolean;
  connected?: boolean;
  provider?: string;
  tier?: string;
  status?: string;
  message?: string;
}

/**
 * Connects the user's personal ElevenLabs API key for this browser session.
 * Transmits the key securely via HTTPS to the Gateway with credentials: 'include'.
 * The frontend NEVER stores the key in localStorage, sessionStorage or anywhere else.
 */
export async function connectElevenLabs(
  apiKey: string,
  signal?: AbortSignal
): Promise<ByokConnectResponse> {
  const token = getGatewayAuthToken();
  if (!token || !token.trim()) {
    throw new TtsGatewayError(
      "Se requiere una clave de acceso de operador para conectar ElevenLabs.",
      "AUTH_REQUIRED",
      401
    );
  }

  const cleanKey = apiKey ? apiKey.trim() : "";
  if (!cleanKey) {
    throw new TtsGatewayError(
      "La API key de ElevenLabs no puede estar vacía.",
      "VALIDATION_MISSING_FIELD",
      400
    );
  }

  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/provider/elevenlabs/connect`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
    credentials: "include",
    body: JSON.stringify({ apiKey: cleanKey }),
    signal,
  });

  if (!res.ok) {
    let errMsg = `Error ${res.status} al conectar ElevenLabs`;
    let errCode = "CONNECT_FAILED";
    try {
      const errData = await res.json();
      if (errData?.error?.message) errMsg = errData.error.message;
      if (errData?.error?.code) errCode = errData.error.code;
    } catch (_) {}

    if (res.status === 401 && (errCode === "AUTH_REQUIRED" || errCode === "AUTH_INVALID")) {
      clearGatewayAuthToken();
    }

    throw new TtsGatewayError(errMsg, errCode, res.status);
  }

  const data = (await res.json()) as ByokConnectResponse;
  return data;
}

/**
 * Checks if the current browser session has a valid BYOK ElevenLabs connection.
 * Pure server-side cookie probe — does not call ElevenLabs external API.
 */
export async function checkElevenLabsStatus(
  signal?: AbortSignal
): Promise<ByokStatusResponse> {
  const token = getGatewayAuthToken();
  if (!token || !token.trim()) {
    return { connected: false, provider: "elevenlabs" };
  }

  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/provider/elevenlabs/status`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
      credentials: "include",
      signal,
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearGatewayAuthToken();
      }
      return { connected: false, provider: "elevenlabs" };
    }

    const data = (await res.json()) as ByokStatusResponse;
    return data;
  } catch {
    return { connected: false, provider: "elevenlabs" };
  }
}

/**
 * Disconnects the user's ElevenLabs BYOK session by expiring the HttpOnly cookie.
 */
export async function disconnectElevenLabs(
  signal?: AbortSignal
): Promise<{ ok: boolean }> {
  const token = getGatewayAuthToken();
  if (!token || !token.trim()) {
    return { ok: true };
  }

  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/provider/elevenlabs/disconnect`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
      credentials: "include",
      signal,
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Fetches shared voices catalog from the Gateway Voice Library endpoint.
 * GET /api/tts/voice-library
 */
export async function fetchVoiceLibrary(
  params: VoiceLibraryQueryParams = {},
  signal?: AbortSignal
): Promise<VoiceLibraryResponse> {
  const base = getGatewayBaseUrl();
  const searchParams = new URLSearchParams();

  if (params.language) searchParams.set("language", params.language);
  if (typeof params.page === "number") searchParams.set("page", String(params.page));
  if (typeof params.pageSize === "number") searchParams.set("page_size", String(params.pageSize));
  if (params.search) searchParams.set("search", params.search);
  if (params.accent) searchParams.set("accent", params.accent);
  if (params.locale) searchParams.set("locale", params.locale);
  if (params.gender) searchParams.set("gender", params.gender);
  if (params.age) searchParams.set("age", params.age);
  if (params.useCases) searchParams.set("use_cases", params.useCases);
  if (params.sort) searchParams.set("sort", params.sort);

  const qs = searchParams.toString();
  const url = `${base}/api/tts/voice-library${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    let errMsg = `Error ${res.status} al consultar Voice Library`;
    let errCode = "VOICE_LIBRARY_FAILED";
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) errMsg = errBody.error.message;
      if (errBody?.error?.code) errCode = errBody.error.code;
    } catch (_) {}
    throw new TtsGatewayError(errMsg, errCode, res.status);
  }

  const data = await res.json();
  return data as VoiceLibraryResponse;
}

/**
 * Adds a shared voice to the account collection via Gateway.
 * POST /api/tts/voices/shared/add
 */
export async function addSharedVoiceToAccount(
  request: AddSharedVoiceRequest,
  signal?: AbortSignal
): Promise<AddSharedVoiceResponse> {
  const token = getGatewayAuthToken();
  if (!token || !token.trim()) {
    throw new TtsGatewayError(
      "Se requiere una clave de acceso de operador para añadir voces a tu colección.",
      "AUTH_REQUIRED",
      401
    );
  }

  const base = getGatewayBaseUrl();
  const url = `${base}/api/tts/voices/shared/add`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
    credentials: "include",
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearGatewayAuthToken();
    }

    let errMsg = `Error ${res.status} al añadir voz a tu colección`;
    let errCode = "ADD_SHARED_VOICE_FAILED";
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) errMsg = errBody.error.message;
      if (errBody?.error?.code) errCode = errBody.error.code;
    } catch (_) {}
    throw new TtsGatewayError(errMsg, errCode, res.status);
  }

  const data = await res.json();
  return data as AddSharedVoiceResponse;
}
