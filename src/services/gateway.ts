/**
 * @file src/services/gateway.ts
 * Client for the certified GhostAI TTS Gateway backend.
 */

import type { GatewayHealth, GatewayModel, GatewayVoice, GhostAiVoiceSettings } from "../types/tts";

export function getGatewayBaseUrl(): string {
  const envUrl = import.meta.env.VITE_TTS_GATEWAY_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "https://tts-test.smartbrain.lat";
}

export interface GenerateAudioParams {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: GhostAiVoiceSettings;
  outputFormat?: string;
  languageCode?: string;
  signal?: AbortSignal;
}

export interface GenerateAudioResult {
  blob: Blob;
  requestId: string;
  outputFormat: string;
  durationMs: number;
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
  };

  const startTime = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: params.signal,
  });

  const durationMs = Math.round(performance.now() - startTime);
  const requestId = res.headers.get("X-TTS-Request-ID") || "";
  const outputFormat = res.headers.get("X-TTS-Output-Format") || payload.outputFormat;

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

    throw new TtsGatewayError(errMsg, errCode, res.status, bodyReqId || requestId);
  }

  const blob = await res.blob();
  return {
    blob,
    requestId,
    outputFormat,
    durationMs,
  };
}
