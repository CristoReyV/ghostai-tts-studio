/**
 * @file tests/captionsStudio.test.ts
 * Test suite for Studio Captions 01A — Gateway Client, Packaging, and Verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateNarrationAudio, setGatewayAuthToken, clearGatewayAuthToken } from "../src/services/gateway";
import { buildGhostAiTtsPackage } from "../src/services/zipBuilder";
import { verifyGhostAiTtsZip } from "../src/services/zipVerifier";
import type { GhostAiTtsProject, StudioNarrationItem } from "../src/types/tts";
import JSZip from "jszip";

describe("Captions 01A — Studio Timestamps & Packaging", () => {
  const dummyProject: GhostAiTtsProject = {
    name: "Captions Project",
    exportedAt: "2026-10-09T18:00:00Z",
  };

  const sampleAudioBlob = new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00])], { type: "audio/mpeg" });

  describe("1. Gateway Client: Opt-in Timestamps & Binary Fallback", () => {
    beforeEach(() => {
      setGatewayAuthToken("test_operator_token");
    });

    afterEach(() => {
      clearGatewayAuthToken();
      vi.restoreAllMocks();
    });

    it("sends withTimestamps: true and parses JSON response with audioBase64 and alignment", async () => {
      const fakeB64 = btoa(String.fromCharCode(0xff, 0xfb, 0x90));
      const mockJson = {
        ok: true,
        audioBase64: fakeB64,
        outputFormat: "mp3_44100_128",
        alignment: {
          words: [
            { text: "Hola", start: 0.0, end: 0.4 },
            { text: "mundo", start: 0.45, end: 0.8 },
          ],
        },
        requestId: "req-123",
        sessionId: "sess-456",
        sha256: "sha-abc",
      };

      let sentBody: any;
      global.fetch = vi.fn().mockImplementation((url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve(new Response(JSON.stringify(mockJson), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-TTS-Request-ID": "req-123",
            "X-TTS-Output-Format": "mp3_44100_128",
          },
        }));
      });

      const res = await generateNarrationAudio({
        voiceId: "v1",
        text: "Hola mundo",
      });

      expect(sentBody.withTimestamps).toBe(true);
      expect(res.blob).toBeInstanceOf(Blob);
      expect(res.blob.size).toBeGreaterThan(0);
      expect(res.alignment).toEqual(mockJson.alignment);
      expect(res.requestId).toBe("req-123");
    });

    it("handles legacy binary audio/mpeg response transparently, returning alignment: null", async () => {
      let sentBody: any;
      global.fetch = vi.fn().mockImplementation((url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve(new Response(sampleAudioBlob, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "X-TTS-Request-ID": "req-legacy",
            "X-TTS-Output-Format": "mp3_44100_128",
          },
        }));
      });

      const res = await generateNarrationAudio({
        voiceId: "v1",
        text: "Legacy text",
        withTimestamps: false,
      });

      expect(sentBody.withTimestamps).toBe(false);
      expect(res.blob).toBeInstanceOf(Blob);
      expect(res.alignment).toBeNull();
    });
  });

  describe("2. ZIP Packaging & Manifest Validation", () => {
    // K) ZIP nuevo con alignment
    it("Fixture K: exports manifest with canonical alignment without bump (version 1.0)", async () => {
      const items: StudioNarrationItem[] = [
        {
          id: "narr_01",
          sceneId: "scene_1",
          sceneIndex: 0,
          text: "¡Hola amigos!",
          status: "READY",
          audioBlob: sampleAudioBlob,
          duration: 1.5,
          voiceId: "voice_es",
          modelId: "eleven_multilingual_v2",
          alignment: {
            words: [
              { text: "¡Hola!", start: 0.0, end: 0.5 },
              { text: "amigos!", start: 0.6, end: 1.2 },
            ],
          },
        },
      ];

      const zipResult = await buildGhostAiTtsPackage({
        project: dummyProject,
        items,
      });

      const zip = await JSZip.loadAsync(zipResult.blob);
      const manifestFile = zip.file("manifest.json");
      expect(manifestFile).not.toBeNull();

      const manifest = JSON.parse(await manifestFile!.async("text"));
      expect(manifest.format).toBe("ghostai-tts");
      expect(manifest.version).toBe("1.0"); // Strict 1.0
      expect(manifest.items).toHaveLength(1);
      expect(manifest.items[0].alignment).toEqual({
        words: [
          { text: "¡Hola!", start: 0.0, end: 0.5 },
          { text: "amigos!", start: 0.6, end: 1.2 },
        ],
      });

      // Verification: No provider-specific fields
      expect(manifest.items[0].alignment.raw).toBeUndefined();
      expect(manifest.items[0].alignment.characters).toBeUndefined();

      // Verify with zipVerifier
      const verifyResult = await verifyGhostAiTtsZip(zipResult.blob);
      expect(verifyResult.ok).toBe(true);
    });

    // L) ZIP legacy sin alignment
    it("Fixture L: exports legacy manifest without alignment key when not present", async () => {
      const items: StudioNarrationItem[] = [
        {
          id: "narr_legacy",
          sceneId: "scene_1",
          sceneIndex: 0,
          text: "Sin subtítulos",
          status: "READY",
          audioBlob: sampleAudioBlob,
          duration: 2.0,
          voiceId: "voice_es",
          modelId: "eleven_multilingual_v2",
        },
      ];

      const zipResult = await buildGhostAiTtsPackage({
        project: dummyProject,
        items,
      });

      const zip = await JSZip.loadAsync(zipResult.blob);
      const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
      expect(manifest.version).toBe("1.0");
      expect(manifest.items[0].alignment).toBeUndefined();

      const verifyResult = await verifyGhostAiTtsZip(zipResult.blob);
      expect(verifyResult.ok).toBe(true);
    });

    it("omits malformed alignment (non-monotonic) from manifest but preserves audio and item", async () => {
      const items: StudioNarrationItem[] = [
        {
          id: "narr_malformed",
          sceneId: "scene_1",
          sceneIndex: 0,
          text: "Prueba malformada",
          status: "READY",
          audioBlob: sampleAudioBlob,
          duration: 2.0,
          voiceId: "voice_es",
          modelId: "eleven_multilingual_v2",
          alignment: {
            words: [
              { text: "Prueba", start: 1.5, end: 2.0 },
              { text: "malformada", start: 0.5, end: 1.0 }, // Non-monotonic start!
            ],
          },
        },
      ];

      const zipResult = await buildGhostAiTtsPackage({
        project: dummyProject,
        items,
      });

      const zip = await JSZip.loadAsync(zipResult.blob);
      const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
      expect(manifest.items[0].alignment).toBeUndefined();
      expect(manifest.items[0].file).toBe("audio/narration_001.mp3");

      const verifyResult = await verifyGhostAiTtsZip(zipResult.blob);
      expect(verifyResult.ok).toBe(true);
    });
  });
});
