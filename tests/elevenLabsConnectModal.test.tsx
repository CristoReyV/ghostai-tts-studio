/**
 * Hotfix: botón «CONECTAR ELEVENLABS». Pruebas sintéticas (sin navegador, sin ElevenLabs real, sin créditos).
 * El entorno no tiene jsdom: el clic se prueba invocando el onClick del árbol de elementos React.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionAlert } from "../src/components/ConnectionAlert";
import {
  ElevenLabsConnectModal,
  attemptConnect,
  classifyConnectError,
  CONNECT_PHASE_LABEL,
} from "../src/components/ElevenLabsConnectModal";
import { VoiceProviderSection } from "../src/components/VoiceProviderSection";
import { connectElevenLabs, TtsGatewayError } from "../src/services/gateway";

const SECRET = "sk_test_SECRET_KEY_1234567890";

function findByTestId(node: React.ReactNode, id: string): React.ReactElement<any> | null {
  if (!React.isValidElement(node)) return null;
  const el = node as React.ReactElement<any>;
  if (el.props?.["data-testid"] === id) return el;
  for (const k of React.Children.toArray(el.props?.children)) {
    const hit = findByTestId(k, id);
    if (hit) return hit;
  }
  return null;
}

afterEach(() => vi.unstubAllGlobals());

describe("clic en CONECTAR ELEVENLABS", () => {
  it("el botón dispara el handler (GhostAI conectado, ElevenLabs no)", () => {
    const onConnectElevenLabsClick = vi.fn();
    const tree = ConnectionAlert({
      isAuthenticated: true,
      isProviderConnected: false,
      onConnectGhostAIClick: vi.fn(),
      onConnectElevenLabsClick,
    });
    const btn = findByTestId(tree, "btn-connect-elevenlabs");
    expect(btn).not.toBeNull();
    btn!.props.onClick();
    expect(onConnectElevenLabsClick).toHaveBeenCalledTimes(1);
  });

  it("mantiene separados los estados de GhostAI y ElevenLabs", () => {
    const html = renderToStaticMarkup(
      <ConnectionAlert isAuthenticated isProviderConnected={false} clientName="GhostAI Owner" onConnectGhostAIClick={() => {}} onConnectElevenLabsClick={() => {}} />
    );
    expect(html).toContain("✓ Conectado");
    expect(html).toContain("Sin conectar");
    expect(html).toContain("CONECTAR ELEVENLABS");
  });

  it("con ambos conectados el banner se oculta", () => {
    expect(ConnectionAlert({ isAuthenticated: true, isProviderConnected: true, onConnectGhostAIClick: vi.fn(), onConnectElevenLabsClick: vi.fn() })).toBeNull();
  });
});

describe("modal: apertura/cierre y controles", () => {
  const base = { isAuthenticated: true, isProviderConnected: false, onClose: () => {}, onConnect: async () => ({ ok: true }) };

  it("cerrado no renderiza nada; abierto muestra el diálogo", () => {
    expect(renderToStaticMarkup(<ElevenLabsConnectModal {...base} isOpen={false} />)).toBe("");
    const html = renderToStaticMarkup(<ElevenLabsConnectModal {...base} isOpen />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Conectar ElevenLabs");
  });

  it("campo oculto, mostrar/ocultar, Conectar y Cancelar", () => {
    const html = renderToStaticMarkup(<ElevenLabsConnectModal {...base} isOpen />);
    expect(html).toMatch(/type="password"/);
    expect(html).toContain("Mostrar API key");
    expect(html).toContain("Conectar</button>");
    expect(html).toContain("Cancelar</button>");
    expect(html).toContain('autoComplete="off"');
  });

  it("con ElevenLabs conectado el modal permite cambiar la clave y desconectar", () => {
    const html = renderToStaticMarkup(<ElevenLabsConnectModal {...base} isProviderConnected onDisconnect={async () => {}} isOpen />);
    expect(html).toContain("Cambiar clave de ElevenLabs");
    expect(html).toContain("elevenlabs-modal-disconnect");
  });

  it("VoiceProviderSection conectado muestra ✓ Conectado, DESCONECTAR y CAMBIAR CLAVE", () => {
    const html = renderToStaticMarkup(
      <VoiceProviderSection isProviderConnected isAuthenticated onConnect={async () => ({ ok: true })} onDisconnect={async () => {}} onChangeKey={() => {}} />
    );
    expect(html).toContain("✓ Conectado");
    expect(html).toContain("DESCONECTAR");
    expect(html).toContain("CAMBIAR CLAVE");
  });
});

describe("validación con respuestas simuladas", () => {
  it("solo marca Conectado si onConnect confirma ok", async () => {
    expect(await attemptConnect(SECRET, true, async () => ({ ok: true }))).toEqual({ phase: "connected", detail: null });
    expect((await attemptConnect(SECRET, true, async () => ({ ok: false, message: "rechazada" }))).phase).toBe("invalid");
  });

  it("clave vacía o sin acceso GhostAI no llaman a la API", async () => {
    const onConnect = vi.fn();
    expect((await attemptConnect("   ", true, onConnect)).phase).toBe("invalid");
    expect((await attemptConnect(SECRET, false, onConnect)).phase).toBe("auth");
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("recorta la clave antes de enviarla", async () => {
    const onConnect = vi.fn().mockResolvedValue({ ok: true });
    await attemptConnect(`  ${SECRET}  `, true, onConnect);
    expect(onConnect).toHaveBeenCalledWith(SECRET);
  });

  const cases: Array<[Error, string]> = [
    [new TtsGatewayError("Clave rechazada", "ELEVENLABS_INVALID_API_KEY", 401), "invalid"],
    [new TtsGatewayError("Clave rechazada", "ELEVENLABS_INVALID_API_KEY", 400), "invalid"],
    [new TtsGatewayError("Error al verificar", "ELEVENLABS_NETWORK_ERROR", 502), "network"],
    [new TtsGatewayError("No configurado", "GATEWAY_NOT_CONFIGURED", 500), "unavailable"],
    [new TtsGatewayError("Acceso", "AUTH_REQUIRED", 401), "auth"],
    [new TtsGatewayError("x", "CONNECT_FAILED", 503), "unavailable"],
    [new TypeError("Failed to fetch"), "network"],
  ];
  it.each(cases)("clasifica %s", async (error, expected) => {
    expect(classifyConnectError(error)).toBe(expected);
    const r = await attemptConnect(SECRET, true, async () => {
      throw error;
    });
    expect(r.phase).toBe(expected);
    expect(CONNECT_PHASE_LABEL[r.phase]).not.toBe("");
  });

  it("etiquetas de estado requeridas", () => {
    expect(CONNECT_PHASE_LABEL.connecting).toBe("Conectando…");
    expect(CONNECT_PHASE_LABEL.connected).toBe("Conectado");
    expect(CONNECT_PHASE_LABEL.invalid).toBe("Clave inválida");
    expect(CONNECT_PHASE_LABEL.network).toBe("Error de conexión");
    expect(CONNECT_PHASE_LABEL.unavailable).toBe("Servicio no disponible");
  });

  it("connectElevenLabs sin acceso de operador no envía nada y no revela la clave", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const err = await connectElevenLabs(SECRET).catch((e) => e);
    expect(classifyConnectError(err)).toBe("auth");
    expect(String(err.message)).not.toContain(SECRET);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("seguridad de la clave", () => {
  it("el marcado del modal no contiene la clave", () => {
    const html = renderToStaticMarkup(<ElevenLabsConnectModal isOpen isAuthenticated isProviderConnected={false} onClose={() => {}} onConnect={async () => ({ ok: true })} />);
    expect(html).not.toContain(SECRET);
  });

  it("el modal no escribe en consola ni en almacenamiento", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../src/components/ElevenLabsConnectModal.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/console\.|localStorage|sessionStorage|indexedDB/);
  });

  it("el resultado de un error no incluye la clave", async () => {
    const r = await attemptConnect(SECRET, true, async () => {
      throw new TtsGatewayError("Clave rechazada", "ELEVENLABS_INVALID_API_KEY", 401);
    });
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });
});
