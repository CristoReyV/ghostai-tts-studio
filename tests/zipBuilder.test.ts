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
    expect(manifest.format).toBe("ghostai-tts");
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

  it("strictly enforces canonical manifest contract matching GhostAI importer (format: ghostai-tts, version: 1.0)", async () => {
    const singleReadyItem: StudioNarrationItem[] = [
      {
        id: "narr_scene1_001",
        sceneId: "scene_cliff_arrival",
        sceneIndex: 1,
        text: "Lia llegó al faro antes del anochecer.",
        voiceId: "CaJslL1xziwefCeTNzHv",
        modelId: "eleven_multilingual_v2",
        status: "READY",
        audioBlob: new Blob(["dummy-audio-content"], { type: "audio/mpeg" }),
        duration: 4.25,
        requestId: "req-contract-test-999",
      },
    ];

    const packageResult = await buildGhostAiTtsPackage({
      project: { name: "Lia y el Faro", exportedAt: "2026-10-05T12:00:00Z" },
      items: singleReadyItem,
      includeOnlyReady: true,
    });

    expect(packageResult.fileName).toBe("lia_y_el_faro-tts-package.zip");
    expect(packageResult.blob).toBeInstanceOf(Blob);

    // Open and inspect manifest.json inside the ZIP
    const zip = await JSZip.loadAsync(packageResult.blob);
    const manifestEntry = zip.file("manifest.json");
    expect(manifestEntry).not.toBeNull();

    const manifestContent = await manifestEntry!.async("string");
    const manifest = JSON.parse(manifestContent);

    // Strict contract assertions matching GhostAI importer:
    expect(manifest.format).toBe("ghostai-tts");
    expect(manifest.version).toBe("1.0");
    expect(manifest.project.name).toBe("Lia y el Faro");
    expect(manifest.generatedWith.provider).toBe("elevenlabs");
    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].id).toBe("narr_scene1_001");
    expect(manifest.items[0].sceneId).toBe("scene_cliff_arrival");
    expect(manifest.items[0].file).toBe("audio/narration_001.mp3");
    expect(manifest.items[0].voiceId).toBe("CaJslL1xziwefCeTNzHv");
    expect(manifest.items[0].modelId).toBe("eleven_multilingual_v2");
    expect(manifest.items[0].duration).toBe(4.25);
    expect(manifest.items[0].requestId).toBe("req-contract-test-999");
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
