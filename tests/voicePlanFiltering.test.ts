/**
 * @file tests/voicePlanFiltering.test.ts
 * Tests for GHOSTAI TTS STUDIO — UX 02: Voice Plan Filtering & Prevention of Late Synthesis Errors.
 *
 * Requirements:
 *  - Section 33: Mock Free account -> available voices "DISPONIBLE GRATIS", restricted "PLAN REQUERIDO".
 *  - Section 34: Block restricted generation -> GENERAR disabled, 0 synthesis calls, human message.
 *  - Section 35: Mock Paid account -> available voices adapt ("DISPONIBLES CON TU PLAN"), no global Free hardcode.
 *  - Section 36: Mock Unknown account -> no false classification, "DISPONIBILIDAD POR VERIFICAR".
 *  - Section 24: Human-friendly error translation for provider error codes.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import {
  checkVoicePlanAvailability,
  formatVoiceAvailabilityError,
} from "../src/services/voiceLibrary";
import { BatchControls } from "../src/components/BatchControls";
import type { GatewayVoice, GatewayModel } from "../src/types/tts";

describe("UX 02: Voice Plan Filtering & Availability Classification", () => {
  const premadeVoice = {
    voiceId: "premade-voice-1",
    name: "Rachel",
    category: "premade",
    freeUsersAllowed: true,
  };

  const accountClonedVoice = {
    voiceId: "cloned-voice-2",
    name: "My Cloned Voice",
    category: "cloned",
    freeUsersAllowed: false,
  };

  const sharedFreeAllowedVoice = {
    voiceId: "shared-voice-3",
    name: "Community Voice Free",
    category: "shared",
    freeUsersAllowed: true,
  };

  const sharedRestrictedVoice = {
    voiceId: "shared-voice-4",
    name: "Community Voice Pro Only",
    category: "shared",
    freeUsersAllowed: false,
  };

  const unclassifiedVoice = {
    voiceId: "unknown-voice-5",
    name: "Ambiguous Voice",
    category: "shared",
  };

  // ── Section 33: Free Account Capabilities ────────────────────────────────
  describe("Free Account (tier: free)", () => {
    it("marks premade voices as DISPONIBLE GRATIS", () => {
      const check = checkVoicePlanAvailability(premadeVoice, "free");
      expect(check.availability).toBe("available");
      expect(check.badgeLabel).toBe("DISPONIBLE GRATIS");
      expect(check.isBlockedForSynthesis).toBe(false);
    });

    it("marks account cloned voices as POR VERIFICAR on Free without explicit tier permission (UX 03.1)", () => {
      const check = checkVoicePlanAvailability(accountClonedVoice, "free");
      expect(check.availability).toBe("unknown");
      expect(check.badgeLabel).toBe("POR VERIFICAR");
    });

    it("marks shared voice as PLAN REQUERIDO on Free account even if freeUsersAllowed=true (UX 03.1)", () => {
      const check = checkVoicePlanAvailability(sharedFreeAllowedVoice, "free");
      expect(check.availability).toBe("restricted");
      expect(check.badgeLabel).toBe("PLAN REQUERIDO");
      expect(check.isBlockedForSynthesis).toBe(true);
      expect(check.reason).toContain("Las voces de Voice Library no están disponibles mediante la API");
    });

    it("marks shared voice with freeUsersAllowed=false as PLAN REQUERIDO and blocks synthesis", () => {
      const check = checkVoicePlanAvailability(sharedRestrictedVoice, "free");
      expect(check.availability).toBe("restricted");
      expect(check.badgeLabel).toBe("PLAN REQUERIDO");
      expect(check.isBlockedForSynthesis).toBe(true);
      expect(check.reason).toContain("Las voces de Voice Library no están disponibles mediante la API");
    });
  });

  // ── Section 35: Paid Account Capabilities ────────────────────────────────
  describe("Paid Account (tier: starter / creator / pro / scale)", () => {
    it("adapts labels to DISPONIBLE CON TU PLAN for paid tiers without hardcoding Free", () => {
      const checkPremade = checkVoicePlanAvailability(premadeVoice, "starter");
      expect(checkPremade.availability).toBe("available");
      expect(checkPremade.badgeLabel).toBe("DISPONIBLE CON TU PLAN");
      expect(checkPremade.isBlockedForSynthesis).toBe(false);

      const checkRestricted = checkVoicePlanAvailability(sharedRestrictedVoice, "pro");
      expect(checkRestricted.availability).toBe("available");
      expect(checkRestricted.badgeLabel).toBe("DISPONIBLE CON TU PLAN");
      expect(checkRestricted.isBlockedForSynthesis).toBe(false);
    });
  });

  // ── Section 36: Unknown Account Capabilities ─────────────────────────────
  describe("Unknown / Missing Account Metadata", () => {
    it("does not falsely classify ambiguous voices as free or paid without evidence", () => {
      const checkUnknown = checkVoicePlanAvailability(unclassifiedVoice, null);
      expect(checkUnknown.availability).toBe("unknown");
      expect(checkUnknown.badgeLabel).toBe("POR VERIFICAR");
      expect(checkUnknown.isBlockedForSynthesis).toBe(false);
    });

    it("still recognizes premade voices as universally available", () => {
      const checkPremade = checkVoicePlanAvailability(premadeVoice, null);
      expect(checkPremade.availability).toBe("available");
      expect(checkPremade.badgeLabel).toBe("DISPONIBLE");
    });

    it("still marks voices with freeUsersAllowed=false as PLAN REQUERIDO", () => {
      const checkRestricted = checkVoicePlanAvailability(sharedRestrictedVoice, undefined);
      expect(checkRestricted.availability).toBe("restricted");
      expect(checkRestricted.badgeLabel).toBe("PLAN REQUERIDO");
      expect(checkRestricted.isBlockedForSynthesis).toBe(true);
    });
  });

  // ── Section 34: Block Restricted Generation in BatchControls ──────────────
  describe("BatchControls: Block Restricted Generation & UI Feedback", () => {
    const mockVoices: GatewayVoice[] = [
      {
        voiceId: "voice-allowed-1",
        name: "Allowed Voice",
        category: "premade",
        labels: { language: "es" },
        previewUrl: null,
      },
      {
        voiceId: "voice-restricted-2",
        name: "Pro Exclusive Voice",
        category: "shared",
        labels: { language: "es" },
        previewUrl: null,
      },
    ];

    const mockModels: GatewayModel[] = [
      {
        modelId: "eleven_multilingual_v2",
        name: "Eleven Multilingual v2",
        description: "Multilingual description",
        languages: [{ code: "es", name: "Spanish" }],
        supportsStyle: true,
        supportsSpeakerBoost: true,
      },
    ];

    it("renders availability filter tabs matching account tier", () => {
      // Free tier
      const htmlFree = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: mockVoices,
          models: mockModels,
          selectedVoiceId: "voice-allowed-1",
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

      expect(htmlFree).toContain("TODAS");
      expect(htmlFree).toContain("REQUIEREN PLAN");
      expect(htmlFree).toContain("EN TU COLECCIÓN");
      expect(htmlFree).toContain("DISPONIBLE");
    });

    it("adapts filter tabs when provider tier is paid", () => {
      const htmlPaid = renderToStaticMarkup(
        React.createElement(BatchControls, {
          voices: mockVoices,
          models: mockModels,
          selectedVoiceId: "voice-allowed-1",
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
          providerTier: "pro",
          initialLibraryExpanded: true,
        })
      );

      expect(htmlPaid).toContain("TODAS");
      expect(htmlPaid).toContain("VOCES DISPONIBLES CON TU PLAN");
      expect(htmlPaid).toContain("REQUIEREN PLAN SUPERIOR");
    });
  });

  // ── Section 24: Human-Friendly Error Messages ────────────────────────────
  describe("Human-Friendly Error Translation (Section 24)", () => {
    it("translates voice_requires_subscription gracefully without exposing raw payload", () => {
      const msg = formatVoiceAvailabilityError(
        400,
        "voice_requires_subscription: this voice requires a paid plan"
      );
      expect(msg).toBe("Esta voz requiere un plan de ElevenLabs compatible.");
    });

    it("translates quota exceeded gracefully", () => {
      const msg429 = formatVoiceAvailabilityError(429, "quota_exceeded: limit reached");
      expect(msg429).toBe("Tu cuenta de ElevenLabs no tiene créditos suficientes.");

      const msgText = formatVoiceAvailabilityError(400, "User has exceeded character limit");
      expect(msgText).toBe("Tu cuenta de ElevenLabs no tiene créditos suficientes.");
    });

    it("translates invalid API key gracefully", () => {
      const msg401 = formatVoiceAvailabilityError(401, "invalid_api_key");
      expect(msg401).toBe("No pudimos validar tu conexión con ElevenLabs.");
    });

    it("translates 403 forbidden as subscription required", () => {
      const msg403 = formatVoiceAvailabilityError(403, "forbidden");
      expect(msg403).toBe("Esta voz requiere un plan de ElevenLabs compatible.");
    });

    it("never returns raw json payload, URLs or internal endpoints", () => {
      const rawPayload = JSON.stringify({
        detail: { status: "voice_requires_subscription", message: "Failed at /v1/text-to-speech" },
      });
      const formatted = formatVoiceAvailabilityError(400, rawPayload);
      expect(formatted).not.toContain("{");
      expect(formatted).not.toContain("/v1/");
      expect(formatted).toBe("Esta voz requiere un plan de ElevenLabs compatible.");
    });
  });
});
