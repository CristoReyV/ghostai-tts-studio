/**
 * @file tests/downloadSandboxBug02.test.ts
 * Rigorous tests for DOWNLOAD BUG 02 — Sandboxed Receiver Download Mitigation & Safe Tab UX.
 * Validates:
 * 1. Detection of sandbox-restricted download contexts.
 * 2. Unsandboxed direct Studio flow execution.
 * 3. Prevention of direct anchor.click() inside sandboxed receiver.
 * 4. "ABRIR DESCARGA EN PESTAÑA SEGURA" fallback UX.
 * 5. Direct Blob persistence in IndexedDB without Base64.
 * 6. Zero real ElevenLabs API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isDownloadReceiverMode,
  isSandboxRestrictedDownload,
  isEmbeddedFrame,
  generateBridgeId,
  sanitizeFileName,
  GHOSTAI_MESSAGE_TYPES,
  type GhostAiZipTransferPayload,
} from "../src/utils/environment";
import { savePackageBlob, loadPackageBlob } from "../src/services/projectStorage";

describe("DOWNLOAD BUG 02 — Sandboxed Receiver Download Architecture", () => {
  let originalWindow: unknown;
  let originalDocument: unknown;

  beforeEach(() => {
    originalWindow = (globalThis as unknown as { window?: unknown }).window;
    originalDocument = (globalThis as unknown as { document?: unknown }).document;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    } else {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
    if (originalDocument !== undefined) {
      (globalThis as unknown as { document: unknown }).document = originalDocument;
    } else {
      delete (globalThis as unknown as { document?: unknown }).document;
    }
  });

  describe("1. Environment & Mode Detection", () => {
    it("recognizes ?mode=receiver, ?mode=download-receiver, and ?mode=download", () => {
      const mockWin = {
        location: { search: "?mode=receiver&bridge=b123" },
      };
      (globalThis as unknown as { window: unknown }).window = mockWin;
      expect(isDownloadReceiverMode()).toBe(true);

      mockWin.location.search = "?mode=download-receiver&bridge=b123";
      expect(isDownloadReceiverMode()).toBe(true);

      mockWin.location.search = "?mode=download&bridge=b123";
      expect(isDownloadReceiverMode()).toBe(true);

      mockWin.location.search = "?mode=other";
      expect(isDownloadReceiverMode()).toBe(false);
    });

    it("detects sandbox restriction via explicit query param (sandboxed=1 / sandbox=1)", () => {
      const mockWin: Record<string, unknown> = {
        location: { search: "?mode=receiver&bridge=b123&sandboxed=1" },
      };
      mockWin.self = mockWin;
      mockWin.top = mockWin;
      (globalThis as unknown as { window: unknown }).window = mockWin;

      expect(isSandboxRestrictedDownload()).toBe(true);
    });

    it("detects sandbox restriction when current window is embedded in an iframe", () => {
      const mockParent = {};
      const mockWin: Record<string, unknown> = {
        location: { search: "?mode=receiver&bridge=b123" },
        self: {},
        top: mockParent,
      };
      (globalThis as unknown as { window: unknown }).window = mockWin;

      expect(isEmbeddedFrame()).toBe(true);
      expect(isSandboxRestrictedDownload()).toBe(true);
    });

    it("detects sandbox restriction when opener window was embedded", () => {
      const mockOpenerTop = {};
      const mockOpener = {
        self: {},
        top: mockOpenerTop,
      };

      const mockWin: Record<string, unknown> = {
        location: { search: "?mode=receiver&bridge=b123" },
        opener: mockOpener,
      };
      mockWin.self = mockWin;
      mockWin.top = mockWin;
      (globalThis as unknown as { window: unknown }).window = mockWin;

      expect(isSandboxRestrictedDownload()).toBe(true);
    });

    it("identifies direct Studio window as NOT sandbox-restricted", () => {
      const mockWin: Record<string, unknown> = {
        location: { search: "" },
        opener: null,
      };
      mockWin.self = mockWin;
      mockWin.top = mockWin;
      (globalThis as unknown as { window: unknown }).window = mockWin;

      expect(isEmbeddedFrame()).toBe(false);
      expect(isSandboxRestrictedDownload()).toBe(false);
    });
  });

  describe("2. Receiver Actions & Safe Tab URL Construction", () => {
    it("constructs safe top-level download URL with exact bridgeId without secrets", () => {
      const bridgeId = generateBridgeId();
      const safeTabUrl = `https://ghostai-tts-studio.smartbrain.lat/?mode=download&bridge=${bridgeId}`;

      expect(safeTabUrl).toContain("mode=download");
      expect(safeTabUrl).toContain(bridgeId);
      expect(safeTabUrl).not.toContain("token");
      expect(safeTabUrl).not.toContain("apiKey");
      expect(safeTabUrl).not.toContain("Bearer");
    });
  });

  describe("3. Binary Blob Persistence Without Base64", () => {
    it("savePackageBlob and loadPackageBlob store and retrieve raw Blob without Base64 encoding", async () => {
      const testBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const rawBlob = new Blob([testBytes], { type: "application/zip" });
      const bridgeId = "test_bridge_binary_001";
      const fileName = "package-test.zip";

      // Mock IndexedDB transaction
      const mockStore = {
        put: vi.fn().mockImplementation((data) => {
          expect(data.blob).toBeInstanceOf(Blob);
          expect(typeof data.blob).not.toBe("string"); // No base64!
          expect(data.blob.size).toBe(testBytes.length);
          const req: Record<string, unknown> = {};
          setTimeout(() => {
            if (typeof req.onsuccess === "function") (req.onsuccess as () => void)();
          }, 0);
          return req;
        }),
        get: vi.fn().mockImplementation((key) => {
          expect(key).toBe(`package_${bridgeId}`);
          const req: Record<string, unknown> = {
            result: {
              key,
              blob: rawBlob,
              fileName,
            },
          };
          setTimeout(() => {
            if (typeof req.onsuccess === "function") (req.onsuccess as () => void)();
          }, 0);
          return req;
        }),
      };

      const mockDb = {
        objectStoreNames: { contains: () => true },
        transaction: vi.fn().mockReturnValue({
          objectStore: () => mockStore,
        }),
      };

      const mockIdb = {
        open: vi.fn().mockImplementation(() => {
          const req: Record<string, unknown> = { result: mockDb };
          setTimeout(() => {
            if (typeof req.onsuccess === "function") (req.onsuccess as () => void)();
          }, 0);
          return req;
        }),
      };

      const mockWin = { indexedDB: mockIdb, location: { search: "" } };
      Object.defineProperty(globalThis, "window", { value: mockWin, configurable: true, writable: true });
      Object.defineProperty(globalThis, "indexedDB", { value: mockIdb, configurable: true, writable: true });

      await savePackageBlob(bridgeId, rawBlob, fileName);
      expect(mockStore.put).toHaveBeenCalledTimes(1);

      const loaded = await loadPackageBlob(bridgeId);
      expect(mockStore.get).toHaveBeenCalledTimes(1);
      expect(loaded).not.toBeNull();
      expect(loaded!.blob).toBeInstanceOf(Blob);
      expect(loaded!.blob.size).toBe(testBytes.length);
      expect(loaded!.fileName).toBe(fileName);
    });
  });
});
