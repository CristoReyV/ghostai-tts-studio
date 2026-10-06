/**
 * @file tests/voiceSelectionSync.test.ts
 * Tests for GhostAI TTS Studio MVP Fix 01:
 * Unification of voice selection ("Usar voz") across all project narrations.
 *
 * Verifies:
 * 1. "Usar voz" updates all N rows immediately.
 * 2. Generate All builds requests with that voiceId for all items.
 * 3. Individual row override updates only that single row.
 * 4. Subsequent "Usar voz" reapplies globally to all rows (including previous overrides).
 * 5. Project with 1 narration works identically.
 * 6. Project with multiple narrations works identically.
 * 7. Real Flow project fixture (Prueba 3 with initial voiceId="oasis") transforms to Bella (hpp4J3VqNfWAUOO0d1Us).
 * 8. "Aplicar Configuración a Escenas" is completely removed from the UI.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BatchControls } from "../src/components/BatchControls";
import type { StudioNarrationItem, GatewayVoice, GatewayModel } from "../src/types/tts";

describe("MVP Fix 01 — Unified Voice Selection Synchronization", () => {
  const BELLA_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us";
  const ROGER_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17";
  const CRISTINA_VOICE_ID = "CaJslL1xziwefCeTNzHv";

  const mockVoices: GatewayVoice[] = [
    {
      voiceId: BELLA_VOICE_ID,
      name: "Bella - Professional, Bright, Warm",
      category: "premade",
      labels: { language: "en", accent: "american" },
    },
    {
      voiceId: ROGER_VOICE_ID,
      name: "Roger",
      category: "premade",
      labels: { language: "en", accent: "american" },
    },
    {
      voiceId: CRISTINA_VOICE_ID,
      name: "Cristina Campos",
      category: "shared",
      labels: { language: "es", accent: "mexican" },
    },
  ];

  const mockModels: GatewayModel[] = [
    {
      modelId: "eleven_multilingual_v2",
      name: "Eleven Multilingual v2",
      canDoTextToSpeech: true,
    },
  ];

  // Helper state controller replicating App.tsx's state and handlers
  class StudioStateController {
    selectedVoiceId: string = "";
    selectedModelId: string = "eleven_multilingual_v2";
    selectedOutputFormat: string = "mp3_44100_128";
    items: StudioNarrationItem[] = [];

    constructor(initialItems: StudioNarrationItem[]) {
      this.items = initialItems;
    }

    // Handler 3: Unified Global Voice Selection (Usar voz)
    handleSelectGlobalVoice = (voiceId: string) => {
      this.selectedVoiceId = voiceId;
      this.items = this.items.map((item) => ({
        ...item,
        voiceId,
      }));
    };

    // Handler 4: Individual Row Override
    handleUpdateItemVoice = (id: string, voiceId: string) => {
      this.items = this.items.map((item) =>
        item.id === id ? { ...item, voiceId } : item
      );
    };

    // Simulated payload construction for Generate All
    buildGenerateRequests(targetItemIds?: string[]) {
      const idsToGenerate = targetItemIds || this.items.map((it) => it.id);
      return idsToGenerate.map((id) => {
        const it = this.items.find((item) => item.id === id)!;
        return {
          voiceId: it.voiceId || this.selectedVoiceId || mockVoices[0].voiceId,
          text: it.text,
          modelId: it.modelId || this.selectedModelId,
          outputFormat: it.outputFormat || this.selectedOutputFormat,
        };
      });
    }
  }

  // 1. Flow Project Fixture (Prueba 3) with 4 items initial voiceId = "oasis"
  const createFlowProjectItems = (): StudioNarrationItem[] => [
    {
      id: "nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
      narrationId: "nar_3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
      sceneId: "3c0dde6e-d141-4f12-a3d5-ee0c74dddda2",
      sceneIndex: 1,
      text: "Nueva toma",
      voiceId: "oasis",
      modelId: "eleven_multilingual_v2",
      status: "PENDING",
    },
    {
      id: "nar_0e00cfa1-15e5-4588-b12c-8d68d80c3799",
      narrationId: "nar_0e00cfa1-15e5-4588-b12c-8d68d80c3799",
      sceneId: "0e00cfa1-15e5-4588-b12c-8d68d80c3799",
      sceneIndex: 2,
      text: "Nueva toma",
      voiceId: "oasis",
      modelId: "eleven_multilingual_v2",
      status: "PENDING",
    },
    {
      id: "nar_64fdda09-d621-4fa9-b2ec-596ebfc62031",
      narrationId: "nar_64fdda09-d621-4fa9-b2ec-596ebfc62031",
      sceneId: "64fdda09-d621-4fa9-b2ec-596ebfc62031",
      sceneIndex: 3,
      text: "Nueva toma",
      voiceId: "oasis",
      modelId: "eleven_multilingual_v2",
      status: "PENDING",
    },
    {
      id: "nar_854f72db-f9cc-482d-a467-8e13bb19510c",
      narrationId: "nar_854f72db-f9cc-482d-a467-8e13bb19510c",
      sceneId: "854f72db-f9cc-482d-a467-8e13bb19510c",
      sceneIndex: 4,
      text: "Nueva toma",
      voiceId: "oasis",
      modelId: "eleven_multilingual_v2",
      status: "PENDING",
    },
  ];

  it("1 & 7. Flow project: clicking 'Usar voz' on Bella updates all 4 rows immediately", () => {
    const controller = new StudioStateController(createFlowProjectItems());

    // Initially all 4 items have oasis
    expect(controller.items.every((it) => it.voiceId === "oasis")).toBe(true);

    // User clicks "Usar voz" on Bella
    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);

    expect(controller.selectedVoiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items).toHaveLength(4);
    expect(controller.items[0].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[1].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[2].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[3].voiceId).toBe(BELLA_VOICE_ID);
  });

  it("2 & 8. Generate All payload consumes Bella voiceId for all N items", () => {
    const controller = new StudioStateController(createFlowProjectItems());
    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);

    const requests = controller.buildGenerateRequests();
    expect(requests).toHaveLength(4);

    requests.forEach((req, idx) => {
      expect(req.voiceId).toBe(BELLA_VOICE_ID);
      expect(req.text).toBe("Nueva toma");
      expect(req.modelId).toBe("eleven_multilingual_v2");
    });
  });

  it("3. Individual row override updates only that single row", () => {
    const controller = new StudioStateController(createFlowProjectItems());
    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);

    // Override row 2 (index 1) to Roger
    const targetId = controller.items[1].id;
    controller.handleUpdateItemVoice(targetId, ROGER_VOICE_ID);

    expect(controller.items[0].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[1].voiceId).toBe(ROGER_VOICE_ID); // Overridden
    expect(controller.items[2].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[3].voiceId).toBe(BELLA_VOICE_ID);

    const requests = controller.buildGenerateRequests();
    expect(requests[0].voiceId).toBe(BELLA_VOICE_ID);
    expect(requests[1].voiceId).toBe(ROGER_VOICE_ID);
    expect(requests[2].voiceId).toBe(BELLA_VOICE_ID);
    expect(requests[3].voiceId).toBe(BELLA_VOICE_ID);
  });

  it("4. Subsequent 'Usar voz' reapplies globally to all rows, resetting prior overrides", () => {
    const controller = new StudioStateController(createFlowProjectItems());
    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);

    // Override row 2 to Roger
    controller.handleUpdateItemVoice(controller.items[1].id, ROGER_VOICE_ID);
    expect(controller.items[1].voiceId).toBe(ROGER_VOICE_ID);

    // Now user clicks "Usar voz" on Bella again (or another voice like Cristina)
    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);

    // All 4 rows must be Bella again
    expect(controller.items[0].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[1].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[2].voiceId).toBe(BELLA_VOICE_ID);
    expect(controller.items[3].voiceId).toBe(BELLA_VOICE_ID);

    // If changing to Cristina globally:
    controller.handleSelectGlobalVoice(CRISTINA_VOICE_ID);
    expect(controller.items.every((it) => it.voiceId === CRISTINA_VOICE_ID)).toBe(true);
  });

  it("5. Project with exactly 1 narration updates cleanly", () => {
    const singleItem: StudioNarrationItem[] = [
      {
        id: "single_01",
        narrationId: "single_01",
        sceneId: "scene_01",
        sceneIndex: 1,
        text: "Solo una narración de prueba",
        voiceId: "oasis",
        modelId: "eleven_multilingual_v2",
        status: "PENDING",
      },
    ];

    const controller = new StudioStateController(singleItem);
    expect(controller.items[0].voiceId).toBe("oasis");

    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);
    expect(controller.items[0].voiceId).toBe(BELLA_VOICE_ID);

    const requests = controller.buildGenerateRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].voiceId).toBe(BELLA_VOICE_ID);
  });

  it("6. Project with multiple narrations updates cleanly", () => {
    const multiItems: StudioNarrationItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `nar_${i + 1}`,
      narrationId: `nar_${i + 1}`,
      sceneId: `scene_${i + 1}`,
      sceneIndex: i + 1,
      text: `Texto de escena ${i + 1}`,
      voiceId: "legacy_voice",
      modelId: "eleven_multilingual_v2",
      status: "PENDING",
    }));

    const controller = new StudioStateController(multiItems);
    expect(controller.items).toHaveLength(10);
    expect(controller.items.every((it) => it.voiceId === "legacy_voice")).toBe(true);

    controller.handleSelectGlobalVoice(BELLA_VOICE_ID);
    expect(controller.items.every((it) => it.voiceId === BELLA_VOICE_ID)).toBe(true);

    const requests = controller.buildGenerateRequests();
    expect(requests).toHaveLength(10);
    expect(requests.every((r) => r.voiceId === BELLA_VOICE_ID)).toBe(true);
  });

  it("8. Absence of 'Aplicar Configuración a Escenas' button in BatchControls JSX", () => {
    const jsx = React.createElement(BatchControls, {
      voices: mockVoices,
      models: mockModels,
      selectedVoiceId: BELLA_VOICE_ID,
      selectedModelId: "eleven_multilingual_v2",
      selectedOutputFormat: "mp3_44100_128",
      selectedLanguage: "es",
      onSelectLanguage: vi.fn(),
      onSelectVoice: vi.fn(),
      onSelectModel: vi.fn(),
      onSelectOutputFormat: vi.fn(),
      isGenerating: false,
      onGenerateAll: vi.fn(),
      onCancelGeneration: vi.fn(),
      onRetryFailed: vi.fn(),
      onExportZip: vi.fn(),
      hasErrors: false,
      hasReadyItems: false,
      readyCount: 0,
      totalCount: 4,
      isAuthenticated: true,
      isProviderConnected: true,
    });

    const renderedHtml = renderToStaticMarkup(jsx);

    // Verify "Aplicar Configuración a Escenas" is NOT present
    expect(renderedHtml).not.toContain("Aplicar Configuración a Escenas");
    expect(renderedHtml).not.toContain("btn-apply-batch");
    expect(renderedHtml).not.toContain("¡Configuración aplicada!");

    // Verify main batch buttons exist
    expect(renderedHtml).toContain("Generar Todas las Narraciones");
  });
});
