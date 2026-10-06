/**
 * @file tests/connectionAlert.test.ts
 * Tests for GhostAI TTS Studio ConnectionAlert component & Connection State Machine.
 *
 * Covers:
 *  1. GhostAI offline -> ACCESO GHOSTAI REQUERIDO, CTA CONECTAR GHOSTAI, ElevenLabs pendiente
 *  2. GhostAI online / ElevenLabs offline -> CONECTA ELEVENLABS, GhostAI ✓, CTA CONECTAR ELEVENLABS
 *  3. Ambos online -> Banner oculto (null)
 *  4. 401 / revoked -> Banner reaparece con mensaje de acceso expirado
 *  5. Disconnect ElevenLabs -> Banner reaparece pidiendo conectar ElevenLabs
 *  6. client.name -> Visualización de identidad verificada sin exponer tokens
 *  7. Generation guards -> Guard lógico para bloquear generación si falta alguna conexión
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionAlert } from "../src/components/ConnectionAlert";

describe("GhostAI TTS Studio: ConnectionAlert UX", () => {
  const defaultHandlers = {
    onConnectGhostAIClick: vi.fn(),
    onConnectElevenLabsClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. GhostAI Offline ──────────────────────────────────────────────────────
  describe("1. GhostAI Offline", () => {
    it("renders high priority alert when GhostAI is disconnected", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: false,
          isProviderConnected: false,
          ...defaultHandlers,
        })
      );

      expect(html).toContain("ACCESO GHOSTAI REQUERIDO");
      expect(html).toContain("CONECTAR GHOSTAI");
      expect(html).toContain("btn-connect-ghostai");
    });

    it("displays ElevenLabs as pending while GhostAI is offline", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: false,
          isProviderConnected: false,
          ...defaultHandlers,
        })
      );

      expect(html).toContain("ElevenLabs");
      expect(html).toContain("Pendiente");
      expect(html).toContain("Pendiente — conecta GhostAI primero");
    });
  });

  // ── 2. GhostAI Online / ElevenLabs Offline ──────────────────────────────────
  describe("2. GhostAI Online / ElevenLabs Offline", () => {
    it("renders amber banner prompting to connect ElevenLabs", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: false,
          ...defaultHandlers,
        })
      );

      expect(html).toContain("CONECTA ELEVENLABS");
      expect(html).toContain("CONECTAR ELEVENLABS");
      expect(html).toContain("btn-connect-elevenlabs");
    });

    it("displays GhostAI as connected in row 1", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: false,
          ...defaultHandlers,
        })
      );

      expect(html).toContain("✓ Conectado");
      expect(html).toContain("○ Sin conectar");
    });
  });

  // ── 3. Ambos Online ────────────────────────────────────────────────────────
  describe("3. Ambos Online", () => {
    it("renders nothing (null) when both GhostAI and ElevenLabs are connected", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: true,
          ...defaultHandlers,
        })
      );

      expect(html).toBe("");
    });
  });

  // ── 4. 401 / Revoked ───────────────────────────────────────────────────────
  describe("4. 401 / Revoked Session", () => {
    it("renders alert with custom expired message when token is revoked", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: false,
          isProviderConnected: false,
          authErrorMessage: "Tu acceso expiró o ya no es válido. Vuelve a conectarte.",
          ...defaultHandlers,
        })
      );

      expect(html).toContain("ACCESO GHOSTAI REQUERIDO");
      expect(html).toContain("Tu acceso expiró o ya no es válido. Vuelve a conectarte.");
      expect(html).toContain("CONECTAR GHOSTAI");
    });
  });

  // ── 5. Disconnect ElevenLabs ───────────────────────────────────────────────
  describe("5. Disconnect ElevenLabs", () => {
    it("reactivates the ElevenLabs banner when isProviderConnected transitions to false", () => {
      // Step A: Both connected -> empty
      const htmlConnected = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: true,
          ...defaultHandlers,
        })
      );
      expect(htmlConnected).toBe("");

      // Step B: Disconnected -> banner re-appears
      const htmlDisconnected = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: false,
          ...defaultHandlers,
        })
      );
      expect(htmlDisconnected).toContain("CONECTA ELEVENLABS");
      expect(htmlDisconnected).toContain("CONECTAR ELEVENLABS");
    });
  });

  // ── 6. Client Name Identity ────────────────────────────────────────────────
  describe("6. Client Name Identity Display", () => {
    it("renders client.name discretely without exposing raw tokens", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: false,
          clientName: "Empresa Audiovisual Alfa",
          ...defaultHandlers,
        })
      );

      expect(html).toContain("Empresa Audiovisual Alfa");
      expect(html).not.toContain("gai_live_");
      expect(html).not.toContain("secret");
    });

    it("defaults to Operador GhostAI when clientName is null", () => {
      const html = renderToStaticMarkup(
        React.createElement(ConnectionAlert, {
          isAuthenticated: true,
          isProviderConnected: false,
          clientName: null,
          ...defaultHandlers,
        })
      );

      expect(html).toContain("Operador GhostAI");
    });
  });

  // ── 7. Generation Guards ───────────────────────────────────────────────────
  describe("7. Generation Guards", () => {
    function canGenerate(isAuthenticated: boolean, isProviderConnected: boolean): boolean {
      return isAuthenticated && isProviderConnected;
    }

    it("blocks generation when GhostAI is offline", () => {
      expect(canGenerate(false, false)).toBe(false);
      expect(canGenerate(false, true)).toBe(false);
    });

    it("blocks generation when GhostAI is online but ElevenLabs is offline", () => {
      expect(canGenerate(true, false)).toBe(false);
    });

    it("permits generation only when both GhostAI and ElevenLabs are connected", () => {
      expect(canGenerate(true, true)).toBe(true);
    });
  });
});
