/**
 * @file tests/zipDownload.test.ts
 * Rigorous tests for ZIP generation, download helper, embedded sandbox detection,
 * and safe top-level fallback mechanism. Runs cleanly in Node vitest environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";
import { buildGhostAiTtsPackage, downloadBlob, triggerBlobDownload } from "../src/services/zipBuilder";
import { isEmbeddedFrame, getFrameAuditInfo } from "../src/utils/environment";
import type { StudioNarrationItem } from "../src/types/tts";

describe("GhostAI TTS Studio — Download & Sandbox Audit Tests", () => {
  const dummyBlob1 = new Blob(["mp3-audio-bytes-1"], { type: "audio/mpeg" });
  const dummyBlob2 = new Blob(["mp3-audio-bytes-2"], { type: "audio/mpeg" });

  const mockProject = {
    name: "Aventura Espacial",
    exportedAt: "2026-10-07T12:00:00Z",
  };

  const mockReadyItems: StudioNarrationItem[] = [
    {
      id: "narr_01",
      sceneId: "scene_launch",
      sceneIndex: 1,
      text: "La nave espacial despegó hacia la órbita terrestre.",
      voiceId: "voice-astro-1",
      modelId: "eleven_multilingual_v2",
      status: "READY",
      audioBlob: dummyBlob1,
      duration: 3.2,
      requestId: "req-001",
    },
    {
      id: "narr_02",
      sceneId: "scene_orbit",
      sceneIndex: 2,
      text: "Mirando hacia la Tierra desde la cúpula de observación.",
      voiceId: "voice-astro-2",
      modelId: "eleven_multilingual_v2",
      status: "READY",
      audioBlob: dummyBlob2,
      duration: 4.0,
      requestId: "req-002",
    },
  ];

  class MockAnchorElement {
    tagName = "A";
    download = "";
    href = "";
    style = { display: "" };
    click = vi.fn();
  }

  let createdElements: MockAnchorElement[] = [];
  let appendedElements: unknown[] = [];
  let removedElements: unknown[] = [];

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalDocument = (globalThis as unknown as { document?: unknown }).document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    createdElements = [];
    appendedElements = [];
    removedElements = [];

    const mockDocument = {
      createElement: vi.fn((tagName: string) => {
        if (tagName.toLowerCase() === "a") {
          const el = new MockAnchorElement();
          createdElements.push(el);
          return el;
        }
        return { tagName: tagName.toUpperCase() };
      }),
      body: {
        appendChild: vi.fn((el) => appendedElements.push(el)),
        removeChild: vi.fn((el) => removedElements.push(el)),
      },
      referrer: "https://parent.example.com",
    };

    const mockWindow: Record<string, unknown> = {
      document: mockDocument,
    };
    mockWindow.self = mockWindow;
    mockWindow.top = mockWindow;

    Object.defineProperty(globalThis, "window", {
      value: mockWindow,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "document", {
      value: mockDocument,
      configurable: true,
      writable: true,
    });

    URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${blob.size}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

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

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  // 1. ZIP disponible genera Blob
  it("ZIP disponible genera Blob binario válido con tamaño > 0", async () => {
    const result = await buildGhostAiTtsPackage({
      project: mockProject,
      items: mockReadyItems,
      includeOnlyReady: true,
    });

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.itemCount).toBe(2);

    const zip = await JSZip.loadAsync(result.blob);
    expect(zip.file("manifest.json")).not.toBeNull();
    expect(zip.file("audio/narration_001.mp3")).not.toBeNull();
    expect(zip.file("audio/narration_002.mp3")).not.toBeNull();
  });

  // 2. Filename correcto
  it("genera filename estructurado y normalizado según contrato GhostAI", async () => {
    const result = await buildGhostAiTtsPackage({
      project: mockProject,
      items: mockReadyItems,
      includeOnlyReady: true,
    });

    expect(result.fileName).toBe("aventura_espacial-tts-package.zip");
  });

  // 3. Download helper crea anchor con download
  it("downloadBlob crea un elemento anchor <a> con atributo download y href blob:", () => {
    downloadBlob(dummyBlob1, "prueba-descarga.zip");

    expect((document as unknown as { createElement: ReturnType<typeof vi.fn> }).createElement).toHaveBeenCalledWith("a");
    expect(URL.createObjectURL).toHaveBeenCalledWith(dummyBlob1);

    expect(createdElements.length).toBe(1);
    const anchor = createdElements[0];
    expect(anchor.download).toBe("prueba-descarga.zip");
    expect(anchor.href).toMatch(/^blob:mock-url-/);
    expect(anchor.style.display).toBe("none");

    expect(appendedElements).toContain(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(removedElements).toContain(anchor);
  });

  // 4. Object URL se revoca después (no antes del click)
  it("URL.revokeObjectURL se ejecuta DESPUÉS del click mediante setTimeout", () => {
    vi.useFakeTimers();

    downloadBlob(dummyBlob1, "timing.zip");

    // Before timer advances: must NOT have been called
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // Advance 15000ms
    vi.advanceTimersByTime(15000);

    // After timer advances: must have been called
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:mock-url-${dummyBlob1.size}`);
  });

  // 5. No iframe oculto
  it("NO utiliza ningún iframe oculto para iniciar la descarga", () => {
    downloadBlob(dummyBlob1, "no-iframe.zip");

    const createElementMock = (document as unknown as { createElement: ReturnType<typeof vi.fn> }).createElement;
    expect(createElementMock).not.toHaveBeenCalledWith("iframe");
  });

  // 6. No Base64 innecesario
  it("NO convierte el Blob a Base64 ni utiliza FileReader para la descarga", () => {
    const fileReaderMock = vi.fn();
    (globalThis as unknown as { FileReader: unknown }).FileReader = fileReaderMock;

    downloadBlob(dummyBlob1, "no-base64.zip");

    expect(fileReaderMock).not.toHaveBeenCalled();
    delete (globalThis as unknown as { FileReader?: unknown }).FileReader;
  });

  // 7. Backward compatibility: triggerBlobDownload es alias de downloadBlob
  it("triggerBlobDownload actúa exactamente igual que downloadBlob", () => {
    expect(triggerBlobDownload).toBe(downloadBlob);
  });

  // 8. Detección de embedded context
  it("isEmbeddedFrame retorna false en contexto top-level (window.top === window.self)", () => {
    expect(isEmbeddedFrame()).toBe(false);

    const audit = getFrameAuditInfo();
    expect(audit.isEmbedded).toBe(false);
    expect(audit.isTopLevel).toBe(true);
  });

  it("isEmbeddedFrame retorna true cuando window.top !== window.self (iframe/preview)", () => {
    const currentWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    currentWindow.top = { id: "parent-frame" };

    expect(isEmbeddedFrame()).toBe(true);

    const audit = getFrameAuditInfo();
    expect(audit.isEmbedded).toBe(true);
    expect(audit.isTopLevel).toBe(false);
  });

  it("isEmbeddedFrame captura SecurityError en frame cross-origin y retorna true", () => {
    const currentWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    Object.defineProperty(currentWindow, "top", {
      get() {
        throw new Error("SecurityError: Blocked a frame with origin from accessing a cross-origin frame.");
      },
      configurable: true,
    });

    expect(isEmbeddedFrame()).toBe(true);
  });

  // 9. Fallback "Abrir en pestaña nueva" solo cuando corresponda
  it("en entorno embebido el flujo identifica frame embebido para activar el fallback seguro", () => {
    const currentWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    currentWindow.top = { id: "external-wrapper" };

    expect(isEmbeddedFrame()).toBe(true);

    const audit = getFrameAuditInfo();
    expect(audit.isEmbedded).toBe(true);
    expect(audit.isTopLevel).toBe(false);
  });
});
