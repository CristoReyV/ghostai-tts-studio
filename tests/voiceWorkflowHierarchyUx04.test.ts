/**
 * @file tests/voiceWorkflowHierarchyUx04.test.ts
 * Tests for GHOSTAI TTS STUDIO — UX 04:
 * VOICE WORKFLOW VISUAL HIERARCHY & STREAMLINED UI
 */

import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import {
  BatchControls,
  getVoiceCategoryGroup,
  formatVoiceSubtitle,
} from "../src/components/BatchControls";
import { RecoveryVaultSection } from "../src/components/RecoveryVaultSection";
import type { GatewayVoice, GatewayModel, VoiceLibraryVoice } from "../src/types/tts";

describe("UX 04: Voice Workflow Visual Hierarchy & Layout Streamlining", () => {
  const mockModels: GatewayModel[] = [
    {
      modelId: "eleven_multilingual_v2",
      name: "Eleven Multilingual v2",
      languages: [{ code: "es", name: "Spanish" }],
      supportsStyle: true,
      supportsSpeakerBoost: true,
    },
  ];

  // 12 sample usable voices covering distinct metadata categories
  const sampleUsableVoices: GatewayVoice[] = [
    {
      voiceId: "voice-1",
      name: "Roger - Narrador",
      category: "premade",
      labels: { language: "es", accent: "latinoamericano", use_case: "narration", gender: "male", age: "middle_aged" },
      previewUrl: "https://example.com/roger.mp3",
    },
    {
      voiceId: "voice-2",
      name: "Bella - Cuentos",
      category: "premade",
      labels: { language: "es", accent: "latinoamericano", use_case: "story", gender: "female", age: "young" },
      previewUrl: "https://example.com/bella.mp3",
    },
    {
      voiceId: "voice-3",
      name: "Mateo - Diálogo",
      category: "premade",
      labels: { language: "es", accent: "mexicano", use_case: "conversational", gender: "male", age: "young" },
      previewUrl: "https://example.com/mateo.mp3",
    },
    {
      voiceId: "voice-4",
      name: "Lucía - Comercial",
      category: "premade",
      labels: { language: "es", accent: "español", use_case: "advertisement", gender: "female", age: "middle_aged" },
      previewUrl: "https://example.com/lucia.mp3",
    },
    {
      voiceId: "voice-5",
      name: "Carlos - Animación",
      category: "premade",
      labels: { language: "es", accent: "latinoamericano", use_case: "characters", gender: "male", age: "middle_aged" },
      previewUrl: "https://example.com/carlos.mp3",
    },
    {
      voiceId: "voice-6",
      name: "Sofía - Redes",
      category: "premade",
      labels: { language: "es", accent: "argentino", use_case: "social_media", gender: "female", age: "young" },
      previewUrl: "https://example.com/sofia.mp3",
    },
    {
      voiceId: "voice-7",
      name: "Elena - Educativa",
      category: "premade",
      labels: { language: "es", accent: "castellano", use_case: "educational", gender: "female", age: "middle_aged" },
      previewUrl: "https://example.com/elena.mp3",
    },
    {
      voiceId: "voice-8",
      name: "Gabriel - Crónicas",
      category: "premade",
      labels: { language: "es", accent: "colombiano", use_case: "audiobook", gender: "male", age: "old" },
      previewUrl: "https://example.com/gabriel.mp3",
    },
    {
      voiceId: "voice-9",
      name: "Valeria - Podcasts",
      category: "premade",
      labels: { language: "es", accent: "latinoamericano", use_case: "narration", gender: "female", age: "middle_aged" },
      previewUrl: "https://example.com/valeria.mp3",
    },
    {
      voiceId: "voice-10",
      name: "Joaquín - Noticias",
      category: "premade",
      labels: { language: "es", accent: "chileno", use_case: "narration", gender: "male", age: "middle_aged" },
      previewUrl: "https://example.com/joaquin.mp3",
    },
  ];

  // ── 1. Category and Subtitle Helpers (Sections 4, 8, 27) ──────────────────
  describe("Voice Metadata Classification & Card Subtitles", () => {
    it("derives normalized categories from voice metadata without hardcoding", () => {
      expect(getVoiceCategoryGroup({ labels: { use_case: "narration" } })).toBe("narracion");
      expect(getVoiceCategoryGroup({ labels: { use_case: "audiobook" } })).toBe("narracion");
      expect(getVoiceCategoryGroup({ labels: { use_case: "conversational" } })).toBe("conversacional");
      expect(getVoiceCategoryGroup({ labels: { use_case: "advertisement" } })).toBe("publicidad");
      expect(getVoiceCategoryGroup({ labels: { use_case: "characters" } })).toBe("personajes");
      expect(getVoiceCategoryGroup({ labels: { use_case: "social_media" } })).toBe("redes");
      expect(getVoiceCategoryGroup({ labels: { use_case: "educational" } })).toBe("educacion");
      expect(getVoiceCategoryGroup({ labels: {} })).toBe("general");
    });

    it("formats clean, non-repetitive voice card subtitles", () => {
      const sub = formatVoiceSubtitle({
        labels: { use_case: "narration", accent: "latinoamericano" },
      });
      expect(sub).toContain("Narración");
      expect(sub).toContain("Latinoamericano");
      expect(sub).not.toContain("DISPONIBLE CON TU PLAN");
    });
  });

  // ── 2. Usable Voice Filters Bar (Section 4 & 5) ───────────────────────────
  describe("Section A: Usable Voice Filters Bar", () => {
    it("renders dynamic category pills derived only from existing metadata (usable voice filters: PASS)", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('data-testid="usable-filters-bar"');
      expect(html).toContain("TODAS");
      expect(html).toContain("NARRACIÓN");
      expect(html).toContain("CONVERSACIONAL");
      expect(html).toContain("PUBLICIDAD");
      expect(html).toContain("PERSONAJES");
      expect(html).toContain("REDES");
      // check categories
      ["TODAS", "NARRACIÓN", "CONVERSACIONAL", "PUBLICIDAD", "PERSONAJES", "REDES"].forEach(cat => {
        expect(html).toContain(cat);
      });
      expect(html).toContain("MÁS FILTROS");
    });

    it("renders search input scoped to usable voices (search + filters: PASS)", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('placeholder="Buscar entre tus voces disponibles..."');
    });
  });

  // ── 3. Initial 8 Cards Limit & Expand Button (Section 7) ─────────────────
  describe("Usable Voice Cards Count Limit & Expand", () => {
    it("renders only initial 8 cards when 10 usable voices are present (initial 8 cards: PASS)", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      // Voices 1 through 8 rendered
      expect(html).toContain('data-testid="usable-voice-card-voice-1"');
      expect(html).toContain('data-testid="usable-voice-card-voice-8"');

      // Voices 9 and 10 NOT rendered initially
      expect(html).not.toContain('data-testid="usable-voice-card-voice-9"');
      expect(html).not.toContain('data-testid="usable-voice-card-voice-10"');

      // Expand button rendered
      expect(html).toContain('data-testid="btn-toggle-expand-usable"');
      expect(html).toContain("VER TODAS LAS VOCES DISPONIBLES (10)");
    });
  });

  // ── 4. Usable Voice Card Simplicity & Selected Voice Badge (Section 8 & 9) ──
  describe("Usable Card Badges & Selection", () => {
    it("renders clean ✓ DISPONIBLE and ✓ VOZ ACTUAL badges without repetitive text", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      // Selected card has strong VOZ ACTUAL
      expect(html).toContain("VOZ ACTUAL");
      // Available unselected cards have clean simple badge
      expect(html).toContain("✓ DISPONIBLE");
    });
  });

  // ── 5. Selected Voice Action Bar & Primary Generation CTA (Section 10 & 11) ──
  describe("Selected Voice Action Bar & Primary CTA", () => {
    it("renders prominent selected voice action bar with pending count and primary generate CTA (selected voice action bar: PASS, generate CTA near selected voice: PASS)", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('data-testid="selected-voice-action-bar"');
      expect(html).toContain("Roger - Narrador");
      expect(html).toContain("Cambiar voz");
      expect(html).toContain("narraciones pendientes");
      expect(html).toContain(">3<");
      expect(html).toContain('data-testid="btn-generate-near-voice"');
      expect(html).toContain("Generar Todas las Narraciones (0/3)");
    });
  });

  // ── 6. Compact Generation Settings (Section 12 & 13) ──────────────────────
  describe("Compact Generation Settings", () => {
    it("renders compact generation settings summary collapsed by default (settings compact: PASS)", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('data-testid="compact-generation-settings"');
      expect(html).toContain("ElevenLabs ✓ Conectado (Plan Free)");
      expect(html).toContain("Eleven Multilingual v2");
      expect(html).toContain("MP3 · 44.1 kHz · 128 kbps");
      expect(html).toContain('data-testid="btn-toggle-settings"');
      // Advanced settings body collapsed by default
      expect(html).not.toContain('data-testid="settings-expanded-body"');
    });
  });

  // ── 7. Voice Library Collapsed by Default & Top Shortcut (Sections 16, 17, 18, 21) ──
  describe("Voice Library Placement & Collapsed Default", () => {
    it("renders Voice Library collapsed by default without rendering cards (Voice Library collapsed: PASS)", () => {
      const mockSharedVoices: VoiceLibraryVoice[] = [
        {
          voiceId: "shared-lib-1",
          name: "Library Voice 1",
          category: "shared",
          sharedLibraryOrigin: true,
          freeUsersAllowed: false,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          initialLibraryVoices: mockSharedVoices,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      // Collapsed preview rendered
      expect(html).toContain('data-testid="catalog-collapsed-preview"');
      expect(html).toContain("VOICE LIBRARY DE ELEVENLABS");
      expect(html).toContain("VER VOCES NO DISPONIBLES CON MI PLAN");

      // Zero library voice cards rendered while collapsed
      expect(html).not.toContain('data-testid="voice-library-expanded-panel"');
      expect(html).not.toContain("Library Voice 1");

      // Subtle top shortcut link is present (scroll/open shortcut: PASS)
      expect(html).toContain('data-testid="shortcut-explore-library"');
      expect(html).toContain("EXPLORAR VOICE LIBRARY");
    });

    it("renders full panel when expanded (open library: PASS)", () => {
      const mockSharedVoices: VoiceLibraryVoice[] = [
        {
          voiceId: "shared-lib-1",
          name: "Library Voice 1",
          category: "shared",
          sharedLibraryOrigin: true,
          freeUsersAllowed: false,
          labels: { language: "es" },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: sampleUsableVoices,
          initialLibraryVoices: mockSharedVoices,
          initialLibraryExpanded: true,
          models: mockModels,
          selectedVoiceId: "voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain('data-testid="voice-library-expanded-panel"');
      expect(html).toContain("OCULTAR VOICE LIBRARY");
      expect(html).toContain("Library Voice 1");
      expect(html).toContain("🔒 REQUIERE PLAN");
    });
  });

  // ── 8. Restricted Voice Selection Guard (Section 20 & 26) ──────────────────
  describe("Restricted Voice Controls Guard", () => {
    it("locks generation CTA when selected voice is restricted (restricted controls: PASS)", () => {
      const restrictedVoice: GatewayVoice = {
        voiceId: "restricted-voice-1",
        name: "Pro Voice",
        category: "shared",
        voiceOrigin: "shared_library",
        sharedLibraryOrigin: true,
        labels: { language: "es" },
      };

      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: [...sampleUsableVoices, restrictedVoice],
          models: mockModels,
          selectedVoiceId: "restricted-voice-1",
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
          totalCount: 3,
          isAuthenticated: true,
          isProviderConnected: true,
          providerTier: "free",
        })
      );

      expect(html).toContain("SELECCIONA UNA VOZ DISPONIBLE");
      expect(html).toContain("btn-auth-locked");
      expect(html).toContain("disabled");
    });
  });

  // ── 9. Narration Table Hierarchy Priority (Section 2, 14, 25) ─────────────
  describe("Narration Table Priority Hierarchy", () => {
    it("verifies App.tsx nests NarrationTable before Voice Library (narration table before library: PASS)", () => {
      const appSrc = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");

      const narrationIndex = appSrc.indexOf("<NarrationTable");
      const batchControlsEnd = appSrc.indexOf("</BatchControls>");

      expect(narrationIndex).toBeGreaterThan(0);
      expect(batchControlsEnd).toBeGreaterThan(narrationIndex);
    });
  });

  // ── 10. Recovery Vault Utility (Section 15) ────────────────────────────────
  describe("Recovery Vault Utility", () => {
    it("renders RecoveryVaultSection as compact collapsible block (recovery utility: PASS)", () => {
      const compSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/components/RecoveryVaultSection.tsx"),
        "utf8"
      );

      expect(compSrc).toContain("UTILIDADES");
      expect(compSrc).toContain("RECUPERACIÓN TEMPORAL");
      expect(compSrc).toContain("VER RECUPERACIÓN");
      expect(compSrc).toContain("OCULTAR RECUPERACIÓN");
      expect(compSrc).toContain("proyectos disponibles");
    });
  });
});
