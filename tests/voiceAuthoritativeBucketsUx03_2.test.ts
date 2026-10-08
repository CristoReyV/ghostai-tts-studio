/**
 * @file tests/voiceAuthoritativeBucketsUx03_2.test.ts
 * Tests for GHOSTAI TTS — UX 03.2:
 * Authoritative Voice Origin from ElevenLabs API Buckets & Provenance Preservation.
 *
 * Requirements:
 *  - Section 1: Use authoritative API endpoint/query provenance (no category guessing).
 *  - Section 2: Free account rule: tier === "free" AND voiceOrigin in ["shared_library", "library_copy"] => restricted (PLAN REQUERIDO).
 *  - Section 3: Catálogo Voice Library: on Free tier, Disponibles: 0, Todas: 12, Requieren plan: 12, Por verificar: 0.
 *  - Section 4: Merge contract: sharedLibraryOrigin = true survives all merges and dedupes.
 *  - Section 5: "EN TU COLECCIÓN" coexists with "PLAN REQUERIDO"; never promotes availability.
 *  - Section 6: Default provider voices are not classified as Voice Library.
 *  - Section 7: Personal / workspace evaluate capability without assuming available.
 *  - Section 11: All explicit unit test specifications from UX 03.2.
 */

import { describe, it, expect } from "vitest";
import {
  checkVoicePlanAvailability,
  determineVoiceOrigin,
  computeVoiceCatalogCounts,
  getVoicePlanHelperText,
  getVoicePlanBadgeLabel,
  mergeVoiceProvenance,
} from "../src/services/voiceLibrary";
import type { VoiceLibraryVoice } from "../src/types/tts";

