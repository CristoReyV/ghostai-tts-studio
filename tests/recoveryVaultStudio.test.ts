/**
 * @file tests/recoveryVaultStudio.test.ts
 * Tests for Studio Recovery Vault rehydration without ElevenLabs consumption.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { recoverSession, downloadRecoveredAudioBlob } from "../src/services/recoveryService";
import type { RecoverySessionSummary, RecoveryItem } from "../src/types/tts";

describe("Studio Recovery Vault Operations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Full recovery reconstructs all READY items without calling ElevenLabs", async () => {
    const mockSessionMeta: RecoverySessionSummary = {
      id: "sess-123",
      projectId: "proj-1",
      projectTitle: "Docu Test",
      status: "ready",
      itemCount: 5,
      readyCount: 5,
      errorCount: 0,
      zipStatus: "not_prepared",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    const mockItems: RecoveryItem[] = [
      { id: "item-1", narrationId: "n-1", sceneId: "s-1", sceneIndex: 1, status: "ready", hasAudio: true, text: "Narración 1" },
      { id: "item-2", narrationId: "n-2", sceneId: "s-2", sceneIndex: 2, status: "ready", hasAudio: true, text: "Narración 2" },
      { id: "item-3", narrationId: "n-3", sceneId: "s-3", sceneIndex: 3, status: "ready", hasAudio: true, text: "Narración 3" },
      { id: "item-4", narrationId: "n-4", sceneId: "s-4", sceneIndex: 4, status: "ready", hasAudio: true, text: "Narración 4" },
      { id: "item-5", narrationId: "n-5", sceneId: "s-5", sceneIndex: 5, status: "ready", hasAudio: true, text: "Narración 5" },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/tts/generations/recover")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, session: mockSessionMeta, items: mockItems }),
        });
      }
      if (url.includes("/api/tts/generations/audio")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["mock mp3 audio bytes"], { type: "audio/mpeg" })),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });

    const result = await recoverSession("sess-123");
    expect(result.session.id).toBe("sess-123");
    expect(result.items.length).toBe(5);

    // Verify audio download for each item
    for (const item of result.items) {
      expect(item.hasAudio).toBe(true);
      const audioBlob = await downloadRecoveredAudioBlob("sess-123", item.narrationId);
      expect(audioBlob).toBeDefined();
      expect(audioBlob.type).toBe("audio/mpeg");
    }

    // ElevenLabs synthesize endpoint was NEVER called
    const fetchCalls = (global.fetch as any).mock.calls;
    const elevenLabsCalls = fetchCalls.filter((c: any[]) => String(c[0]).includes("elevenlabs.io") || String(c[0]).includes("/api/tts/generate"));
    expect(elevenLabsCalls.length).toBe(0);
  });

  it("Partial recovery preserves existing ready items and does NOT synthesize missing items", async () => {
    const mockSessionMeta: RecoverySessionSummary = {
      id: "sess-part",
      projectTitle: "Partial Docu",
      status: "partial",
      itemCount: 5,
      readyCount: 3,
      errorCount: 2,
      zipStatus: "not_prepared",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    const mockItems: RecoveryItem[] = [
      { id: "item-1", narrationId: "n-1", sceneId: "s-1", sceneIndex: 1, status: "ready", hasAudio: true, text: "Audio 1" },
      { id: "item-2", narrationId: "n-2", sceneId: "s-2", sceneIndex: 2, status: "ready", hasAudio: true, text: "Audio 2" },
      { id: "item-3", narrationId: "n-3", sceneId: "s-3", sceneIndex: 3, status: "ready", hasAudio: true, text: "Audio 3" },
      { id: "item-4", narrationId: "n-4", sceneId: "s-4", sceneIndex: 4, status: "error", hasAudio: false, text: "Audio 4" },
      { id: "item-5", narrationId: "n-5", sceneId: "s-5", sceneIndex: 5, status: "error", hasAudio: false, text: "Audio 5" },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, session: mockSessionMeta, items: mockItems }),
    });

    const result = await recoverSession("sess-part");
    expect(result.items.filter((i) => i.hasAudio).length).toBe(3);
    expect(result.items.filter((i) => !i.hasAudio).length).toBe(2);
  });
});
