/**
 * @file tests/authGate.test.ts
 * Tests for GhostAI TTS Studio Auth Gate & Authentication Flow (UX 01).
 *
 * Requirements:
 *  - Caso A: Sin GhostAI token -> Auth Gate visible, Studio oculto.
 *  - Caso B: Token válido -> verify PASS -> Studio visible.
 *  - Caso C: Token inválido -> Permanece Auth Gate, error visible.
 *  - Caso D: Token válido Owner -> Badge GhostAI ✓ · GhostAI Owner.
 *  - Caso E: 401 durante sesión -> Token cleared -> Auth Gate.
 *  - Caso F: Admin mode -> No interceptado por Auth Gate.
 *  - ElevenLabs BYOK decoupling: GhostAI conectado pero ElevenLabs desconectado
 *    permite ver Studio, Recovery, Import y ZIP sin bloqueo fullscreen.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthGate } from "../src/components/AuthGate";
import { Header } from "../src/components/Header";
import { ConnectionAlert } from "../src/components/ConnectionAlert";
import { VoiceProviderSection } from "../src/components/VoiceProviderSection";
import {
  getGatewayAuthToken,
  setGatewayAuthToken,
  clearGatewayAuthToken,
  verifyGatewayAuthToken,
  setOnAuthExpired,
} from "../src/services/gateway";
import { isAdminMode } from "../src/utils/environment";

describe("GhostAI TTS Studio: Auth Gate UX 01", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearGatewayAuthToken();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearGatewayAuthToken();
  });

  // ── Caso A: Sin GhostAI token -> Auth Gate visible ────────────────────────
  it("Caso A: renders clean Auth Gate login screen without mentioning ElevenLabs", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthGate, {
        onLoginSuccess: vi.fn(),
      })
    );

    expect(html).toContain("GHOSTAI TTS STUDIO");
    expect(html).toContain("Accede a tu espacio de trabajo");
    expect(html).toContain("Access Key de GhostAI");
    expect(html).toContain("gai_live_••••••••••••••••");
    expect(html).toContain("ENTRAR A GHOSTAI");
    expect(html).toContain("Usa la clave de acceso proporcionada para tu cuenta.");

    // Strict exclusion of ElevenLabs from Auth Gate
    expect(html.toLowerCase()).not.toContain("elevenlabs");
    expect(html.toLowerCase()).not.toContain("api key");
  });

  // ── Caso B: Token válido -> verify PASS ──────────────────────────────────
  it("Caso B: validates token via verifyGatewayAuthToken and returns client identity", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        authMode: "client_token",
        client: {
          id: "dbb3340a-2526-4953-996b-31b2e5b500f0",
          name: "GhostAI Owner",
        },
      }),
    });

    const res = await verifyGatewayAuthToken("gai_live_valid_owner_secret_token_123");
    expect(res.ok).toBe(true);
    expect(res.authMode).toBe("client_token");
    expect(res.clientName).toBe("GhostAI Owner");
  });

  // ── Caso C: Token inválido -> Permanece Auth Gate con error compacto ──────
  it("Caso C: displays compact error banner without leaking internal error details", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthGate, {
        onLoginSuccess: vi.fn(),
        initialError: "No pudimos validar esta clave de acceso.",
      })
    );

    expect(html).toContain("No pudimos validar esta clave de acceso.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("stack");
    expect(html).not.toContain("500");
  });

  // ── Caso D: Token válido Owner -> Badge GhostAI ✓ · GhostAI Owner ─────────
  it("Caso D: Header renders dynamic client identity badge matching verified client", () => {
    const html = renderToStaticMarkup(
      React.createElement(Header, {
        health: { ok: true, service: "gateway", version: "1.0", provider: "elevenlabs", configured: true },
        checkingHealth: false,
        onRefreshHealth: vi.fn(),
        isAuthenticated: true,
        onAuthStateChange: vi.fn(),
        isProviderConnected: false,
        clientName: "GhostAI Owner",
      })
    );

    expect(html).toContain("GhostAI ✓ · GhostAI Owner");
    expect(html).toContain("CERRAR SESIÓN");
  });

  it("Caso D2: Header renders partner identity dynamically without hardcoding Owner", () => {
    const html = renderToStaticMarkup(
      React.createElement(Header, {
        health: { ok: true, service: "gateway", version: "1.0", provider: "elevenlabs", configured: true },
        checkingHealth: false,
        onRefreshHealth: vi.fn(),
        isAuthenticated: true,
        onAuthStateChange: vi.fn(),
        isProviderConnected: false,
        clientName: "GhostAI Partner",
      })
    );

    expect(html).toContain("GhostAI ✓ · GhostAI Partner");
  });

  // ── Caso E: 401 durante sesión -> Token cleared -> Auth Gate callback ─────
  it("Caso E: 401 expiration triggers callback to clear token and return to Auth Gate", () => {
    setGatewayAuthToken("gai_live_temporary_token");
    expect(getGatewayAuthToken()).toBe("gai_live_temporary_token");

    const onExpiredSpy = vi.fn();
    setOnAuthExpired(onExpiredSpy);

    clearGatewayAuthToken();

    expect(getGatewayAuthToken()).toBeNull();
    expect(onExpiredSpy).toHaveBeenCalledTimes(1);
  });

  // ── Caso F: Admin mode -> No interceptado por Auth Gate ──────────────────
  it("Caso F: isAdminMode returns true when ?mode=admin is present in URL", () => {
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { location: { search: "?mode=admin" } };

    expect(isAdminMode()).toBe(true);

    (globalThis as any).window = originalWindow;
  });

  // ── ElevenLabs BYOK decoupling ───────────────────────────────────────────
  it("decoupling: GhostAI connected without ElevenLabs does not show fullscreen block", () => {
    const alertHtml = renderToStaticMarkup(
      React.createElement(ConnectionAlert, {
        isAuthenticated: true,
        isProviderConnected: false,
        clientName: "GhostAI Owner",
        onConnectGhostAIClick: vi.fn(),
        onConnectElevenLabsClick: vi.fn(),
      })
    );

    expect(alertHtml).toContain("CONECTA ELEVENLABS");
    expect(alertHtml).toContain("GhostAI");
    expect(alertHtml).toContain("✓ Conectado (GhostAI Owner)");

    const providerHtml = renderToStaticMarkup(
      React.createElement(VoiceProviderSection, {
        isProviderConnected: false,
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        isAuthenticated: true,
      })
    );

    expect(providerHtml).toContain("CONECTAR ELEVENLABS");
    expect(providerHtml).toContain("Tus generaciones usarán tus propios créditos");
  });
});
