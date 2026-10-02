/**
 * @file tests/zipBuilder.test.ts
 * Unit tests for GhostAI TTS Package ZIP generator.
 */

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildGhostAiTtsPackage } from "../src/services/zipBuilder";
import type { StudioNarrationItem } from "../src/types/tts";

describe("buildGhostAiTtsPackage", () => {
  const dummyBlob1 = new Blob(["mp3-data-1"], { type: "audio/mpeg" });
  const dummyBlob2 = new Blob(["mp3-data-2"], { type: "audio/mpeg" });

  const mockProject = {
    name: "Cuentos del Mar",
    exportedAt: "2026-10-02T15:00:00Z",
  };

  const mockItems: StudioNarrationItem[] = [
    {
      id: "narr_01",
      sceneId: "scene_dock",
      sceneIndex: 1,
      text: "El barco zarpó a medianoche.",
      voiceId: "voice-123",
      modelId: "eleven_multilingual_v2",
      status: "READY",
      audioBlob: dummyBlob1,
      duration: 3.5,
      requestId: "req-001",
      customMeta: "marina",
    },
    {
      id: "narr_02",
      sceneId: "scene_storm",
      sceneIndex: 2,
      text: "Las olas rugían con fuerza.",
      voiceId: "voice-456",
      modelId: "eleven_multilingual_v2",
      status: "READY",
      audioBlob: dummyBlob2,
      duration: 4.1,
      requestId: "req-002",
      customMeta: "tormenta",
    },
    {
      id: "narr_03",
      sceneId: "scene_haven",
      sceneIndex: 3,
      text: "Por fin amaneció en la costa.",
      status: "PENDING", // Not ready!
    },
  ];

  it("builds valid zip with manifest.json and audio files for ready items only", async () => {
    const result = await buildGhostAiTtsPackage({
      project: mockProject,
      items: mockItems,
      includeOnlyReady: true,
    });

    expect(result.itemCount).toBe(2);
    expect(result.fileName).toContain("cuentos_del_mar-tts-package.zip");
    expect(result.blob).toBeInstanceOf(Blob);

    // Read back zip with JSZip to verify structure
    const zip = await JSZip.loadAsync(result.blob);
    expect(zip.file("manifest.json")).not.toBeNull();
    expect(zip.file("audio/narration_001.mp3")).not.toBeNull();
    expect(zip.file("audio/narration_002.mp3")).not.toBeNull();
    expect(zip.file("audio/narration_003.mp3")).toBeNull();

    // Verify manifest contents
    const manifestJson = await zip.file("manifest.json")?.async("string");
    expect(manifestJson).toBeDefined();

    const manifest = JSON.parse(manifestJson!);
    expect(manifest.format).toBe("ghostai-tts-package");
    expect(manifest.version).toBe("1.0");
    expect(manifest.project.name).toBe("Cuentos del Mar");
    expect(manifest.generatedWith.provider).toBe("elevenlabs");
    expect(manifest.items).toHaveLength(2);

    expect(manifest.items[0].id).toBe("narr_01");
    expect(manifest.items[0].file).toBe("audio/narration_001.mp3");
    expect(manifest.items[0].duration).toBe(3.5);
    expect(manifest.items[0].requestId).toBe("req-001");
    expect(manifest.items[0].customMeta).toBe("marina"); // Preserved metadata!

    expect(manifest.items[1].id).toBe("narr_02");
    expect(manifest.items[1].file).toBe("audio/narration_002.mp3");
    expect(manifest.items[1].customMeta).toBe("tormenta");
  });

  it("throws error if no items are ready to export", async () => {
    await expect(
      buildGhostAiTtsPackage({
        project: mockProject,
        items: [
          {
            id: "narr_01",
            sceneId: "s1",
            sceneIndex: 1,
            text: "Texto",
            status: "PENDING",
          },
        ],
        includeOnlyReady: true,
      })
    ).rejects.toThrow("No hay narraciones generadas listas");
  });
});
