/**
 * @file tests/projectStorage.test.ts
 * Tests for GhostAI TTS Studio cross-tab session persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from "../src/services/projectStorage";
import type { GhostAiTtsProject, StudioNarrationItem } from "../src/types/tts";

describe("GhostAI TTS Studio: Project Storage (IndexedDB Service)", () => {
  let memoryStore: Record<string, unknown> = {};

  const mockBlob = new Blob(["mock-audio-data"], { type: "audio/mpeg" });
  const mockProject: GhostAiTtsProject = {
    name: "Proyecto Persistencia",
    exportedAt: "2026-10-07T14:00:00Z",
  };

  const mockItems: StudioNarrationItem[] = [
    {
      id: "item-1",
      sceneId: "scene-1",
      sceneIndex: 1,
      text: "Texto de narración de prueba",
      status: "READY",
      audioBlob: mockBlob,
      audioUrl: "blob:temporary-url",
      voiceId: "CaJslL1xziwefCeTNzHv",
      modelId: "eleven_multilingual_v2",
      duration: 2.5,
    },
  ];

  beforeEach(() => {
    memoryStore = {};

    // Mock indexedDB
    const fakeStore = {
      put: vi.fn((data) => {
        memoryStore[data.key] = data;
        const req = { onsuccess: null as (() => void) | null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
      get: vi.fn((key) => {
        const req = {
          result: memoryStore[key],
          onsuccess: null as (() => void) | null,
          onerror: null,
        };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
      delete: vi.fn((key) => {
        delete memoryStore[key];
        const req = { onsuccess: null as (() => void) | null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
    };

    const fakeTx = {
      objectStore: vi.fn(() => fakeStore),
    };

    const fakeDb = {
      transaction: vi.fn(() => fakeTx),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    };

    const fakeIndexedDB = {
      open: vi.fn(() => {
        const req = {
          result: fakeDb,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null,
        };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
    };

    Object.defineProperty(globalThis, "indexedDB", {
      value: fakeIndexedDB,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "window", {
      value: { indexedDB: fakeIndexedDB },
      configurable: true,
      writable: true,
    });

    URL.createObjectURL = vi.fn(() => "blob:restored-object-url");
  });

  afterEach(() => {
    delete (globalThis as unknown as { indexedDB?: unknown }).indexedDB;
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.restoreAllMocks();
  });

  it("saveActiveSession guarda proyecto y narraciones excluyendo audioUrl transitorio y sin secrets", async () => {
    await saveActiveSession(mockProject, mockItems);

    const saved = memoryStore["current_project_session"] as {
      project: GhostAiTtsProject;
      items: Array<{ id: string; audioUrl?: string; audioBlob?: Blob }>;
    };

    expect(saved).toBeDefined();
    expect(saved.project.name).toBe("Proyecto Persistencia");
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0].id).toBe("item-1");
    // audioUrl must have been stripped
    expect(saved.items[0].audioUrl).toBeUndefined();
    // audioBlob must be preserved
    expect(saved.items[0].audioBlob).toBe(mockBlob);

    // Verify absolutely no secrets exist in the saved payload
    const jsonStr = JSON.stringify(saved);
    expect(jsonStr).not.toContain("apiKey");
    expect(jsonStr).not.toContain("token");
    expect(jsonStr).not.toContain("elevenlabs");
  });

  it("loadActiveSession recrea URLs de objeto frescas para los Blobs de audio", async () => {
    await saveActiveSession(mockProject, mockItems);

    const restored = await loadActiveSession();
    expect(restored).not.toBeNull();
    expect(restored!.project.name).toBe("Proyecto Persistencia");
    expect(restored!.items).toHaveLength(1);
    expect(restored!.items[0].audioUrl).toBe("blob:restored-object-url");
    expect(restored!.items[0].status).toBe("READY");
    expect(restored!.items[0].audioBlob).toBe(mockBlob);
  });

  it("clearActiveSession elimina la sesión almacenada", async () => {
    await saveActiveSession(mockProject, mockItems);
    expect(memoryStore["current_project_session"]).toBeDefined();

    await clearActiveSession();
    expect(memoryStore["current_project_session"]).toBeUndefined();

    const empty = await loadActiveSession();
    expect(empty).toBeNull();
  });
});
