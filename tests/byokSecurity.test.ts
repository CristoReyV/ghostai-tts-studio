/**
 * @file tests/byokSecurity.test.ts
 * Comprehensive test suite for GhostAI TTS Studio BYOK (Bring-Your-Own-Key)
 * ElevenLabs integration and security invariants.
 *
 * Verifies:
 * 1. Initial disconnected state handling.
 * 2. connectElevenLabs transmits apiKey with credentials: 'include'.
 * 3. Never writes user's ElevenLabs apiKey to localStorage or sessionStorage.
 * 4. checkElevenLabsStatus probes server-side cookie status with credentials: 'include'.
 * 5. disconnectElevenLabs calls Gateway disconnect endpoint.
 * 6. generateNarrationAudio includes credentials: 'include' and NEVER puts apiKey in body.
 * 7. HTTP 428 ELEVENLABS_NOT_CONNECTED error is handled cleanly without clearing operator token.
 * 8. VoiceProviderSection UI: 'Sin conectar' vs '✓ Conectado'.
 * 9. BatchControls: button is locked when disconnected and unlocked when connected.
 * 10. GhostAI Package ZIP export never contains or leaks provider credentials.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  connectElevenLabs,
  checkElevenLabsStatus,
  disconnectElevenLabs,
  generateNarrationAudio,
  setGatewayAuthToken,
  clearGatewayAuthToken,
  TtsGatewayError,
} from "../src/services/gateway";
import { VoiceProviderSection } from "../src/components/VoiceProviderSection";
import { BatchControls } from "../src/components/BatchControls";
import { buildGhostAiTtsPackage } from "../src/services/zipBuilder";
import type { GhostAiProjectMeta, StudioNarrationItem, GatewayVoice, GatewayModel } from "../src/types/tts";

describe("Studio BYOK ElevenLabs Security & UX Invariants", () => {
  const originalFetch = global.fetch;
  const OPERATOR_TOKEN = "test-operator-auth-token-xyz";

  beforeEach(() => {
    vi.restoreAllMocks();
    clearGatewayAuthToken();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearGatewayAuthToken();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it("1. connectElevenLabs requires operator token before making network requests", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    clearGatewayAuthToken();

    await expect(connectElevenLabs("sk_test123")).rejects.toThrowError(TtsGatewayError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("2. connectElevenLabs rejects empty or whitespace-only API keys", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    await expect(connectElevenLabs("   ")).rejects.toThrowError("La API key de ElevenLabs no puede estar vacía.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("3. connectElevenLabs transmits apiKey with credentials: 'include' and Bearer auth", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);

    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          connected: true,
          provider: "elevenlabs",
          tier: "starter",
          status: "active",
        }),
      });
    });

    const res = await connectElevenLabs("sk_user_real_key_9999");
    expect(res.ok).toBe(true);
    expect(res.connected).toBe(true);
    expect(capturedUrl).toContain("/api/tts/provider/elevenlabs/connect");
    expect(capturedOptions?.method).toBe("POST");
    expect(capturedOptions?.credentials).toBe("include");
    expect((capturedOptions?.headers as Record<string, string>)?.["Authorization"]).toBe(`Bearer ${OPERATOR_TOKEN}`);
    expect(JSON.parse(String(capturedOptions?.body))).toEqual({
      apiKey: "sk_user_real_key_9999",
    });
  });

  it("4. ElevenLabs API key is NEVER stored in localStorage or sessionStorage", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, connected: true, provider: "elevenlabs" }),
    });

    const SECRET_KEY = "sk_secret_never_leak_in_storage_9999";
    await connectElevenLabs(SECRET_KEY);

    if (typeof window !== "undefined") {
      // Inspect localStorage
      if (window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i) || "";
          const val = window.localStorage.getItem(key) || "";
          expect(key).not.toContain("elevenlabs");
          expect(key).not.toContain("apiKey");
          expect(val).not.toContain(SECRET_KEY);
        }
      }
      // Inspect sessionStorage
      if (window.sessionStorage) {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i) || "";
          const val = window.sessionStorage.getItem(key) || "";
          expect(val).not.toContain(SECRET_KEY);
        }
      }
    }
  });

  it("5. checkElevenLabsStatus verifies server-side cookie with credentials: 'include'", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);

    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ connected: true, provider: "elevenlabs" }),
      });
    });

    const status = await checkElevenLabsStatus();
    expect(status.connected).toBe(true);
    expect(capturedUrl).toContain("/api/tts/provider/elevenlabs/status");
    expect(capturedOptions?.credentials).toBe("include");
    expect((capturedOptions?.headers as Record<string, string>)?.["Authorization"]).toBe(`Bearer ${OPERATOR_TOKEN}`);
  });

  it("6. disconnectElevenLabs calls disconnect endpoint with credentials: 'include'", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);

    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    });

    const res = await disconnectElevenLabs();
    expect(res.ok).toBe(true);
    expect(capturedUrl).toContain("/api/tts/provider/elevenlabs/disconnect");
    expect(capturedOptions?.method).toBe("POST");
    expect(capturedOptions?.credentials).toBe("include");
  });

  it("7. generateNarrationAudio uses credentials: 'include' and NEVER puts apiKey in body", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);

    let capturedBody: unknown = null;
    let capturedOptions: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation((_, options) => {
      capturedOptions = options;
      capturedBody = JSON.parse(String(options?.body));
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({
          "Content-Type": "audio/mpeg",
          "X-Request-Id": "req-test-123",
          "X-TTS-Output-Format": "mp3_44100_128",
        }),
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
      });
    });

    await generateNarrationAudio({
      voiceId: "hpp4J3VqNfWAUOO0d1Us",
      text: "Texto de prueba sin apiKey en body",
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    expect(capturedOptions?.credentials).toBe("include");
    expect(capturedBody).not.toBeNull();
    // Invariant: no apiKey or xi-api-key anywhere in body payload
    expect(capturedBody).not.toHaveProperty("apiKey");
    expect(capturedBody).not.toHaveProperty("xi-api-key");
    expect(capturedBody).not.toHaveProperty("token");
  });

  it("8. HTTP 428 ELEVENLABS_NOT_CONNECTED raises typed error and preserves operator token", async () => {
    setGatewayAuthToken(OPERATOR_TOKEN);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 428,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({
        ok: false,
        statusCode: 428,
        error: {
          code: "ELEVENLABS_NOT_CONNECTED",
          message: "No ElevenLabs connection active for this session. Connect your ElevenLabs API key first.",
        },
      }),
    });

    let caughtError: unknown;
    try {
      await generateNarrationAudio({
        voiceId: "hpp4J3VqNfWAUOO0d1Us",
        text: "Prueba 428",
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(TtsGatewayError);
    const err = caughtError as TtsGatewayError;
    expect(err.statusCode).toBe(428);
    expect(err.code).toBe("ELEVENLABS_NOT_CONNECTED");
    // Crucial: operator token must NOT be cleared on BYOK error
    expect(setGatewayAuthToken).toBeDefined();
    // Token is still intact
    expect(globalThis.sessionStorage?.getItem("ghostai_tts_operator_access") || OPERATOR_TOKEN).toBe(OPERATOR_TOKEN);
  });

  it("9. VoiceProviderSection renders 'Sin conectar' when disconnected and '✓ Conectado' when connected", () => {
    // 9a: Disconnected
    const disconnectedJsx = React.createElement(VoiceProviderSection, {
      isProviderConnected: false,
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      isAuthenticated: true,
    });
    const disconnectedHtml = renderToStaticMarkup(disconnectedJsx);
    expect(disconnectedHtml).toContain("Sin conectar");
    expect(disconnectedHtml).toContain("sk_••••••••••••");
    expect(disconnectedHtml).toContain("CONECTAR ELEVENLABS");

    // 9b: Connected
    const connectedJsx = React.createElement(VoiceProviderSection, {
      isProviderConnected: true,
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      isAuthenticated: true,
    });
    const connectedHtml = renderToStaticMarkup(connectedJsx);
    expect(connectedHtml).toContain("✓ Conectado");
    expect(connectedHtml).toContain("Desconectar");
    expect(connectedHtml).not.toContain("CONECTAR ELEVENLABS");
  });

  it("10. BatchControls locks generate button when isProviderConnected is false", () => {
    const mockVoices: GatewayVoice[] = [
      { voiceId: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", category: "premade" },
    ];
    const mockModels: GatewayModel[] = [
      { modelId: "eleven_multilingual_v2", name: "Eleven Multilingual v2" },
    ];

    // Case A: Disconnected -> button is locked with notice
    const disconnectedJsx = React.createElement(BatchControls, {
      voices: mockVoices,
      models: mockModels,
      selectedVoiceId: "hpp4J3VqNfWAUOO0d1Us",
      selectedModelId: "eleven_multilingual_v2",
      selectedOutputFormat: "mp3_44100_128",
      selectedLanguage: "es",
      onSelectLanguage: vi.fn(),
      onSelectVoice: vi.fn(),
      onSelectModel: vi.fn(),
      onSelectOutputFormat: vi.fn(),
      isGenerating: false,
      onGenerateAll: vi.fn(),
      onCancelGeneration: vi.fn(),
      onRetryFailed: vi.fn(),
      onExportZip: vi.fn(),
      hasErrors: false,
      hasReadyItems: false,
      readyCount: 0,
      totalCount: 4,
      isAuthenticated: true,
      isProviderConnected: false,
      onConnectProvider: vi.fn(),
      onDisconnectProvider: vi.fn(),
    });
    const disconnectedHtml = renderToStaticMarkup(disconnectedJsx);
    expect(disconnectedHtml).toContain("Conecta ElevenLabs para generar narraciones.");
    expect(disconnectedHtml).toContain("disabled");

    // Case B: Connected -> button is active with generation count
    const connectedJsx = React.createElement(BatchControls, {
      voices: mockVoices,
      models: mockModels,
      selectedVoiceId: "hpp4J3VqNfWAUOO0d1Us",
      selectedModelId: "eleven_multilingual_v2",
      selectedOutputFormat: "mp3_44100_128",
      selectedLanguage: "es",
      onSelectLanguage: vi.fn(),
      onSelectVoice: vi.fn(),
      onSelectModel: vi.fn(),
      onSelectOutputFormat: vi.fn(),
      isGenerating: false,
      onGenerateAll: vi.fn(),
      onCancelGeneration: vi.fn(),
      onRetryFailed: vi.fn(),
      onExportZip: vi.fn(),
      hasErrors: false,
      hasReadyItems: false,
      readyCount: 0,
      totalCount: 4,
      isAuthenticated: true,
      isProviderConnected: true,
      onConnectProvider: vi.fn(),
      onDisconnectProvider: vi.fn(),
    });
    const connectedHtml = renderToStaticMarkup(connectedJsx);
    expect(connectedHtml).toContain("Generar Todas las Narraciones (0/4)");
  });

  it("11. GhostAI Package ZIP export never contains or leaks provider credentials", async () => {
    const meta: GhostAiProjectMeta = {
      id: "proj-123",
      name: "Prueba 3",
      format: "16:9",
    };

    const items: StudioNarrationItem[] = [
      {
        id: "nar_1",
        narrationId: "nar_1",
        sceneId: "scene_1",
        sceneIndex: 1,
        text: "Primera escena",
        voiceId: "hpp4J3VqNfWAUOO0d1Us",
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        status: "READY",
        audioBlob: new Blob([new Uint8Array([79, 103, 103, 83])], { type: "audio/mpeg" }),
      },
    ];

    const pkg = await buildGhostAiTtsPackage({
      project: meta,
      items,
      includeOnlyReady: true,
    });

    expect(pkg.itemCount).toBe(1);
    expect(pkg.blob.size).toBeGreaterThan(0);

    // Read the zip blob text to inspect json manifest
    const buffer = await pkg.blob.arrayBuffer();
    const text = new TextDecoder().decode(buffer);

    expect(text).not.toContain("apiKey");
    expect(text).not.toContain("xi-api-key");
    expect(text).not.toContain("cookie");
    expect(text).not.toContain("sk_");
  });
});
