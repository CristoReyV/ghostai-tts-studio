/**
 * @file tests/voiceExperienceRedesignUx03_3.test.ts
 * Tests for GHOSTAI TTS — UX 03.3:
 * VOICE EXPERIENCE REDESIGN — SEPARATE "VOICES I CAN USE" FROM "VOICE LIBRARY"
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { BatchControls } from "../src/components/BatchControls";
import { NarrationRow } from "../src/components/NarrationRow";
import type { GatewayVoice, GatewayModel, StudioNarrationItem, VoiceLibraryVoice } from "../src/types/tts";

describe("UX 03.3: Voice Experience Redesign — Usable Voices vs Voice Library Separation", () => {
  const mockModels: GatewayModel[] = [
    {
      modelId: "eleven_multilingual_v2",
      name: "Eleven Multilingual v2",
      description: "Modelo multilingüe oficial",
      languages: [{ code: "es", name: "Spanish" }],
      supportsStyle: true,
      supportsSpeakerBoost: true,
    },
  ];

  const defaultVoices: GatewayVoice[] = [
    {
      voiceId: "def-voice-1",
      name: "Rachel",
      category: "premade",
      voiceOrigin: "default",
      labels: { language: "es", use_case: "narration" },
      previewUrl: "https://example.com/rachel.mp3",
    },
    {
      voiceId: "def-voice-2",
      name: "Roger",
      category: "premade",
      voiceOrigin: "default",
      labels: { language: "es", use_case: "conversational" },
      previewUrl: "https://example.com/roger.mp3",
    },
  ];

  const sharedVoices: VoiceLibraryVoice[] = Array.from({ length: 12 }, (_, i) => ({
    voiceId: "shared-voice-" + (i + 1),
    name: "Shared Voice " + (i + 1),
    category: "shared",
    voiceOrigin: (i < 4 ? "library_copy" : "shared_library") as any,
    sharedLibraryOrigin: true,
    freeUsersAllowed: true,
    publicOwnerId: "pub-owner-" + (i + 1),
    labels: { language: "es" },
    previewUrl: "https://example.com/shared-" + (i + 1) + ".mp3",
  }));

  const allVoices: GatewayVoice[] = [...defaultVoices, ...(sharedVoices as unknown as GatewayVoice[])];

  describe("Section 33: Separation of Section A (Usable) and Section B (Voice Library)", () => {
    it("renders exactly 2 usable cards in Section A and real count badge", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: allVoices,
          initialLibraryVoices: sharedVoices,
          models: mockModels,
          selectedVoiceId: "def-voice-1",
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
          totalCount: 2,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
          initialLibraryExpanded: true,
        })
      );

      expect(html).toContain('data-testid="section-usable-voices"');
      expect(html).toContain("VOCES DISPONIBLES CON TU PLAN");
      expect(html).toContain("2 VOCES DISPONIBLES");
      expect(html).toContain('data-testid="usable-voice-card-def-voice-1"');
      expect(html).toContain('data-testid="usable-voice-card-def-voice-2"');
      expect(html).not.toContain('data-testid="usable-voice-card-shared-voice-1"');
      expect(html).toContain("✓ DISPONIBLE");
      expect(html).toContain("VOZ ACTUAL");

      expect(html).toContain('data-testid="section-voice-library"');
      expect(html).toContain("VOICE LIBRARY DE ELEVENLABS");
      expect(html).toMatch(/tab-availability-btn active"[^>]*data-testid="tab-all-voices"/);
      expect(html).toContain("TODAS");
      expect(html).toContain("REQUIEREN PLAN");
      expect(html).toContain("EN TU COLECCIÓN");
      expect(html).not.toContain('data-testid="tab-available-voices"');
    });
  });

  describe("Section 34: Empty State when No Usable Voices are Confirmed", () => {
    it("renders explanatory empty state and VER VOICE LIBRARY CTA without mysterious DISPONIBLES (0) tab", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sharedVoices as unknown as GatewayVoice[],
          initialLibraryVoices: sharedVoices,
          models: mockModels,
          selectedVoiceId: "shared-voice-1",
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
          totalCount: 2,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('data-testid="usable-voices-empty-state"');
      expect(html).toContain("NO ENCONTRAMOS VOCES CONFIRMADAS PARA TU PLAN ACTUAL");
      expect(html).toContain("Tu cuenta de ElevenLabs está conectada, pero no pudimos confirmar voces utilizables mediante API con este plan.");
      expect(html).toContain("VER VOICE LIBRARY");
      expect(html).not.toContain('data-testid="usable-voices-grid"');
    });
  });

  describe("Section 35: Restricted Current Selection Guard", () => {
    it("shows VOZ REQUIERE PLAN, blocks generation with SELECCIONA UNA VOZ DISPONIBLE, and suppresses EN USO", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: allVoices,
          initialLibraryVoices: sharedVoices,
          models: mockModels,
          selectedVoiceId: "shared-voice-1",
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
          totalCount: 2,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('data-testid="selected-voice-restricted-banner"');
      expect(html).toContain("VOZ REQUIERE PLAN");
      expect(html).toContain("SELECCIONA UNA VOZ DISPONIBLE");
      expect(html).toContain("disabled");
      expect(html).toContain("btn-auth-locked");
      expect(html).not.toContain('data-testid="badge-in-use"');
    });
  });

  describe("Section 36: Collection Voice on Free Account", () => {
    it("renders EN TU COLECCIÓN with PLAN REQUERIDO and disabled action button", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: allVoices,
          initialLibraryVoices: sharedVoices,
          models: mockModels,
          selectedVoiceId: "def-voice-1",
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
          totalCount: 2,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
          initialLibraryExpanded: true,
        })
      );

      expect(html).toContain('title="Guardada en tu cuenta de ElevenLabs. Esto no garantiza disponibilidad mediante API con tu plan actual."');
      expect(html).toContain("btn-plan-restricted");
      expect(html).toContain("PLAN REQUERIDO");
    });
  });

  describe("Section 37: Provider Metadata Error State", () => {
    it("renders NO PUDIMOS COMPROBAR TUS VOCES error state and reintentar button without showing 0 available", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: [],
          models: mockModels,
          selectedVoiceId: "",
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
          totalCount: 2,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
          voicesError: "Connection timeout with ElevenLabs",
          onRetryVoices: vi.fn(),
        })
      );

      expect(html).toContain('data-testid="usable-voices-error"');
      expect(html).toContain("NO PUDIMOS COMPROBAR TUS VOCES");
      expect(html).toContain("Tu conexión con ElevenLabs sigue activa. Intenta actualizar el catálogo.");
      expect(html).toContain("Reintentar");
      expect(html).not.toContain("0 VOCES DISPONIBLES");
    });
  });

  describe("Section 18: Per-Narration Row Voice Dropdowns Grouping", () => {
    const mockItem: StudioNarrationItem = {
      id: "item-1",
      sceneId: "scene-1",
      sceneIndex: 1,
      text: "Lia observó el horizonte desde el faro.",
      voiceId: "def-voice-1",
      modelId: "eleven_multilingual_v2",
      status: "PENDING",
    };

    it("groups options into DISPONIBLES CON TU PLAN and disabled REQUIEREN PLAN", () => {
      const html = renderToStaticMarkup(
        React.createElement(NarrationRow, {
          item: mockItem,
          index: 0,
          voices: allVoices,
          models: mockModels,
          isGeneratingAny: false,
          providerTier: "free",
          onGenerateSingle: vi.fn(),
          onUpdateItemVoice: vi.fn(),
          onUpdateItemModel: vi.fn(),
          onUpdateDuration: vi.fn(),
        })
      );

      expect(html).toContain('<optgroup label="DISPONIBLES CON TU PLAN">');
      expect(html).toContain('<optgroup label="REQUIEREN PLAN">');
      expect(html).toContain('<option value="def-voice-1" selected="">Rachel</option>');
      expect(html).toContain('<option value="def-voice-2">Roger</option>');
      expect(html).toContain('<option value="shared-voice-1" disabled="">Shared Voice 1 (Requiere plan)</option>');
    });
  });
});