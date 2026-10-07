/**
 * @file tests/zipVerifier.test.ts
 * Comprehensive test matrix for client-side ZIP verification.
 * Section 47: Valid, corrupt, missing manifest, malformed manifest, wrong format,
 * wrong version, duplicate narrationId, missing MP3, empty MP3, wrong item count,
 * hash mismatch, and valid recovered package.
 */

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { verifyGhostAiTtsZip, computeSha256 } from "../src/services/zipVerifier";

describe("ZIP Verifier Test Matrix", () => {
  // Helper to build a valid MP3 file buffer with ID3 header
  const makeValidMp3Buffer = (id = 1) => {
    return new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, id]);
  };

  const createBaseZip = async () => {
    const zip = new JSZip();
    const manifest = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Test Docu", exportedAt: new Date().toISOString() },
      items: [
        {
          id: "narr_001",
          sceneId: "scene_1",
          sceneIndex: 1,
          file: "audio/narration_001.mp3",
          voiceId: "voice-123",
          modelId: "eleven_multilingual_v2",
          duration: 3.5,
        },
        {
          id: "narr_002",
          sceneId: "scene_2",
          sceneIndex: 2,
          file: "audio/narration_002.mp3",
          voiceId: "voice-123",
          modelId: "eleven_multilingual_v2",
          duration: 4.1,
        },
      ],
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("audio/narration_001.mp3", makeValidMp3Buffer(1));
    zip.file("audio/narration_002.mp3", makeValidMp3Buffer(2));
    return zip;
  };

  it("1. Valid package verifies successfully", async () => {
    const zip = await createBaseZip();
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(true);
    expect(result.details?.format).toBe("ghostai-tts");
    expect(result.details?.version).toBe("1.0");
    expect(result.details?.totalItems).toBe(2);
    expect(result.details?.verifiedItems).toBe(2);
    expect(result.details?.packageSha256).toBeDefined();
  });

  it("2. Corrupt ZIP fails verification", async () => {
    const corruptBlob = new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03])], { type: "application/zip" });
    const result = await verifyGhostAiTtsZip(corruptBlob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("no es un archivo ZIP válido");
  });

  it("3. Missing manifest.json fails verification", async () => {
    const zip = new JSZip();
    zip.file("audio/test.mp3", makeValidMp3Buffer(1));
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("manifest.json");
  });

  it("4. Malformed manifest JSON fails verification", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "{ invalid json syntax ");
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("JSON inválida");
  });

  it("5. Wrong format fails verification", async () => {
    const zip = await createBaseZip();
    const manifest = {
      format: "other-format-not-ghostai",
      version: "1.0",
      project: { name: "P" },
      items: [{ id: "1", file: "audio/1.mp3" }],
    };
    zip.file("manifest.json", JSON.stringify(manifest));
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Formato de paquete incompatible");
  });

  it("6. Wrong version fails verification", async () => {
    const zip = await createBaseZip();
    const manifest = {
      format: "ghostai-tts",
      version: "2.5-beta",
      project: { name: "P" },
      items: [{ id: "1", file: "audio/1.mp3" }],
    };
    zip.file("manifest.json", JSON.stringify(manifest));
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Versión de paquete incompatible");
  });

  it("7. Duplicate narrationId in manifest fails verification", async () => {
    const zip = new JSZip();
    const manifest = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "P" },
      items: [
        { id: "dup_id", file: "audio/1.mp3" },
        { id: "dup_id", file: "audio/2.mp3" },
      ],
    };
    zip.file("manifest.json", JSON.stringify(manifest));
    zip.file("audio/1.mp3", makeValidMp3Buffer(1));
    zip.file("audio/2.mp3", makeValidMp3Buffer(2));
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("duplicados");
  });

  it("8. Missing declared audio file fails verification", async () => {
    const zip = new JSZip();
    const manifest = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "P" },
      items: [{ id: "narr_1", file: "audio/missing_narration.mp3" }],
    };
    zip.file("manifest.json", JSON.stringify(manifest));
    // Intentionally do not add audio/missing_narration.mp3
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("falta dentro del archivo ZIP");
  });

  it("9. Empty MP3 file (0 bytes) fails verification", async () => {
    const zip = new JSZip();
    const manifest = {
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "P" },
      items: [{ id: "narr_empty", file: "audio/empty.mp3" }],
    };
    zip.file("manifest.json", JSON.stringify(manifest));
    zip.file("audio/empty.mp3", new Uint8Array([])); // 0 bytes
    const blob = await zip.generateAsync({ type: "blob" });
    const result = await verifyGhostAiTtsZip(blob);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("0 bytes");
  });

  it("10. Wrong item count vs expected session fails verification", async () => {
    const zip = await createBaseZip(); // Contains 2 items
    const blob = await zip.generateAsync({ type: "blob" });

    const result = await verifyGhostAiTtsZip(blob, {
      itemCount: 5, // Expected 5 items
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cantidad de narraciones inconsistente");
  });

  it("11. Hash mismatch vs expected session fails verification", async () => {
    const zip = await createBaseZip();
    const blob = await zip.generateAsync({ type: "blob" });

    const result = await verifyGhostAiTtsZip(blob, {
      itemCount: 2,
      items: [
        { narrationId: "narr_001", sha256: "tampered_fake_sha256_hash_here_12345" },
        { narrationId: "narr_002", sha256: "another_hash" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Discrepancia de integridad SHA-256");
  });

  it("12. Valid package with matching SHA-256 hashes verifies successfully", async () => {
    const mp3Bytes1 = makeValidMp3Buffer(1);
    const mp3Bytes2 = makeValidMp3Buffer(2);

    const hash1 = await computeSha256(mp3Bytes1);
    const hash2 = await computeSha256(mp3Bytes2);

    const zip = await createBaseZip();
    const blob = await zip.generateAsync({ type: "blob" });

    const result = await verifyGhostAiTtsZip(blob, {
      itemCount: 2,
      items: [
        { narrationId: "narr_001", sha256: hash1 },
        { narrationId: "narr_002", sha256: hash2 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.details?.verifiedItems).toBe(2);
    expect(result.details?.itemHashesMatch).toBe(true);
  });
});
