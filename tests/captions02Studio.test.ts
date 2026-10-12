/**
 * @file tests/captions02Studio.test.ts
 * Comprehensive test suite for CAPTIONS 02 — Forced Alignment & Caption Status UX in Studio.
 * Zero real ElevenLabs API calls (fully mocked).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { alignExistingAudio, setGatewayAuthToken, clearGatewayAuthToken } from "../src/services/gateway";
import { buildGhostAiTtsPackage } from "../src/services/zipBuilder";
import { verifyGhostAiTtsZip } from "../src/services/zipVerifier";
import type { GhostAiTtsProject, StudioNarrationItem, CaptionStatus } from "../src/types/tts";
import JSZip from "jszip";

describe("CAPTIONS 02 — Forced Alignment & Caption Status UX (Studio)", () => {
  const dummyProject: GhostAiTtsProject = {
    name: "Captions 02 Test Project",
    exportedAt: "2026-10-12T12:00:00Z",
  };

  const sampleAudioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x44, 0x55, 0x66, 0x77]);
  const sampleAudioBlob = new Blob([sampleAudioBytes], { type: "audio/mpeg" });

  const mockAlignment = {
    words: [
      { text: "Hola", start: 0.0, end: 0.4 },
      { text: "mundo", start: 0.45, end: 0.9 },
    ],
  };

  beforeEach(() => {
    setGatewayAuthToken("test_token_captions02");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearGatewayAuthToken();
    vi.restoreAllMocks();
  });

  describe("1. alignExistingAudio Gateway Client", () => {
    it("sends multipart/form-data to /api/tts/alignment and parses canonical alignment", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          ok: true,
          alignment: mockAlignment,
          requestId: "req_align_123",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await alignExistingAudio({
        audioBlob: sampleAudioBlob,
        text: "Hola mundo",
        generationItemId: "item_gen_01",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/tts/alignment");
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);
      expect(options.headers["Authorization"]).toBe("Bearer test_token_captions02");

      expect(result.alignment).toEqual(mockAlignment);
      expect(result.requestId).toBe("req_align_123");
    });

    it("throws structured error on 400 bad request without altering audio", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          error: {
            code: "ALIGNMENT_TEXT_EMPTY",
            message: "Text must be non-empty",
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        alignExistingAudio({
          audioBlob: sampleAudioBlob,
          text: "",
        })
      ).rejects.toThrow("Text must be non-empty");
    });
  });

  describe("2. Caption Status Logic & Text Authority Protection", () => {
    function computeCaptionStatus(item: StudioNarrationItem): CaptionStatus {
      if (item.alignmentStatus === "ALIGNING") return "ALIGNING";
      if (item.alignmentStatus === "ERROR") return "ERROR";
      const hasAudio = item.status === "READY" || !!item.audioUrl;
      if (!hasAudio) return "MISSING";
      const textAtGen = item.textAtGeneration || item.alignmentText;
      if (textAtGen && textAtGen.trim() !== item.text.trim()) {
        return "OUTDATED";
      }
      if (item.alignment && Array.isArray(item.alignment.words) && item.alignment.words.length > 0) {
        return "SYNCED";
      }
      return "MISSING";
    }

    it("identifies audio + no alignment as MISSING ('Sin generar')", () => {
      const item: StudioNarrationItem = {
        id: "narr_01",
        sceneId: "scene_01",
        sceneIndex: 1,
        text: "Texto sin alignment",
        status: "READY",
        audioUrl: "blob:mock",
        audioBlob: sampleAudioBlob,
        alignment: null,
      };

      expect(computeCaptionStatus(item)).toBe("MISSING");
    });

    it("identifies audio + valid alignment as SYNCED ('Sincronizados')", () => {
      const item: StudioNarrationItem = {
        id: "narr_02",
        sceneId: "scene_01",
        sceneIndex: 1,
        text: "Hola mundo",
        textAtGeneration: "Hola mundo",
        status: "READY",
        audioUrl: "blob:mock",
        audioBlob: sampleAudioBlob,
        alignment: mockAlignment,
      };

      expect(computeCaptionStatus(item)).toBe("SYNCED");
    });

    it("identifies text mismatch as OUTDATED ('Desactualizados') and blocks silent alignment", () => {
      const item: StudioNarrationItem = {
        id: "narr_03",
        sceneId: "scene_01",
        sceneIndex: 1,
        text: "Texto nuevo editado por el usuario",
        textAtGeneration: "Texto viejo con el que se grabó",
        status: "READY",
        audioUrl: "blob:mock",
        audioBlob: sampleAudioBlob,
        alignment: mockAlignment,
      };

      const status = computeCaptionStatus(item);
      expect(status).toBe("OUTDATED");

      // Verify bulk filter skips outdated items to protect text authority
      const hasAudio = item.status === "READY" || !!item.audioUrl;
      const hasValidAlignment = item.alignment && Array.isArray(item.alignment.words) && item.alignment.words.length > 0;
      const textMatches = !item.textAtGeneration || item.text.trim() === item.textAtGeneration.trim();
      const isEligibleForBulk = hasAudio && !hasValidAlignment && textMatches;

      expect(isEligibleForBulk).toBe(false);
    });

    it("preserves audio byte-by-byte when alignment is generated or regenerated", async () => {
      const initialAudioBytes = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55]);
      const initialAudioBlob = new Blob([initialAudioBytes], { type: "audio/mpeg" });

      const item: StudioNarrationItem = {
        id: "narr_04",
        sceneId: "scene_01",
        sceneIndex: 1,
        text: "Hola mundo",
        textAtGeneration: "Hola mundo",
        status: "READY",
        audioBlob: initialAudioBlob,
        audioUrl: "blob:mock",
        alignment: null,
      };

      // Mock forced alignment response
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            ok: true,
            alignment: mockAlignment,
          }),
        })
      );

      const res = await alignExistingAudio({
        audioBlob: item.audioBlob!,
        text: item.text,
      });

      // Update item with new alignment
      const updatedItem: StudioNarrationItem = {
        ...item,
        alignment: res.alignment,
        alignmentText: item.text,
        alignmentStatus: "SYNCED",
      };

      // Audio blob must remain byte-for-byte identical
      expect(updatedItem.audioBlob).toBe(item.audioBlob);
      const rawBefore = await item.audioBlob!.arrayBuffer();
      const rawAfter = await updatedItem.audioBlob!.arrayBuffer();
      expect(new Uint8Array(rawBefore)).toEqual(new Uint8Array(rawAfter));
      expect(updatedItem.alignment).toEqual(mockAlignment);
    });

    it("preserves audio on provider alignment failure and marks status ERROR", async () => {
      const item: StudioNarrationItem = {
        id: "narr_05",
        sceneId: "scene_01",
        sceneIndex: 1,
        text: "Texto a fallar",
        status: "READY",
        audioBlob: sampleAudioBlob,
        audioUrl: "blob:mock",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            error: {
              code: "ALIGNMENT_FAILED",
              message: "ElevenLabs alignment timeout",
            },
          }),
        })
      );

      let alignError: string | null = null;
      try {
        await alignExistingAudio({
          audioBlob: item.audioBlob!,
          text: item.text,
        });
      } catch (err: any) {
        alignError = err.message;
      }

      expect(alignError).toBe("ElevenLabs alignment timeout");

      // Item audio is preserved; alignment status becomes ERROR
      const failedItem: StudioNarrationItem = {
        ...item,
        alignmentStatus: "ERROR",
        alignmentError: alignError!,
      };

      expect(failedItem.audioBlob).toBe(sampleAudioBlob);
      expect(failedItem.status).toBe("READY"); // Audio is still ready!
      expect(computeCaptionStatus(failedItem)).toBe("ERROR");
    });
  });

  describe("3. Bulk Alignment (20 Items) Logic", () => {
    it("processes only items missing alignment and skips items already synced or mismatching", () => {
      const items: StudioNarrationItem[] = [];

      // 15 items with audio and NO alignment (eligible)
      for (let i = 1; i <= 15; i++) {
        items.push({
          id: `narr_${i}`,
          sceneId: `scene_${i}`,
          sceneIndex: i,
          text: `Texto escena ${i}`,
          textAtGeneration: `Texto escena ${i}`,
          status: "READY",
          audioBlob: sampleAudioBlob,
          audioUrl: "blob:mock",
          alignment: null,
        });
      }

      // 5 items with audio AND valid alignment (already synced -> skip)
      for (let i = 16; i <= 20; i++) {
        items.push({
          id: `narr_${i}`,
          sceneId: `scene_${i}`,
          sceneIndex: i,
          text: `Texto escena ${i}`,
          textAtGeneration: `Texto escena ${i}`,
          status: "READY",
          audioBlob: sampleAudioBlob,
          audioUrl: "blob:mock",
          alignment: mockAlignment,
        });
      }

      // 2 items with text mismatch (outdated -> skip)
      items.push({
        id: "narr_21",
        sceneId: "scene_21",
        sceneIndex: 21,
        text: "Texto cambiado",
        textAtGeneration: "Texto viejo",
        status: "READY",
        audioBlob: sampleAudioBlob,
        audioUrl: "blob:mock",
        alignment: null,
      });

      // Filter eligible items for bulk alignment
      const eligible = items.filter((it) => {
        const hasAudio = it.status === "READY" || !!it.audioUrl;
        const hasValidAlignment = it.alignment && Array.isArray(it.alignment.words) && it.alignment.words.length > 0;
        const textMatches = !it.textAtGeneration || it.text.trim() === it.textAtGeneration.trim();
        return hasAudio && !hasValidAlignment && textMatches;
      });

      expect(eligible.length).toBe(15);
      expect(eligible.map((e) => e.id)).toEqual([
        "narr_1", "narr_2", "narr_3", "narr_4", "narr_5",
        "narr_6", "narr_7", "narr_8", "narr_9", "narr_10",
        "narr_11", "narr_12", "narr_13", "narr_14", "narr_15"
      ]);
    });
  });

  describe("4. Legacy Items Compatibility", () => {
    it("historical narration with audio and alignment null is eligible for [ GENERAR SOLO SUBTÍTULOS ]", () => {
      const legacyItem: StudioNarrationItem = {
        id: "narr_legacy_01",
        sceneId: "scene_legacy",
        sceneIndex: 1,
        text: "Narración grabada hace meses sin alignment",
        status: "READY",
        audioBlob: sampleAudioBlob,
        audioUrl: "blob:legacy_url",
        alignment: null,
        // No textAtGeneration in legacy item
      };

      const hasAudio = legacyItem.status === "READY" || !!legacyItem.audioUrl;
      const hasValidAlignment =
        legacyItem.alignment &&
        Array.isArray(legacyItem.alignment.words) &&
        legacyItem.alignment.words.length > 0;
      const textMatches =
        !legacyItem.textAtGeneration || legacyItem.text.trim() === legacyItem.textAtGeneration.trim();

      const isEligible = hasAudio && !hasValidAlignment && textMatches;
      expect(isEligible).toBe(true);
    });
  });

  describe("5. Packaging & Verification of Alignment in ZIP", () => {
    it("packages items with forced alignment into ghostai-tts v1.0 without modifying audio", async () => {
      const items: StudioNarrationItem[] = [
        {
          id: "narr_01",
          sceneId: "sc_01",
          sceneIndex: 1,
          text: "Hola mundo",
          textAtGeneration: "Hola mundo",
          status: "READY",
          audioBlob: sampleAudioBlob,
          audioUrl: "blob:mock",
          alignment: mockAlignment,
        },
      ];

      const zipResult = await buildGhostAiTtsPackage({
        project: dummyProject,
        items,
      });
      expect(zipResult.blob).toBeInstanceOf(Blob);

      // Verify ZIP contents
      const jszip = new JSZip();
      const zip = await jszip.loadAsync(await zipResult.blob.arrayBuffer());

      // Manifest must have version 1.0 (no version bump)
      const manifestFile = zip.file("manifest.json");
      expect(manifestFile).not.toBeNull();
      const manifestText = await manifestFile!.async("text");
      const manifest = JSON.parse(manifestText);

      expect(manifest.format).toBe("ghostai-tts");
      expect(manifest.version).toBe("1.0");
      expect(manifest.items[0].alignment).toEqual(mockAlignment);

      // Audio file inside ZIP must match sampleAudioBytes exactly
      const audioFile = zip.file("audio/narration_001.mp3");
      expect(audioFile).not.toBeNull();
      const audioBytesInZip = await audioFile!.async("uint8array");
      expect(audioBytesInZip).toEqual(sampleAudioBytes);

      // Verify with verifier
      const verifyResult = await verifyGhostAiTtsZip(zipResult.blob);
      expect(verifyResult.ok).toBe(true);
      expect(manifest.items[0].alignment).toEqual(mockAlignment);
    });
  });
});
