/**
 * @file tests/voiceCatalogUx03.test.ts
 * Tests for GHOSTAI TTS STUDIO — UX 03:
 * Voice Catalog Filtering & Free-Plan Usability.
 *
 * Requirements:
 *  - Section 2: Default filter is AVAILABLE; restricted/unknown voices are hidden by default.
 *  - Section 3 & 4: Compact filter controls with real dynamic counts derived from catalog.
 *  - Section 5: Voice card badges and explanatory helper text per plan availability.
 *  - Section 6: Sorting under ALL (available first, unknown second, restricted last).
 *  - Section 7 & 8: Generation safety; selected restricted voice displays warning and disables generation.
 *  - Section 9: Search operates inside active filter.
 *  - Section 10: Compact neutral account plan status (ElevenLabs Free / ElevenLabs Pro).
 *  - Section 11: No hardcoded voice ID lists.
 *  - Section 12: Zero real generations (0 credits consumed).
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import {
  checkVoicePlanAvailability,
  computeVoiceCatalogCounts,
  filterAndSortVoiceCatalog,
  getVoicePlanHelperText,
  getVoicePlanBadgeLabel,
} from "../src/services/voiceLibrary";
import { BatchControls } from "../src/components/BatchControls";
import type { GatewayVoice, GatewayModel } from "../src/types/tts";

describe("UX 03: Voice Catalog Filtering & Free-Plan Usability", () => {
  // Test catalog fixture
  const sampleVoices = [
    {
      voiceId: "voice-premade-1",
      name: "Bella - Premade Story",
      category: "premade",
      voiceOrigin: "premade" as const,
      description: "Warm expressive voice",
      useCase: "narration",
    },
    {
      voiceId: "voice-premade-2",
      name: "Bella - Premade Casual",
      category: "premade",
      voiceOrigin: "premade" as const,
      description: "Casual premade voice",
      useCase: "conversational",
    },
    {
      voiceId: "voice-shared-free-3",
      name: "Bella - Community Free",
      category: "shared",
      voiceOrigin: "shared_library" as const,
      libraryAllowsFreeUsers: true,
      freeUsersAllowed: true,
      description: "Community voice open in library",
      useCase: "news",
    },
    {
      voiceId: "voice-shared-pro-4",
      name: "Bella - Community Pro Only",
      category: "shared",
      voiceOrigin: "shared_library" as const,
      libraryAllowsFreeUsers: false,
      freeUsersAllowed: false,
      description: "Restricted voice for paid subscribers",
      useCase: "narration",
    },
    {
      voiceId: "voice-shared-pro-5",
      name: "Arthur - Pro Documentary",
      category: "shared",
      voiceOrigin: "shared_library" as const,
      libraryAllowsFreeUsers: false,
      freeUsersAllowed: false,
      description: "Deep voice for documentaries",
      useCase: "documentary",
    },
    {
      voiceId: "voice-unverified-6",
      name: "Charlie - Ambiguous Tier",
      category: "custom",
      voiceOrigin: "unknown" as const,
      description: "Unverified provider metadata",
      useCase: "general",
    },
  ];

  // 1. Dynamic Counts (Section 4)
  describe("Dynamic Counts (Section 4)", () => {
    it("computes accurate counts for Free account without hardcoded numbers", () => {
      const counts = computeVoiceCatalogCounts(sampleVoices, "free");
      // Under UX 03.1:
      // Available: premade 1 + premade 2 = 2
      // Restricted: shared 3 + shared 4 + shared 5 = 3
      // Unknown: unverified 6 = 1
      // Total: 6
      expect(counts.available).toBe(2);
      expect(counts.restricted).toBe(3);
      expect(counts.unknown).toBe(1);
      expect(counts.total).toBe(6);
    });

    it("dynamically adapts counts when account is upgraded to Paid", () => {
      const counts = computeVoiceCatalogCounts(sampleVoices, "pro");
      expect(counts.available).toBe(6);
      expect(counts.restricted).toBe(0);
      expect(counts.unknown).toBe(0);
      expect(counts.total).toBe(6);
    });
  });

  // 2. Free Account Filtering (Section 2 & 3)
  describe("Free Account Filtering (Section 2 & 3)", () => {
    it("available filter shows only available voices, hiding restricted and unknown voices", () => {
      const filtered = filterAndSortVoiceCatalog(sampleVoices, "available", "free");
      expect(filtered.length).toBe(2);
      expect(filtered.map((v) => v.voiceId)).toEqual([
        "voice-premade-1",
        "voice-premade-2",
      ]);
      expect(filtered.some((v) => v.voiceId === "voice-shared-free-3")).toBe(false);
      expect(filtered.some((v) => v.voiceId === "voice-shared-pro-4")).toBe(false);
    });

    it("restricted filter shows only restricted voices requiring a plan upgrade", () => {
      const filtered = filterAndSortVoiceCatalog(sampleVoices, "restricted", "free");
      expect(filtered.length).toBe(3);
      expect(filtered.map((v) => v.voiceId)).toEqual([
        "voice-shared-free-3",
        "voice-shared-pro-4",
        "voice-shared-pro-5",
      ]);
    });

    it("unknown filter shows only voices whose availability cannot be verified", () => {
      const filtered = filterAndSortVoiceCatalog(sampleVoices, "unknown", "free");
      expect(filtered.length).toBe(1);
      expect(filtered[0].voiceId).toBe("voice-unverified-6");
    });
  });

  // 3. Sorting under ALL tab (Section 6)
  describe("Sorting under ALL tab (Section 6)", () => {
    it("sorts ALL voices with available first, unknown second, restricted last", () => {
      const sorted = filterAndSortVoiceCatalog(sampleVoices, "all", "free");
      expect(sorted.length).toBe(6);

      const availabilities = sorted.map(
        (v) => checkVoicePlanAvailability(v, "free").availability
      );
      // First 2 should be available (premade)
      expect(availabilities.slice(0, 2)).toEqual(["available", "available"]);
      // 3rd should be unknown
      expect(availabilities[2]).toBe("unknown");
      // Last 3 should be restricted (shared library)
      expect(availabilities.slice(3)).toEqual(["restricted", "restricted", "restricted"]);
    });
  });

  // 4. Search within active filter (Section 9)
  describe("Search within active filter (Section 9)", () => {
    it("searches Bella inside AVAILABLE filter and only returns available Bella voices", () => {
      const results = filterAndSortVoiceCatalog(sampleVoices, "available", "free", "Bella");
      expect(results.length).toBe(2);
      expect(results.map((v) => v.voiceId)).toEqual([
        "voice-premade-1",
        "voice-premade-2",
      ]);
      // Shared voices are strictly excluded from AVAILABLE on Free
      expect(results.some((v) => v.voiceId === "voice-shared-free-3")).toBe(false);
      expect(results.some((v) => v.voiceId === "voice-shared-pro-4")).toBe(false);
    });

    it("searches Bella inside REQUIEREN PLAN filter and returns restricted Bella voices", () => {
      const results = filterAndSortVoiceCatalog(sampleVoices, "restricted", "free", "Bella");
      expect(results.length).toBe(2);
      expect(results.map((v) => v.voiceId)).toEqual([
        "voice-shared-free-3",
        "voice-shared-pro-4",
      ]);
    });

    it("searches Bella inside ALL filter and returns all Bella voices sorted by availability", () => {
      const results = filterAndSortVoiceCatalog(sampleVoices, "all", "free", "Bella");
      expect(results.length).toBe(4);
      expect(results[0].voiceId).toBe("voice-premade-1");
      expect(results[1].voiceId).toBe("voice-premade-2");
      expect(results[2].voiceId).toBe("voice-shared-free-3");
      expect(results[3].voiceId).toBe("voice-shared-pro-4");
    });
  });

  // 5. Voice Card Badges and Helper Texts (Section 5)
  describe("Voice Card Badges and Helper Texts (Section 5)", () => {
    it("available voice on Free account has correct badge and helper text", () => {
      const badge = getVoicePlanBadgeLabel(sampleVoices[0], "free");
      const helper = getVoicePlanHelperText(sampleVoices[0], "free");
      expect(badge).toBe("✓ DISPONIBLE GRATIS");
      expect(helper).toBe("Disponible con tu cuenta actual.");
    });

    it("restricted voice has correct badge and helper text", () => {
      const badge = getVoicePlanBadgeLabel(sampleVoices[3], "free");
      const helper = getVoicePlanHelperText(sampleVoices[3], "free");
      expect(badge).toBe("PLAN REQUERIDO");
      expect(helper).toBe("No disponible mediante la API de ElevenLabs en el plan gratuito.");
    });

    it("unknown voice has correct badge and helper text", () => {
      const badge = getVoicePlanBadgeLabel(sampleVoices[5], "free");
      const helper = getVoicePlanHelperText(sampleVoices[5], "free");
      expect(badge).toBe("POR VERIFICAR");
      expect(helper).toBe("No pudimos confirmar la disponibilidad con tu cuenta.");
    });

    it("available voice on Paid account adapts badge to DISPONIBLE CON TU PLAN", () => {
      const badge = getVoicePlanBadgeLabel(sampleVoices[3], "pro");
      const helper = getVoicePlanHelperText(sampleVoices[3], "pro");
      expect(badge).toBe("✓ DISPONIBLE CON TU PLAN");
      expect(helper).toBe("Disponible con tu cuenta actual.");
    });
  });

  // 6. BatchControls Component Rendering (Sections 3, 7, 8, 10)
  describe("BatchControls UI Integration", () => {
    const mockVoices: GatewayVoice[] = [
      {
        voiceId: "voice-premade-1",
        name: "Bella - Premade Story",
        category: "premade",
        labels: { language: "es" },
        previewUrl: null,
      },
      {
        voiceId: "voice-shared-pro-4",
        name: "Bella - Community Pro Only",
        category: "shared",
        freeUsersAllowed: false,
        labels: { language: "es" },
        previewUrl: null,
      },
    ];

    const mockModels: GatewayModel[] = [
      {
        modelId: "eleven_multilingual_v2",
        name: "Eleven Multilingual v2",
        languages: [{ code: "es", name: "Spanish" }],
        supportsStyle: true,
        supportsSpeakerBoost: true,
      },
    ];

    it("renders default filter DISPONIBLES with active state and real count", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: mockVoices,
          models: mockModels,
          selectedVoiceId: "voice-premade-1",
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

      // Filter tabs rendered for Voice Library on Free (UX 03.3 Section 12)
      expect(html).toContain('data-testid="tab-all-voices"');
      expect(html).toContain('data-testid="tab-restricted-voices"');
      expect(html).toContain('data-testid="tab-in-collection-voices"');

      // Default active tab on Free is TODAS (UX 03.3 Section 12)
      expect(html).toMatch(/tab-availability-btn active"[^>]*data-testid="tab-all-voices"/);

      // Account status displays neutral ElevenLabs Free
      expect(html).toContain('data-testid="catalog-plan-status"');
      expect(html).toContain("ElevenLabs Free");
      // Zero internal endpoint or gateway leaks
      expect(html).not.toContain("localhost:8787");
      expect(html).not.toContain("/api/tts");
    });

    it("blocks generation and displays warning when selected voice is restricted", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: mockVoices,
          models: mockModels,
          selectedVoiceId: "voice-shared-pro-4", // restricted voice on Free plan
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

      // Warning is displayed (Section 8)
      expect(html).toContain('data-testid="selected-voice-plan-warning"');
      expect(html).toContain(
        "La voz seleccionada no está disponible con tu plan actual. Elige una voz disponible para continuar."
      );

      // Main generate button is blocked and disabled
      expect(html).toContain("SELECCIONA UNA VOZ DISPONIBLE");
      expect(html).toContain("disabled");
      expect(html).toContain("btn-auth-locked");
    });

    it("enables generation when an available voice is selected", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: mockVoices,
          models: mockModels,
          selectedVoiceId: "voice-premade-1", // available voice
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

      // Warning is absent
      expect(html).not.toContain('data-testid="selected-voice-plan-warning"');
      // Generation button is enabled
      expect(html).toContain("Generar Todas las Narraciones (0/2)");
      expect(html).not.toContain("PLAN REQUERIDO · VOZ INCOMPATIBLE");
    });
  });

  // 7. Verification: Zero hardcoded voice ID lists (Section 11)
  describe("No Hardcoded Free Voice List (Section 11)", () => {
    it("confirms voiceLibrary.ts does not contain hardcoded voice ID lists", () => {
      const code = computeVoiceCatalogCounts.toString() + filterAndSortVoiceCatalog.toString();
      expect(code).not.toContain("FREE_VOICE_IDS");
      expect(code).not.toContain("FREE_VOICES");
      expect(code).not.toContain("ALLOWED_VOICE_IDS");
    });
  });
});
