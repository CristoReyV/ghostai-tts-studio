/**
 * @file tests/e2e-live-simulation.ts
 * Real end-to-end test validating the complete round-trip flow:
 * GhostAI Export -> Parser -> Live Gateway Audio Generation -> Zip Packaging -> Manifest Verification
 */

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseGhostAiTtsJson } from "../src/services/parser";
import { SAMPLE_GHOSTAI_PROJECT } from "../src/sampleData";
import { buildGhostAiTtsPackage } from "../src/services/zipBuilder";

describe("E2E Live Flow Simulation", () => {
  it("executes the entire round-trip from .ghostai-tts.json to .ghostai-tts-package.zip", async () => {
    // 1. Input parsing
    const parseResult = parseGhostAiTtsJson(SAMPLE_GHOSTAI_PROJECT);
    expect(parseResult.success).toBe(true);
    expect(parseResult.studioItems).toBeDefined();

    const items = parseResult.studioItems!;
    expect(items).toHaveLength(3);

    // 2. Simulate live sequential generation with first item against certified Gateway
    const itemToTest = items[0];
    const gatewayUrl = "https://tts-test.smartbrain.lat/api/tts/generate";

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "elevenlabs",
        voiceId: itemToTest.voiceId || "CwhRBWXzGAHq8TQ4Fs17",
        text: itemToTest.text,
        modelId: itemToTest.modelId || "eleven_multilingual_v2",
        outputFormat: itemToTest.outputFormat || "mp3_44100_128",
      }),
    });

    expect(response.status).toBe(200);
    const audioBlob = await response.blob();
    expect(audioBlob.size).toBeGreaterThan(10000); // Real MP3 audio

    const requestId = response.headers.get("X-TTS-Request-ID") || "req-test-live";

    // Update item status to READY
    itemToTest.status = "READY";
    itemToTest.audioBlob = audioBlob;
    itemToTest.requestId = requestId;
    itemToTest.duration = 4.2;

    // Simulate item 2 with mock blob
    items[1].status = "READY";
    items[1].audioBlob = new Blob(["mock-mp3-2"], { type: "audio/mpeg" });
    items[1].requestId = "req-mock-2";
    items[1].duration = 3.8;

    // Item 3 remains PENDING / CANCELLED to test partial result export
    items[2].status = "CANCELLED";

    // 3. Build GhostAI package zip (exporting current ready results)
    const zipResult = await buildGhostAiTtsPackage({
      project: parseResult.data!.project,
      items: items,
      includeOnlyReady: true,
    });

    expect(zipResult.itemCount).toBe(2);
    expect(zipResult.blob.size).toBeGreaterThan(10000);

    // 4. Verify ZIP content and manifest
    const zip = await JSZip.loadAsync(zipResult.blob);
    const manifestFile = zip.file("manifest.json");
    expect(manifestFile).not.toBeNull();

    const manifestText = await manifestFile!.async("string");
    const manifest = JSON.parse(manifestText);

    expect(manifest.format).toBe("ghostai-tts-package");
    expect(manifest.version).toBe("1.0");
    expect(manifest.project.name).toBe("Lia y el Faro Encantado");
    expect(manifest.generatedWith.provider).toBe("elevenlabs");
    expect(manifest.items).toHaveLength(2);

    // Item 1 verification
    expect(manifest.items[0].id).toBe("narr_scene1_001");
    expect(manifest.items[0].sceneId).toBe("scene_cliff_arrival");
    expect(manifest.items[0].file).toBe("audio/narration_001.mp3");
    expect(manifest.items[0].requestId).toBe(requestId);

    // Item 2 verification
    expect(manifest.items[1].id).toBe("narr_scene2_002");
    expect(manifest.items[1].file).toBe("audio/narration_002.mp3");

    // Audio files in zip verification
    expect(zip.file("audio/narration_001.mp3")).not.toBeNull();
    expect(zip.file("audio/narration_002.mp3")).not.toBeNull();
    expect(zip.file("audio/narration_003.mp3")).toBeNull();
  }, 30000);
});
