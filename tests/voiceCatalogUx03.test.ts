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
      freeUsersAllowed: true,
      description: "Warm expressive voice",
      useCase: "narration",
    },
    {
      voiceId: "voice-cloned-2",
      name: "Marcus - Cloned Voice",
      category: "cloned",
      freeUsersAllowed: false,
      description: "Account custom voice",
      useCase: "conversational",
    },
    {
      voiceId: "voice-shared-free-3",
      name: "Bella - Community Free",
      category: "shared",
      freeUsersAllowed: true,
      description: "Community voice open to all",
      useCase: "news",
    },
    {
      voiceId: "voice-shared-pro-4",
      name: "Bella - Community Pro Only",
      category: "shared",
      freeUsersAllowed: false,
      description: "Restricted voice for paid subscribers",
      useCase: "narration",
    },
    {
      voiceId: "voice-shared-pro-5",
      name: "Arthur - Pro Documentary",
      category: "shared",
      freeUsersAllowed: false,
      description: "Deep voice for documentaries",
      useCase: "documentary",
    },
    {
      voiceId: "voice-unverified-6",
      name: "Charlie - Ambiguous Tier",
      category: "shared",
      description: "Unverified provider metadata",
      useCase: "general",
    },
  ];

  // 1. Dynamic Counts (Section 4)
  describe("Dynamic Counts (Section 4)", () => {
    it("computes accurate counts for Free account without hardcoded numbers", () => {
      const counts = computeVoiceCatalogCounts(sampleVoices, "free");
      // Available: premade (1) + cloned (1) + shared free (1) = 3
      // Restricted: shared pro 4 (1) + shared pro 5 (1) = 2
      // Unknown: unverified 6 (1) = 1
      // Total: 6
      expect(counts.available).toBe(3);
      expect(counts.restricted).toBe(2);
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
      expect(filtered.length).toBe(3);
      expect(filtered.map((v) => v.voiceId)).toEqual([
        "voice-premade-1",
        "voice-cloned-2",
        "voice-shared-free-3",
      ]);
      expect(filtered.some((v) => v.voiceId === "voice-shared-pro-4")).toBe(false);
      expect(filtered.some((v) => v.voiceId === "voice-unverified-6")).toBe(false);
    });

    it("restricted filter shows only restricted voices requiring a plan upgrade", () => {
      const filtered = filterAndSortVoiceCatalog(sampleVoices, "restricted", "free");
      expect(filtered.length).toBe(2);
      expect(filtered.map((v) => v.voiceId)).toEqual([
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
      // First 3 should be available
      expect(availabilities.slice(0, 3)).toEqual(["available", "available", "available"]);
      // 4th should be unknown
      expect(availabilities[3]).toBe("unknown");
      // Last 2 should be restricted
      expect(availabilities.slice(4)).toEqual(["restricted", "restricted"]);
    });
  });

  // 4. Search within active filter (Section 9)
  describe("Search within active filter (Section 9)", () => {
    it("searches Bella inside AVAILABLE filter and only returns available Bella voices", () => {
      const results = filterAndSortVoiceCatalog(sampleVoices, "available", "free", "Bella");
      expect(results.length).toBe(2);
      expect(results.map((v) => v.voiceId)).toEqual([
        "voice-premade-1",
        "voice-shared-free-3",
      ]);
      // The restricted "Bella - Community Pro Only" is excluded
      expect(results.some((v) => v.voiceId === "voice-shared-pro-4")).toBe(false);
    });

    it("searches Bella inside REQUIEREN PLAN filter and only returns restricted Bella", () => {
      const results = filterAndSortVoiceCatalog(sampleVoices, "restricted", "free", "Bella");
      expect(results.length).toBe(1);
      expect(results[0].voiceId).toBe("voice-shared-pro-4");
    });

    it("searches Bella inside ALL filter and returns all Bella voices sorted by availability", () => {
      const results = filterAndSortVoiceCatalog(sampleVoices, "all", "free", "Bella");
      expect(results.length).toBe(3);
      expect(results[0].voiceId).toBe("voice-premade-1");
      expect(results[1].voiceId).toBe("voice-shared-free-3");
      expect(results[2].voiceId).toBe("voice-shared-pro-4");
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
      expect(helper).toBe("Esta voz requiere un plan compatible de ElevenLabs.");
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
        })
      );

      // Filter tabs rendered
      expect(html).toContain('data-testid="tab-available-voices"');
      expect(html).toContain('data-testid="tab-all-voices"');
      expect(html).toContain('data-testid="tab-restricted-voices"');
      expect(html).toContain('data-testid="tab-unknown-voices"');

      // Default active tab is available
      expect(html).toMatch(/tab-availability-btn active"[^>]*data-testid="tab-available-voices"/);

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
      expect(html).toContain("PLAN REQUERIDO · VOZ INCOMPATIBLE");
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
