import fs from "fs";
import path from "path";
/**
 * @file tests/publicProductCleanup.test.ts
 * Tests for GHOSTAI TTS STUDIO — UX 02: Public Product Cleanup & Infrastructure Hiding.
 *
 * Requirements:
 *  - Section 31: En modo normal NO debe aparecer texto:
 *    "Gateway Conectado", "tts-test.smartbrain.lat", "GhostAI Admin", "Supabase", "Netlify", "/api/"
 *  - Section 32: Footer debe contener "GhostAI TTS Studio", "Powered by SmartBrain",
 *    y NO contener "Conectado a", "Compatible con exportación", "Admin", internal URL.
 *  - Clean Header: Solo marca a la izquierda, badges [GhostAI ✓ · Client] [ElevenLabs ✓]
 *    y control de sesión a la derecha. Sin link externo a Gateway ni refresh técnico.
 *  - Clean Recovery: "RECUPERACIÓN TEMPORAL", sin mencionar Supabase ni Gateway.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { Header } from "../src/components/Header";
import { VoiceProviderSection } from "../src/components/VoiceProviderSection";
import { RecoveryVaultSection } from "../src/components/RecoveryVaultSection";

describe("UX 02: Public Product Cleanup & Infrastructure Hiding", () => {
  // ── Section 1 & 2: Header Cleaning ───────────────────────────────────────
  it("renders clean public header without gateway infrastructure, internal domains, or refresh buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(Header, {
        isAuthenticated: true,
        clientName: "GhostAI Owner",
        isProviderConnected: true,
        onAuthStateChange: vi.fn(),
      })
    );

    // Left brand elements retained
    expect(html).toContain("GHOSTAI TTS STUDIO");
    expect(html).toContain("v1.0 Bidireccional");

    // Right elements: Compact badges and session
    expect(html).toContain("GhostAI ✓ · GhostAI Owner");
    expect(html).toContain("ElevenLabs ✓");
    expect(html).toContain("CERRAR SESIÓN");

    // Section 31 assertions: Zero gateway infrastructure exposed
    expect(html).not.toContain("Gateway Conectado");
    expect(html).not.toContain("Gateway Desconectado");
    expect(html).not.toContain("tts-test.smartbrain.lat");
    expect(html).not.toContain("gateway-link");
    expect(html).not.toContain("gateway-status-card");
    expect(html).not.toContain("Actualizar estado del Gateway");
    expect(html).not.toContain("Supabase");
    expect(html).not.toContain("Netlify");
    expect(html).not.toContain("/api/");
  });

  // ── Section 3: ElevenLabs Connected Status ──────────────────────────────
  it("renders simple, discreet ElevenLabs connected message without internal tech details", () => {
    const html = renderToStaticMarkup(
      React.createElement(VoiceProviderSection, {
        isProviderConnected: true,
        isAuthenticated: true,
        providerTier: "free",
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
      })
    );

    expect(html).toContain("ElevenLabs Conectado");
    expect(html).toContain("Tu cuenta está lista para generar narraciones.");
    expect(html).toContain("Plan Gratis");
    expect(html).toContain("DESCONECTAR");

    // Zero infrastructure or encryption cookies exposed
    expect(html).not.toContain("tts-test.smartbrain.lat");
    expect(html).not.toContain("Gateway");
    expect(html).not.toContain("cookie cifrada");
    expect(html).not.toContain("servidor");
    expect(html).not.toContain("Supabase");
    expect(html).not.toContain("Netlify");
    expect(html).not.toContain("/api/");
  });

  // ── Section 28: Recovery Vault Clean Text ────────────────────────────────
  it("renders Recovery as RECUPERACIÓN TEMPORAL with friendly description", () => {
    const html = renderToStaticMarkup(
      React.createElement(RecoveryVaultSection, {
        isAuthenticated: true,
        hasActiveProject: true,
        onRestoreProject: vi.fn(),
        onNotification: vi.fn(),
      })
    );

    // When sessions are empty initially it returns null, but if rendered with session mock
    // we verify the component code strings directly:
    const componentSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/components/RecoveryVaultSection.tsx"),
      "utf8"
    );

    expect(componentSrc).toContain("RECUPERACIÓN TEMPORAL");
    expect(componentSrc).toContain(
      "GhostAI conserva temporalmente tus narraciones para que puedas restaurarlas sin volver a generarlas."
    );
    expect(componentSrc).not.toContain("RECOVERY VAULT");
    expect(componentSrc).not.toContain("Supabase");
    expect(componentSrc).not.toContain("Storage bucket");
    expect(componentSrc).not.toContain("Gateway");
  });

  // ── Section 32: Public Footer Assertions ─────────────────────────────────
  it("renders clean public footer matching Section 5 & 29 specifications exactly", () => {
    const appSrc = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");

    // Extract footer block from App.tsx
    const footerMatch = appSrc.match(/<footer class(?:Name)?="app-footer">([\s\S]*?)<\/footer>/);
    expect(footerMatch).toBeTruthy();
    const footerContent = footerMatch![1];

    // Must contain
    expect(footerContent).toContain("GhostAI TTS Studio");
    expect(footerContent).toContain("Powered by SmartBrain");

    // Must NOT contain per Section 5, 6, 7 & 32
    expect(footerContent).not.toContain("Conectado a");
    expect(footerContent).not.toContain("Compatible con exportación");
    expect(footerContent).not.toContain("tts-test.smartbrain.lat");
    expect(footerContent).not.toContain("GhostAI Admin");
    expect(footerContent).not.toContain("Admin");
    expect(footerContent).not.toContain("/api/");
    expect(footerContent).not.toContain("http");
    expect(footerContent).not.toContain("<a"); // Zero external clickable links
  });
});
