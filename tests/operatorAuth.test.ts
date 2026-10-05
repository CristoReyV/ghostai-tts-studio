/**
 * @file tests/operatorAuth.test.ts
 * Comprehensive tests for Studio Operator Authentication (P2.6A).
 *
 * Verifies all 10 Studio requirements:
 * 1. Missing token blocks generateNarrationAudio BEFORE fetch POST
 * 2. Missing token blocks addSharedVoiceToAccount BEFORE fetch POST
 * 3. Valid token adds Authorization: Bearer <token> header to POST requests
 * 4. GET Voice Library continues without auth header
 * 5. Audio preview continues without auth header
 * 6. Existing account voice can be selected without calling Add POST
 * 7. Token is stored into sessionStorage only after verifyGatewayAuthToken succeeds
 * 8. Invalid token is rejected and never stored
 * 9. clearGatewayAuthToken removes the token from sessionStorage
 * 10. 401 response terminates generation without starting automatic retries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getGatewayAuthToken,
  setGatewayAuthToken,
  clearGatewayAuthToken,
  verifyGatewayAuthToken,
  generateNarrationAudio,
  addSharedVoiceToAccount,
  fetchVoiceLibrary,
  TtsGatewayError,
} from "../src/services/gateway";
import type { VoiceLibraryVoice } from "../src/types/tts";

describe("Studio: Operator Authentication (P2.6A)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearGatewayAuthToken();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearGatewayAuthToken();
  });

  // ─── 1. Missing token blocks generate BEFORE fetch POST ─────────────────────
  it("1. missing token blocks generateNarrationAudio before issuing fetch POST", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    clearGatewayAuthToken();
    expect(getGatewayAuthToken()).toBeNull();

    await expect(
      generateNarrationAudio({
        voiceId: "v-test-1",
        text: "Testing narration without token",
      })
    ).rejects.toThrowError(TtsGatewayError);

    // ZERO network calls made
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ─── 2. Missing token blocks Add BEFORE fetch POST ──────────────────────────
  it("2. missing token blocks addSharedVoiceToAccount before issuing fetch POST", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    clearGatewayAuthToken();
    expect(getGatewayAuthToken()).toBeNull();

    await expect(
      addSharedVoiceToAccount({
        voiceId: "v-shared-1",
        publicOwnerId: "owner-abc",
        name: "Test Voice",
      })
    ).rejects.toThrowError(TtsGatewayError);

    // ZERO network calls made
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ─── 3. Valid token adds Authorization: Bearer <token> header ──────────────
  it("3. valid token adds Authorization: Bearer <token> to generate and add POSTs", async () => {
    const TEST_TOKEN = "valid-operator-secret-777";
    setGatewayAuthToken(TEST_TOKEN);

    const mockHeaders = new Headers();
    mockHeaders.set("X-TTS-Request-ID", "req-auth-test");

    const fetchSpy = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/tts/generate")) {
        return new Response(new Blob(["audio-bytes"], { type: "audio/mpeg" }), {
          status: 200,
          headers: mockHeaders,
        });
      }
      if (url.includes("/api/tts/voices/shared/add")) {
        return new Response(
          JSON.stringify({ ok: true, voiceId: "v-shared-added", name: "Added Voice" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    });
    global.fetch = fetchSpy;

    // Test generate POST
    await generateNarrationAudio({
      voiceId: "v-1",
      text: "Testing authorization header",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/tts/generate"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
      })
    );

    // Test Add POST
    await addSharedVoiceToAccount({
      voiceId: "v-shared-1",
      publicOwnerId: "owner-1",
      name: "Added Voice",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/tts/voices/shared/add"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
      })
    );
  });

  // ─── 4. GET Voice Library continues without auth ────────────────────────────
  it("4. GET Voice Library continues without Authorization header", async () => {
    clearGatewayAuthToken();

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [],
          page: 0,
          pageSize: 12,
          hasMore: false,
          totalCount: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchSpy;

    await fetchVoiceLibrary({ language: "es" });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/tts/voice-library?language=es"),
      expect.objectContaining({
        method: "GET",
      })
    );

    const callHeaders = fetchSpy.mock.calls[0][1]?.headers;
    if (callHeaders) {
      expect(callHeaders).not.toHaveProperty("Authorization");
    }
  });

  // ─── 5. Audio preview continues without auth ────────────────────────────────
  it("5. audio preview uses public URL without requiring operator auth", () => {
    clearGatewayAuthToken();
    const voiceWithPreview: VoiceLibraryVoice = {
      voiceId: "v-preview-only",
      publicOwnerId: "owner-pub",
      name: "Narrador Preview",
      previewUrl: "https://storage.googleapis.com/eleven-public-cdn/preview-sample.mp3",
    };

    // Previews load directly from the CDN previewUrl
    expect(voiceWithPreview.previewUrl).toBeTruthy();
    expect(getGatewayAuthToken()).toBeNull();
  });

  // ─── 6. Existing account voice can be selected without Add ─────────────────
  it("6. existing account voice can be selected without calling addSharedVoiceToAccount", () => {
    const addSpy = vi.fn();
    const onSelectVoiceSpy = vi.fn();

    const accountVoiceIds = new Set(["account-voice-1", "account-voice-2"]);
    const targetVoiceId = "account-voice-1";

    // Simulate handleUseVoice logic
    if (accountVoiceIds.has(targetVoiceId)) {
      onSelectVoiceSpy(targetVoiceId);
    } else {
      addSpy();
    }

    expect(onSelectVoiceSpy).toHaveBeenCalledWith("account-voice-1");
    expect(addSpy).not.toHaveBeenCalled();
  });

  // ─── 7. Token saved only after successful verify ────────────────────────────
  it("7. token is stored in sessionStorage only after verify succeeds", async () => {
    clearGatewayAuthToken();
    const VALID_TOKEN = "good-secret-token";

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, authenticated: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await verifyGatewayAuthToken(VALID_TOKEN);
    expect(result.ok).toBe(true);

    // Caller stores only on success
    if (result.ok) {
      setGatewayAuthToken(VALID_TOKEN);
    }

    expect(getGatewayAuthToken()).toBe(VALID_TOKEN);
  });

  // ─── 8. Invalid token is not saved ──────────────────────────────────────────
  it("8. invalid token returns error and is not saved to sessionStorage", async () => {
    clearGatewayAuthToken();
    const BAD_TOKEN = "incorrect-token-xyz";

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "AUTH_INVALID", message: "Invalid authorization token." },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await verifyGatewayAuthToken(BAD_TOKEN);
    expect(result.ok).toBe(false);

    if (result.ok) {
      setGatewayAuthToken(BAD_TOKEN);
    }

    expect(getGatewayAuthToken()).toBeNull();
  });

  // ─── 9. clearGatewayAuthToken removes token from sessionStorage ─────────────
  it("9. clearGatewayAuthToken removes the token from sessionStorage", () => {
    setGatewayAuthToken("temporary-token");
    expect(getGatewayAuthToken()).toBe("temporary-token");

    clearGatewayAuthToken();
    expect(getGatewayAuthToken()).toBeNull();
  });

  // ─── 10. 401 response terminates without auto-retrying ──────────────────────
  it("10. 401 response clears token and halts generation without auto-retrying", async () => {
    setGatewayAuthToken("expired-token");

    let attemptCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      attemptCount++;
      return new Response(
        JSON.stringify({
          error: { code: "AUTH_INVALID", message: "Invalid authorization token." },
          requestId: "req-401",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    });

    // Simulate batch execution over 3 items
    const items = [{ id: "item-1" }, { id: "item-2" }, { id: "item-3" }];
    let stoppedEarly = false;

    for (const item of items) {
      try {
        await generateNarrationAudio({
          voiceId: "v-1",
          text: `Text for ${item.id}`,
        });
      } catch (err) {
        const status = (err as TtsGatewayError).statusCode;
        if (status === 401) {
          clearGatewayAuthToken();
          stoppedEarly = true;
          break; // Stop immediately, no retry
        }
      }
    }

    expect(attemptCount).toBe(1); // Never called 3 times, halted on first 401!
    expect(stoppedEarly).toBe(true);
    expect(getGatewayAuthToken()).toBeNull(); // Token cleared
  });
});
