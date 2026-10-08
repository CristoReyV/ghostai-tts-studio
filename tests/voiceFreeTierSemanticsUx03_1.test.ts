/**
 * @file tests/voiceFreeTierSemanticsUx03_1.test.ts
 * Critical Tests for UX 03.1: Free-Tier Voice Library API Semantics.
 *
 * Verifies official ElevenLabs rule:
 * "Voice Library voices are not available via the API to free tier users."
 * Tests A, B, C, D, E, F as specified in Section 16.
 */

import { describe, it, expect } from "vitest";
import {
  checkVoicePlanAvailability,
  determineVoiceOrigin,
  getVoicePlanHelperText,
  getVoicePlanBadgeLabel,
} from "../src/services/voiceLibrary";
import type { VoiceLibraryVoice, GatewayVoice } from "../src/types/tts";

describe("UX 03.1: Critical Specification Tests (Section 16)", () => {
  // TEST A: tier = free, source = shared_library, freeUsersAllowed = true
  // EXPECTED: restricted, PLAN REQUERIDO, generation blocked
  describe("TEST A: Free account + shared_library + freeUsersAllowed=true", () => {
    const voiceA = {
      voiceId: "voice-shared-1",
      name: "Cristina Campos",
      category: "professional",
      voiceOrigin: "shared_library" as const,
      libraryAllowsFreeUsers: true,
      freeUsersAllowed: true,
    };

    it("evaluates as restricted with PLAN REQUERIDO and blocks synthesis", () => {
      const check = checkVoicePlanAvailability(voiceA, "free");
      expect(check.availability).toBe("restricted");
      expect(check.badgeLabel).toBe("PLAN REQUERIDO");
      expect(check.isBlockedForSynthesis).toBe(true);
      expect(check.reason).toBe(
        "Las voces de Voice Library no están disponibles mediante la API de ElevenLabs en el plan gratuito."
      );
    });

    it("displays correct helper text reflecting API restriction", () => {
      const helper = getVoicePlanHelperText(voiceA, "free");
      expect(helper).toBe("No disponible mediante la API de ElevenLabs en el plan gratuito.");
    });
  });

  // TEST B: tier = free, source = shared_library, freeUsersAllowed = false
  // EXPECTED: restricted
  describe("TEST B: Free account + shared_library + freeUsersAllowed=false", () => {
    const voiceB = {
      voiceId: "voice-shared-2",
      name: "Arthur - Pro Only",
      category: "professional",
      voiceOrigin: "shared_library" as const,
      libraryAllowsFreeUsers: false,
      freeUsersAllowed: false,
    };

    it("evaluates as restricted with PLAN REQUERIDO and blocks synthesis", () => {
      const check = checkVoicePlanAvailability(voiceB, "free");
      expect(check.availability).toBe("restricted");
      expect(check.badgeLabel).toBe("PLAN REQUERIDO");
      expect(check.isBlockedForSynthesis).toBe(true);
    });
  });

  // TEST C: tier = free, source = library_copy, isBookmarked = true, freeUsersAllowed = true
  // EXPECTED: restricted (Being in My Voices does not make it API-compatible)
  describe("TEST C: Free account + library_copy (in My Voices / Bookmarked)", () => {
    const voiceC = {
      voiceId: "voice-copy-3",
      name: "Rogher - In Collection",
      category: "shared",
      voiceOrigin: "library_copy" as const,
      publicOwnerId: "owner-abc-123",
      isBookmarked: true,
      libraryAllowsFreeUsers: true,
      freeUsersAllowed: true,
    };

    it("evaluates as restricted even when bookmarked or added to collection", () => {
      const check = checkVoicePlanAvailability(voiceC, "free");
      expect(check.availability).toBe("restricted");
      expect(check.badgeLabel).toBe("PLAN REQUERIDO");
      expect(check.isBlockedForSynthesis).toBe(true);
    });

    it("displays helper text indicating API restriction on Free plan", () => {
      const helper = getVoicePlanHelperText(voiceC, "free");
      expect(helper).toBe("No disponible mediante la API de ElevenLabs en el plan gratuito.");
    });
  });

  // TEST D: tier = free, source = premade, provider evidence valid
  // EXPECTED: available
  describe("TEST D: Free account + premade default provider voice", () => {
    const voiceD = {
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      name: "Rachel",
      category: "premade",
      voiceOrigin: "premade" as const,
      availableForTiers: ["free", "starter", "creator", "pro"],
    };

    it("evaluates as available with DISPONIBLE GRATIS and allows synthesis", () => {
      const check = checkVoicePlanAvailability(voiceD, "free");
      expect(check.availability).toBe("available");
      expect(check.badgeLabel).toBe("DISPONIBLE GRATIS");
      expect(check.isBlockedForSynthesis).toBe(false);
    });

    it("displays helper text: Disponible con tu cuenta actual.", () => {
      const helper = getVoicePlanHelperText(voiceD, "free");
      expect(helper).toBe("Disponible con tu cuenta actual.");
    });
  });

  // TEST E: tier = free, source = unknown, no explicit capability
  // EXPECTED: unknown, NOT available (Fail closed)
  describe("TEST E: Free account + unknown voice provenance (Fail closed)", () => {
    const voiceE = {
      voiceId: "voice-mystery-5",
      name: "Mystery Voice",
    };

    it("evaluates as unknown rather than falsely claiming available (fail closed)", () => {
      const check = checkVoicePlanAvailability(voiceE, "free");
      expect(check.availability).toBe("unknown");
      expect(check.badgeLabel).toBe("POR VERIFICAR");
      expect(check.isBlockedForSynthesis).toBe(false);
    });
  });

  // TEST F: paid compatible account + shared library voice
  // EXPECTED: available (evaluated using paid capability rules without applying Free-only restriction)
  describe("TEST F: Paid account + shared library voice", () => {
    const voiceF = {
      voiceId: "voice-shared-6",
      name: "Valentina - Shared Library",
      category: "professional",
      voiceOrigin: "shared_library" as const,
      libraryAllowsFreeUsers: false,
      freeUsersAllowed: false,
    };

    it("evaluates as available with DISPONIBLE CON TU PLAN for paid tiers", () => {
      const checkStarter = checkVoicePlanAvailability(voiceF, "starter");
      expect(checkStarter.availability).toBe("available");
      expect(checkStarter.badgeLabel).toBe("DISPONIBLE CON TU PLAN");
      expect(checkStarter.isBlockedForSynthesis).toBe(false);

      const checkPro = checkVoicePlanAvailability(voiceF, "pro");
      expect(checkPro.availability).toBe("available");
      expect(checkPro.badgeLabel).toBe("DISPONIBLE CON TU PLAN");
      expect(checkPro.isBlockedForSynthesis).toBe(false);
    });
  });
});
