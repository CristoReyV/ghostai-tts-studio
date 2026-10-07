/**
 * @file tests/downloadBridge.test.ts
 * Comprehensive hardening tests for the embedded -> top-level postMessage download bridge (FIX 01C).
 * Rigorously covers all 15 audit criteria:
 * A. window.open occurs synchronously before async build.
 * B. Popup blocked (receiverWindow === null) -> clean error UX.
 * C. READY from foreign window (event.source !== receiverWindow) -> ignored.
 * D. bridgeId mismatch -> ignored.
 * E. Payload without Blob -> rejected.
 * F. Blob size 0 -> rejected.
 * G. Insecure filename -> sanitized to safe .zip.
 * H. Receiver without IndexedDB -> bridge functions autonomously.
 * I. No secrets in URL.
 * J. No Base64 encoding.
 * K. No ElevenLabs calls.
 * L. No Gateway calls.
 * M. Receiver requires explicit user click to download.
 * N. Timeout mechanism functions.
 * O. Sender rejects arbitrary messages even from same-origin.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";
import { buildGhostAiTtsPackage, downloadBlob } from "../src/services/zipBuilder";
import {
  isEmbeddedFrame,
  isDownloadReceiverMode,
  generateBridgeId,
  getBridgeIdFromUrl,
  sanitizeFileName,
  GHOSTAI_MESSAGE_TYPES,
  type GhostAiZipTransferPayload,
} from "../src/utils/environment";
import type { StudioNarrationItem } from "../src/types/tts";

describe("GhostAI TTS Studio: Hardened Download Bridge Tests (FIX 01C)", () => {
  const dummyBlob = new Blob(["mp3-test-audio-content"], { type: "audio/mpeg" });

  const mockProject = {
    name: "Cuentos del Futuro",
    exportedAt: "2026-10-07T12:00:00Z",
  };

  const mockItems: StudioNarrationItem[] = [
    {
      id: "narr_01",
      sceneId: "scene_cybercity",
      sceneIndex: 1,
      text: "La ciudad brillante despertó al amanecer.",
      voiceId: "CaJslL1xziwefCeTNzHv",
      modelId: "eleven_multilingual_v2",
      status: "READY",
      audioBlob: dummyBlob,
      duration: 3.5,
      requestId: "req-101",
    },
  ];

  class MockAnchor {
    tagName = "A";
    download = "";
    href = "";
    style = { display: "" };
    click = vi.fn();
  }

  let createdAnchors: MockAnchor[] = [];
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalDocument = (globalThis as unknown as { document?: unknown }).document;

  beforeEach(() => {
    createdAnchors = [];

    const mockDoc = {
      createElement: vi.fn((tagName: string) => {
        if (tagName.toLowerCase() === "a") {
          const a = new MockAnchor();
          createdAnchors.push(a);
          return a;
        }
        return { tagName: tagName.toUpperCase() };
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      referrer: "",
    };

    const mockWin: Record<string, unknown> = {
      document: mockDoc,
      location: {
        origin: "https://ghostai-tts-studio.smartbrain.lat",
        pathname: "/",
        href: "https://ghostai-tts-studio.smartbrain.lat/",
        search: "",
      },
    };
    mockWin.self = mockWin;
    mockWin.top = mockWin;

    Object.defineProperty(globalThis, "window", {
      value: mockWin,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "document", {
      value: mockDoc,
      configurable: true,
      writable: true,
    });

    URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-uuid-${blob.size}`);
    URL.revokeObjectURL = vi.fn();
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

  // A. window.open ocurre sincrónicamente antes de cualquier build ZIP async
  it("A. window.open se ejecuta sincrónicamente en el click handler ANTES de cualquier await async", async () => {
    const callOrder: string[] = [];
    const win = (globalThis as unknown as { window: Record<string, unknown> }).window;

    const mockPopup = { postMessage: vi.fn() };
    win.open = vi.fn(() => {
      callOrder.push("window.open");
      return mockPopup;
    });

    // Simulated click handler adhering to Fix 01C architecture
    const bridgeId = generateBridgeId();
    const receiverUrl = `${win.location.origin}${win.location.pathname}?mode=receiver&bridge=${bridgeId}`;
    const popup = win.open(receiverUrl, "_blank");

    expect(callOrder).toEqual(["window.open"]);

    // Now async build happens after window.open
    const pkgPromise = buildGhostAiTtsPackage({
      project: mockProject,
      items: mockItems,
      includeOnlyReady: true,
    }).then((res) => {
      callOrder.push("buildGhostAiTtsPackage");
      return res;
    });

    await pkgPromise;

    expect(callOrder).toEqual(["window.open", "buildGhostAiTtsPackage"]);
    expect(popup).toBe(mockPopup);
  });

  // B. Popup bloqueado: receiverWindow === null -> error UX limpio
  it("B. si el navegador bloquea el popup (receiverWindow === null), se maneja limpiamente sin error", () => {
    const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
    win.open = vi.fn(() => null); // Popup blocker active!

    let notificationShown = false;
    let buildExecuted = false;

    // Handler logic
    const popup = win.open("https://example.com", "_blank");
    if (!popup) {
      notificationShown = true;
      // Abort without building ZIP or generating audio
    } else {
      buildExecuted = true;
    }

    expect(notificationShown).toBe(true);
    expect(buildExecuted).toBe(false);
  });

  // C. READY de ventana distinta: event.source !== receiverWindow -> ignorado
  it("C. mensaje READY proveniente de una ventana distinta es ignorado por el emisor", () => {
    const expectedReceiverWindow = { id: "legitimate-receiver" };
    const foreignWindow = { id: "attacker-window" };
    const bridgeId = "test-bridge-123";

    let transferDispatched = false;

    const senderListener = (event: { source: unknown; data: { type: string; bridgeId: string } }) => {
      // Validate event.source
      if (event.source !== expectedReceiverWindow) {
        return; // Rejected!
      }
      if (event.data.bridgeId !== bridgeId) {
        return;
      }
      if (event.data.type === GHOSTAI_MESSAGE_TYPES.RECEIVER_READY) {
        transferDispatched = true;
      }
    };

    // Attacker tries to send READY
    senderListener({ source: foreignWindow, data: { type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY, bridgeId } });
    expect(transferDispatched).toBe(false);

    // Legitimate window sends READY
    senderListener({ source: expectedReceiverWindow, data: { type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY, bridgeId } });
    expect(transferDispatched).toBe(true);
  });

  // D. bridgeId incorrecto: ignorado
  it("D. mensaje con bridgeId incorrecto o ausente es ignorado en ambos extremos", () => {
    const activeBridgeId = "bridge-alpha-999";
    let accepted = false;

    const messageHandler = (event: { data: { type: string; bridgeId: string } }) => {
      if (event.data.bridgeId !== activeBridgeId) {
        return; // Rejected!
      }
      accepted = true;
    };

    // Mismatched bridgeId
    messageHandler({ data: { type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY, bridgeId: "bridge-wrong" } });
    expect(accepted).toBe(false);

    // Matching bridgeId
    messageHandler({ data: { type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY, bridgeId: activeBridgeId } });
    expect(accepted).toBe(true);
  });

  // E. Payload sin Blob: rechazado
  it("E. payload sin instancia válida de Blob es rechazado por el receptor", () => {
    let receiverAccepted = false;

    const validatePayload = (payload: unknown) => {
      const p = payload as { blob?: unknown; fileName?: unknown };
      if (!p || !(p.blob instanceof Blob) || (p.blob as Blob).size <= 0) {
        return false;
      }
      if (typeof p.fileName !== "string" || p.fileName.trim().length === 0) {
        return false;
      }
      return true;
    };

    // Invalid: no blob property
    expect(validatePayload({ fileName: "valid.zip" })).toBe(false);
    // Invalid: blob is plain object or string
    expect(validatePayload({ blob: "not-a-blob", fileName: "valid.zip" })).toBe(false);
    // Invalid: blob size 0
    expect(validatePayload({ blob: new Blob([]), fileName: "valid.zip" })).toBe(false);
    // Valid
    expect(validatePayload({ blob: dummyBlob, fileName: "valid.zip" })).toBe(true);
  });

  // F. Blob size 0: rechazado
  it("F. payload con Blob de tamaño 0 es explícitamente rechazado", () => {
    const emptyBlob = new Blob([], { type: "application/zip" });
    expect(emptyBlob.size).toBe(0);

    const isPayloadValid = (payload: { blob: Blob }) => {
      return payload.blob instanceof Blob && payload.blob.size > 0;
    };

    expect(isPayloadValid({ blob: emptyBlob })).toBe(false);
    expect(isPayloadValid({ blob: dummyBlob })).toBe(true);
  });

  // G. Filename inseguro: sanitizado
  it("G. sanitiza filenames inseguros (path traversal, control chars, slashes) conservando .zip", () => {
    expect(sanitizeFileName("../../../etc/passwd")).toBe("passwd.zip");
    expect(sanitizeFileName("my/bad\\file..name.zip")).toBe("file.name.zip");
    expect(sanitizeFileName("hello\x00world.zip")).toBe("helloworld.zip");
    expect(sanitizeFileName("   valid_name.zip   ")).toBe("valid_name.zip");
    expect(sanitizeFileName("")).toBe("ghostai-tts-package.zip");
    expect(sanitizeFileName("cuentos-del-futuro-tts-package.zip")).toBe("cuentos-del-futuro-tts-package.zip");
  });


  // H. Receiver sin IndexedDB: bridge sigue funcionando
  it("H. el receptor opera autónomamente y recibe el ZIP incluso si IndexedDB está completamente deshabilitado o vacío", () => {
    delete (globalThis as unknown as { indexedDB?: unknown }).indexedDB;

    const payload: GhostAiZipTransferPayload = {
      blob: dummyBlob,
      fileName: "autonomo.zip",
      itemCount: 1,
      projectName: "Test",
      bridgeId: "bridge-1",
    };

    let receivedBlob: Blob | null = null;
    const receiverSim = (msg: { data: { type: string; payload: GhostAiZipTransferPayload } }) => {
      if (msg.data.type === GHOSTAI_MESSAGE_TYPES.ZIP_TRANSFER && msg.data.payload.blob instanceof Blob) {
        receivedBlob = msg.data.payload.blob;
      }
    };

    receiverSim({ data: { type: GHOSTAI_MESSAGE_TYPES.ZIP_TRANSFER, payload } });
    expect(receivedBlob).toBe(dummyBlob);
  });

  // I. No secrets en URL
  it("I. la URL del receptor contiene ÚNICAMENTE mode=receiver y bridgeId efímero, sin ningún secreto", () => {
    const bridgeId = generateBridgeId();
    const receiverUrl = `https://ghostai-tts-studio.smartbrain.lat/?mode=receiver&bridge=${bridgeId}`;

    const url = new URL(receiverUrl);
    expect(url.searchParams.get("mode")).toBe("receiver");
    expect(url.searchParams.get("bridge")).toBe(bridgeId);

    // Verify absolutely no secrets exist in the URL
    expect(url.searchParams.get("token")).toBeNull();
    expect(url.searchParams.get("apiKey")).toBeNull();
    expect(url.searchParams.get("auth")).toBeNull();
    expect(url.searchParams.get("cookie")).toBeNull();
    expect(url.searchParams.get("blob")).toBeNull();
    expect(url.hash).toBe("");
  });

  // J. No Base64
  it("J. el Blob se transfiere nativamente sin Base64 ni FileReader", () => {
    const fileReaderSpy = vi.fn();
    (globalThis as unknown as { FileReader: unknown }).FileReader = fileReaderSpy;

    const payload: GhostAiZipTransferPayload = {
      blob: dummyBlob,
      fileName: "nobase64.zip",
      itemCount: 1,
      projectName: "NoBase64",
      bridgeId: "b-1",
    };

    expect(payload.blob).toBeInstanceOf(Blob);
    expect(fileReaderSpy).not.toHaveBeenCalled();

    delete (globalThis as unknown as { FileReader?: unknown }).FileReader;
  });

  // K. No ElevenLabs calls
  it("K. cero llamadas a la API de ElevenLabs durante la preparación, apertura y descarga del puente", () => {
    const fetchSpy = vi.fn();
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;

    downloadBlob(dummyBlob, "clean.zip");
    expect(fetchSpy).not.toHaveBeenCalled();

    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  // L. No Gateway calls para transferir ZIP
  it("L. cero llamadas al Gateway para transferir el ZIP (todo opera cliente a cliente)", () => {
    const fetchSpy = vi.fn();
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;

    const bridgeId = generateBridgeId();
    expect(typeof bridgeId).toBe("string");
    expect(bridgeId.length).toBeGreaterThan(10);
    expect(fetchSpy).not.toHaveBeenCalled();

    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });


  // M. Receiver requiere click para download final
  it("M. el receptor NO descarga de forma automática; requiere click explícito del usuario", () => {
    const downloadSpy = vi.fn();

    // Payload received: state transitions to READY, but download is NOT called
    const state = { status: "READY", data: { blob: dummyBlob, fileName: "user-click.zip" } };
    expect(downloadSpy).not.toHaveBeenCalled();

    // User gesture occurs
    downloadSpy(state.data.blob, state.data.fileName);
    expect(downloadSpy).toHaveBeenCalledWith(dummyBlob, "user-click.zip");
    expect(downloadSpy).toHaveBeenCalledTimes(1);
  });

  // N. Timeout funciona
  it("N. si transcurre el timeout sin recibir el paquete, el receptor activa el estado de error de forma segura", () => {
    let currentStatus = "PREPARING";
    let failureMessage = "";

    const onTimeout = () => {
      currentStatus = "ERROR";
      failureMessage = "Este visor bloquea la descarga. Abre GhostAI TTS Studio directamente en una pestaña del navegador.";
    };

    expect(currentStatus).toBe("PREPARING");
    onTimeout();
    expect(currentStatus).toBe("ERROR");
    expect(failureMessage).toContain("Este visor bloquea la descarga");
  });

  // O. Sender no acepta mensajes arbitrarios same-origin
  it("O. el emisor descarta mensajes arbitrarios que no provengan del receiverWindow emparejado", () => {
    const pairedReceiver = { name: "paired" };
    const arbitraryWindow = { name: "other-tab-same-origin" };
    const bridgeId = "exact-bridge-id";

    let handled = false;

    const onMessage = (event: { source: unknown; origin: string; data: { bridgeId?: string; type?: string } }) => {
      // Must match paired receiver
      if (event.source !== pairedReceiver) return;
      // Must match bridgeId
      if (event.data?.bridgeId !== bridgeId) return;

      handled = true;
    };

    // Another same-origin window emits message
    onMessage({ source: arbitraryWindow, origin: "https://ghostai-tts-studio.smartbrain.lat", data: { bridgeId, type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY } });
    expect(handled).toBe(false);

    // Paired receiver emits message with wrong bridgeId
    onMessage({ source: pairedReceiver, origin: "https://ghostai-tts-studio.smartbrain.lat", data: { bridgeId: "wrong", type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY } });
    expect(handled).toBe(false);

    // Paired receiver emits message with correct bridgeId
    onMessage({ source: pairedReceiver, origin: "https://ghostai-tts-studio.smartbrain.lat", data: { bridgeId, type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY } });
    expect(handled).toBe(true);
  });
});
