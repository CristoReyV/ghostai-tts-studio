/**
 * @file tests/gateway.test.ts
 * Unit tests for TTS Gateway API service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getGatewayBaseUrl,
  generateNarrationAudio,
  checkGatewayHealth,
  setGatewayAuthToken,
  clearGatewayAuthToken,
  TtsGatewayError,
} from "../src/services/gateway";

describe("gateway service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setGatewayAuthToken("test-operator-token");
  });

  afterEach(() => {
    clearGatewayAuthToken();
  });

  it("returns default certified gateway URL when no env override is present", () => {
    const url = getGatewayBaseUrl();
    expect(url).toContain("tts-test.smartbrain.lat");
  });

  it("checks gateway health successfully", async () => {
    const mockHealth = {
      ok: true,
      service: "ghostai-tts-gateway",
      version: "1.0.0",
      provider: "elevenlabs",
      configured: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as unknown as Response);

    const result = await checkGatewayHealth();
    expect(result.ok).toBe(true);
    expect(result.configured).toBe(true);
    expect(result.provider).toBe("elevenlabs");
  });

  it("generates narration audio and parses headers and blob", async () => {
    const mockBlob = new Blob(["mock-mp3"], { type: "audio/mpeg" });
    const mockHeaders = new Headers();
    mockHeaders.set("X-TTS-Request-ID", "test-req-abc-123");
    mockHeaders.set("X-TTS-Output-Format", "mp3_44100_128");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      blob: async () => mockBlob,
    } as unknown as Response);

    const result = await generateNarrationAudio({
      voiceId: "voice-123",
      text: "Hola GhostAI",
    });

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.requestId).toBe("test-req-abc-123");
    expect(result.outputFormat).toBe("mp3_44100_128");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("throws TtsGatewayError on 400/500 with detailed message", async () => {
    const errBody = {
      error: { code: "VALIDATION_MISSING_TEXT", message: "Field 'text' is required" },
      requestId: "err-req-999",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: async () => errBody,
    } as unknown as Response);

    await expect(
      generateNarrationAudio({
        voiceId: "voice-123",
        text: "",
      })
    ).rejects.toThrowError(TtsGatewayError);
  });
});
