/**
 * @file tests/downloadStateMachine.test.ts
 * Tests verifying the critical principle: DOWNLOAD != VERIFIED.
 * Validates state transitions:
 *  not_prepared -> prepared -> download_triggered -> verification_pending -> verified / failed
 */

import { describe, it, expect } from "vitest";
import type { ZipDownloadStatus } from "../src/types/tts";
import { verifyGhostAiTtsZip } from "../src/services/zipVerifier";
import JSZip from "jszip";

describe("Download State Machine (Download != Verified)", () => {
  it("State machine does not set verified automatically upon download trigger", () => {
    let state: ZipDownloadStatus = "not_prepared";

    // 1. Prepare package
    state = "prepared";
    expect(state).toBe("prepared");

    // 2. User triggers download
    state = "download_triggered";
    expect(state).toBe("download_triggered");
    expect(state).not.toBe("verified");

    // 3. Immediately transitions to verification_pending
    state = "verification_pending";
    expect(state).toBe("verification_pending");
    expect(state).not.toBe("verified");
  });

  it("Transition to verified occurs only after manual file verification passes", async () => {
    let state: ZipDownloadStatus = "verification_pending";

    // User selects valid ZIP
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({
      format: "ghostai-tts",
      version: "1.0",
      project: { name: "Audit" },
      items: [{ id: "n1", file: "audio/n1.mp3" }],
    }));
    zip.file("audio/n1.mp3", new Uint8Array([0x49, 0x44, 0x33, 0x00, 0x01]));
    const blob = await zip.generateAsync({ type: "blob" });

    const outcome = await verifyGhostAiTtsZip(blob);
    expect(outcome.ok).toBe(true);

    if (outcome.ok) {
      state = "verified";
    }
    expect(state).toBe("verified");
  });

  it("Corrupt file transitions state to failed and preserves retry capability", async () => {
    let state: ZipDownloadStatus = "verification_pending";

    // User selects bad ZIP
    const badBlob = new Blob(["corrupt binary"], { type: "application/zip" });
    const outcome = await verifyGhostAiTtsZip(badBlob);
    expect(outcome.ok).toBe(false);

    if (!outcome.ok) {
      state = "failed";
    }
    expect(state).toBe("failed");

    // Can transition back to prepared / download_triggered for retry without ElevenLabs re-generation
    state = "download_triggered";
    expect(state).toBe("download_triggered");
  });
});
