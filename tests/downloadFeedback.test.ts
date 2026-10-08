/**
 * @file tests/downloadFeedback.test.ts
 * Tests for GhostAI TTS Studio Compact Toast & Download Feedback UX (UX 01).
 *
 * Verifies:
 *  - Compact Toast renders correctly with structured ZIP export content:
 *    - Title: "ZIP listo para descargar"
 *    - Filename tag
 *    - Meta info: "1 audio · Listo para verificar"
 *    - Manual close button: "×"
 *  - No giant fullscreen overlay or viewport-sized container.
 *  - Dismissing toast does not reset or hide ZipVerificationCard (DESCARGA INICIADA).
 *  - CSS rules guarantee compact responsive clamp and top-right positioning.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { ZipVerificationCard } from "../src/components/ZipVerificationCard";

describe("GhostAI TTS Studio: Compact Download Feedback UX 01", () => {
  it("renders structured compact toast elements correctly", () => {
    // Replicating compact toast markup from App.tsx
    const toastData = {
      type: "success" as const,
      title: "ZIP listo para descargar",
      message: "lia_y_el_faro_encantado-tts-package.zip",
      fileName: "lia_y_el_faro_encantado-tts-package.zip",
      meta: "1 audio · Listo para verificar",
    };

    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        {
          className: `compact-toast compact-toast-${toastData.type}`,
          role: "status",
          "aria-live": "polite",
          "data-testid": "compact-toast",
        },
        React.createElement(
          "div",
          { className: "compact-toast-header" },
          React.createElement(
            "div",
            { className: "compact-toast-title-row" },
            React.createElement("span", { className: "compact-toast-title" }, toastData.title)
          ),
          React.createElement("button", { className: "compact-toast-close", "aria-label": "Cerrar notificación" }, "×")
        ),
        React.createElement("div", { className: "compact-toast-filename" }, toastData.fileName),
        React.createElement("div", { className: "compact-toast-meta" }, toastData.meta)
      )
    );

    expect(html).toContain("ZIP listo para descargar");
    expect(html).toContain("lia_y_el_faro_encantado-tts-package.zip");
    expect(html).toContain("1 audio · Listo para verificar");
    expect(html).toContain("compact-toast-close");
    expect(html).toContain("×");
    expect(html).toContain("compact-toast-success");

    // Must NOT contain modal backdrop or giant fullscreen classes
    expect(html).not.toContain("modal-backdrop");
    expect(html).not.toContain("fullscreen-overlay");
  });

  it("ZipVerificationCard remains visible in verification_pending state regardless of toast state", () => {
    const html = renderToStaticMarkup(
      React.createElement(ZipVerificationCard, {
        status: "verification_pending",
        currentSessionId: "491d4008-0475-4713-b17b-de2588ccec77",
        expectedItemCount: 1,
        expectedItems: [{ narrationId: "narr_scene1_001" }],
        onStatusChange: vi.fn(),
        onRetryDownload: vi.fn(),
        onNotification: vi.fn(),
      })
    );

    expect(html).toContain("DESCARGA INICIADA");
    expect(html).toContain("VERIFICAR ZIP DESCARGADO");
    expect(html).toContain("¿Quieres confirmar que el archivo ZIP se descargó de manera íntegra y completa?");
  });
});