describe("UX 03.2: Authoritative Voice Origin from ElevenLabs API Buckets (Section 11)", () => {
  // 1. Test: /v1/shared-voices record, tier free, no sharing metadata after normalization
  // EXPECTED: shared_library, restricted
  it("Test 1: /v1/shared-voices record on Free tier -> shared_library, restricted", () => {
    const sharedVoice = {
      voiceId: "voice-sv-001",
      name: "Tatiana Martin - Wise-speaking",
      sharedLibraryOrigin: true,
      voiceOrigin: "shared_library" as const,
      // No sharing metadata
    };

    const origin = determineVoiceOrigin(sharedVoice);
    expect(origin).toBe("shared_library");

    const check = checkVoicePlanAvailability(sharedVoice, "free");
    expect(check.availability).toBe("restricted");
    expect(check.badgeLabel).toBe("PLAN REQUERIDO");
    expect(check.isBlockedForSynthesis).toBe(true);
    expect(check.reason).toBe(
      "Las voces de Voice Library no están disponibles mediante la API de ElevenLabs en el plan gratuito."
    );
  });

  // 2. Test: Same voice also returned by /v2/voices?voice_type=community
  // EXPECTED: library_copy, restricted
  it("Test 2: Same voice also returned by v2 community bucket -> library_copy, restricted", () => {
    const communityVoice = {
      voiceId: "voice-sv-001",
      name: "Tatiana Martin - In Collection",
      sharedLibraryOrigin: true,
      voiceOrigin: "library_copy" as const,
    };

    const origin = determineVoiceOrigin(communityVoice);
    expect(origin).toBe("library_copy");

    const check = checkVoicePlanAvailability(communityVoice, "free");
    expect(check.availability).toBe("restricted");
    expect(check.badgeLabel).toBe("PLAN REQUERIDO");
    expect(check.isBlockedForSynthesis).toBe(true);
  });

  // 3. Test: community + bookmarked
  // EXPECTED: restricted
  it("Test 3: community + bookmarked -> restricted (bookmarking does not promote to API capability)", () => {
    const bookmarkedVoice = {
      voiceId: "voice-sv-002",
      name: "Fernando Martínez",
      voiceOrigin: "library_copy" as const,
      sharedLibraryOrigin: true,
      isBookmarked: true,
      libraryAllowsFreeUsers: true,
      freeUsersAllowed: true,
    };

    const check = checkVoicePlanAvailability(bookmarkedVoice, "free");
    expect(check.availability).toBe("restricted");
    expect(check.badgeLabel).toBe("PLAN REQUERIDO");
    expect(check.isBlockedForSynthesis).toBe(true);
  });

  // 4. Test: community + collection_ids
  // EXPECTED: restricted
  it("Test 4: community + collection_ids -> restricted (collection membership != API capability)", () => {
    const collectionVoice = {
      voiceId: "voice-sv-003",
      name: "Cristina Campos",
      voiceOrigin: "library_copy" as const,
      sharedLibraryOrigin: true,
      collection_ids: ["col-123", "col-456"],
      freeUsersAllowed: true,
    };

    const check = checkVoicePlanAvailability(collectionVoice, "free");
    expect(check.availability).toBe("restricted");
    expect(check.badgeLabel).toBe("PLAN REQUERIDO");
    expect(check.isBlockedForSynthesis).toBe(true);
  });

  // 5. Test: default bucket
  // EXPECTED: not classified as Voice Library
  it("Test 5: default bucket -> not classified as Voice Library (synthesizable on Free)", () => {
    const defaultVoice = {
      voiceId: "voice-def-001",
      name: "Rachel",
      voiceOrigin: "default" as const,
      sharedLibraryOrigin: false,
    };

    const origin = determineVoiceOrigin(defaultVoice);
    expect(origin).toBe("default");
    expect(origin).not.toBe("shared_library");
    expect(origin).not.toBe("library_copy");

    const check = checkVoicePlanAvailability(defaultVoice, "free");
    expect(check.availability).toBe("available");
    expect(check.badgeLabel).toBe("DISPONIBLE GRATIS");
    expect(check.isBlockedForSynthesis).toBe(false);
  });

  // 6. Test merge: shared source must survive dedupe
  it("Test 6: shared source must survive dedupe and merge", () => {
    // Original record from /v1/shared-voices
    const sharedRecord = {
      voiceId: "voice-sv-005",
      name: "Norah",
      sharedLibraryOrigin: true,
      voiceOrigin: "shared_library" as const,
    };

    // Account record from /v2/voices?voice_type=community
    const accountRecord = {
      voiceId: "voice-sv-005",
      voiceOrigin: "library_copy" as const,
      labels: { accent: "latin american" },
    };

    const merged = mergeVoiceProvenance(sharedRecord, accountRecord);
    expect(merged.sharedLibraryOrigin).toBe(true);
    expect(merged.voiceOrigin).toBe("library_copy");

    // Even if an incoming update doesn't have sharedLibraryOrigin, the base's provenance survives
    const genericUpdate = {
      voiceId: "voice-sv-005",
      name: "Norah - Renamed",
    };
    const merged2 = mergeVoiceProvenance(merged, genericUpdate);
    expect(merged2.sharedLibraryOrigin).toBe(true);
    expect(merged2.voiceOrigin).toBe("library_copy");

    // On Free tier, it remains restricted
    const check = checkVoicePlanAvailability(merged2, "free");
    expect(check.availability).toBe("restricted");
  });

  // 7. Catálogo Voice Library Contract: 12 cards on Free Account
  it("Test 7: Public Catalog Contract on Free account (12 cards -> 0 available, 12 restricted, 0 unknown)", () => {
    // 12 cards from real production audit: 4 in collection, 8 shared-only
    const catalogCards: VoiceLibraryVoice[] = [
      { voiceId: "CaJslL1x", name: "Cristina Campos", category: "professional", voiceOrigin: "library_copy", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 37537, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "dlGxemPx", name: "Fernando Martínez", category: "high_quality", voiceOrigin: "library_copy", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 10000, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "kcQkGnn0", name: "Norah", category: "high_quality", voiceOrigin: "library_copy", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 8000, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "l1zE9xgN", name: "Alberto Rodríguez", category: "high_quality", voiceOrigin: "library_copy", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 7500, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "qHkrJuif", name: "Andrea", category: "professional", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 5000, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "9F4C8ztp", name: "Dan", category: "professional", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 4500, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "2rigMbVW", name: "Tatiana Martin", category: "professional", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 4000, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "YDDaC9XK", name: "MariCarmen", category: "high_quality", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: false, clonedByCount: 3500, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: false, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "HMCmDsbK", name: "Johnny", category: "high_quality", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 3000, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "9oPKasc1", name: "Valeria", category: "professional", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 2500, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "YPh7Opor", name: "Angie Vendedora", category: "professional", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 2000, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
      { voiceId: "UOIqAnmS", name: "Carolina", category: "professional", voiceOrigin: "shared_library", sharedLibraryOrigin: true, freeUsersAllowed: true, clonedByCount: 1500, usageCharacterCount1y: 1000, featured: false, libraryAllowsFreeUsers: true, liveModerationEnabled: false, noticePeriod: 730, rate: 1, verifiedLanguages: [] },
    ];

    const counts = computeVoiceCatalogCounts(catalogCards, "free");
    expect(counts.available).toBe(0);
    expect(counts.total).toBe(12);
    expect(counts.restricted).toBe(12);
    expect(counts.unknown).toBe(0);

    // Each card must evaluate to restricted
    catalogCards.forEach((card) => {
      const check = checkVoicePlanAvailability(card, "free");
      expect(check.availability).toBe("restricted");
      expect(check.badgeLabel).toBe("PLAN REQUERIDO");
      expect(check.isBlockedForSynthesis).toBe(true);

      const label = getVoicePlanBadgeLabel(card, "free");
      expect(label).toBe("PLAN REQUERIDO");

      const helper = getVoicePlanHelperText(card, "free");
      expect(helper).toBe("No disponible mediante la API de ElevenLabs en el plan gratuito.");
    });
  });

  // 8. Secondary Metadata Coexistence: "EN TU COLECCIÓN" + "PLAN REQUERIDO"
  it("Test 8: EN TU COLECCIÓN coexists with PLAN REQUERIDO without promoting availability", () => {
    const cardInCollection = {
      voiceId: "CaJslL1x",
      name: "Cristina Campos",
      category: "professional",
      voiceOrigin: "library_copy" as const,
      sharedLibraryOrigin: true,
      freeUsersAllowed: true,
    };

    const check = checkVoicePlanAvailability(cardInCollection, "free");
    expect(check.availability).toBe("restricted");
    expect(check.badgeLabel).toBe("PLAN REQUERIDO");
    // In UI, secondary badge <span className="badge-in-collection">EN TU COLECCIÓN</span> displays alongside
  });
});
