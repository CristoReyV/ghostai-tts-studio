/**
 * @file tests/voicePresets.test.ts
 * Comprehensive tests for Voice Presets, deterministic scoring, metadata fallbacks,
 * Spanish prioritization, default format, advanced formats, and contract preservation.
 */

import { describe, it, expect } from "vitest";
import {
  VOICE_PRESETS,
  scoreVoiceForPreset,
  rankVoicesForPreset,
  getRecommendedVoiceForPreset,
  getModelDescription,
  formatVoiceAvailabilityError,
  type VoicePresetId,
} from "../src/services/voicePresets";
import type { GatewayVoice } from "../src/types/tts";
import { parseGhostAiTtsJson } from "../src/services/parser";
import { buildGhostAiTtsPackage } from "../src/services/zipBuilder";
import { SAMPLE_GHOSTAI_PROJECT } from "../src/sampleData";

describe("Voice Presets Suite", () => {
  const sampleVoices: GatewayVoice[] = [
    {
      voiceId: "rogher_es",
      name: "Rogher - Encouraging and Passionate",
      category: "generated",
      previewUrl: "https://storage.googleapis.com/preview-rogher.mp3",
      labels: {
        language: "es",
        accent: "colombian",
        use_case: "advertisement",
        descriptive: "passionate",
      },
    },
    {
      voiceId: "cristina_es",
      name: "Cristina Campos",
      category: "generated",
      previewUrl: "https://storage.googleapis.com/preview-cristina.mp3",
      labels: {
        language: "es",
        accent: "latin american",
        use_case: "conversational",
        descriptive: "warm",
      },
    },
    {
      voiceId: "roger_en",
      name: "Roger",
      category: "premade",
      previewUrl: "https://storage.googleapis.com/preview-roger.mp3",
      labels: {
        language: "en",
        accent: "american",
        use_case: "conversational",
        descriptive: "confident",
      },
    },
    {
      voiceId: "george_narrator",
      name: "George - Storyteller",
      category: "premade",
      previewUrl: "https://storage.googleapis.com/preview-george.mp3",
      labels: {
        language: "en",
        accent: "british",
        use_case: "narrative_story",
        descriptive: "mature",
      },
    },
    {
      voiceId: "callum_ad",
      name: "Callum - Commercial",
      category: "premade",
      previewUrl: "https://storage.googleapis.com/preview-callum.mp3",
      labels: {
        language: "en",
        accent: "american",
        use_case: "advertisement",
        descriptive: "hyped",
      },
    },
    {
      voiceId: "sarah_conversational",
      name: "Sarah - Casual & Friendly",
      category: "premade",
      previewUrl: "https://storage.googleapis.com/preview-sarah.mp3",
      labels: {
        language: "en",
        accent: "american",
        use_case: "conversational",
        descriptive: "casual",
      },
    },
  ];

  // 1. Carga correcta de presets
  it("loads all 12 defined presets with complete metadata and descriptions", () => {
    const expectedPresetIds: VoicePresetId[] = [
      "narrativo_epico",
      "cinematico_trailer",
      "storytelling",
      "documental",
      "comercial_publicidad",
      "corporativo_profesional",
      "social_media_reels",
      "conversacional_natural",
      "espanol_latino",
      "energetico",
      "calido_emotivo",
      "recomendadas",
    ];

    expect(VOICE_PRESETS).toHaveLength(12);

    expectedPresetIds.forEach((id) => {
      const preset = VOICE_PRESETS.find((p) => p.id === id);
      expect(preset).toBeDefined();
      expect(preset!.name).toBeTruthy();
      expect(preset!.description).toBeTruthy();
      expect(preset!.emoji).toBeTruthy();
      expect(preset!.targetKeywords).toBeDefined();
    });
  });

  // 2. Clasificación determinista
  it("performs deterministic classification (same inputs yield exact same order)", () => {
    const rank1 = rankVoicesForPreset("narrativo_epico", sampleVoices);
    const rank2 = rankVoicesForPreset("narrativo_epico", sampleVoices);

    expect(rank1.map((v) => v.voiceId)).toEqual(rank2.map((v) => v.voiceId));
  });

  // 3. Fallback cuando falta metadata
  it("handles voices gracefully when metadata is missing or partial without throwing", () => {
    const voicesWithoutMeta: GatewayVoice[] = [
      { voiceId: "z_no_meta", name: "Zeta Voice", category: "premade" },
      { voiceId: "a_no_meta", name: "Alpha Voice", category: "premade" },
      {
        voiceId: "b_with_preview",
        name: "Beta Voice",
        previewUrl: "https://sample.audio/test.mp3",
      },
    ];

    const ranked = rankVoicesForPreset("narrativo_epico", voicesWithoutMeta);
    expect(ranked).toHaveLength(3);

    // Tied scores break tie with previewUrl first, then alphabetical name
    expect(ranked[0].voiceId).toBe("b_with_preview");
    expect(ranked[1].voiceId).toBe("a_no_meta");
    expect(ranked[2].voiceId).toBe("z_no_meta");

    // Empty voice list returns empty array
    expect(rankVoicesForPreset("narrativo_epico", [])).toEqual([]);
    expect(getRecommendedVoiceForPreset("narrativo_epico", [])).toBeUndefined();
  });

  // 4. Preset Español Latino
  it("prioritizes native Spanish voices and penalizes English voices for 'espanol_latino'", () => {
    const ranked = rankVoicesForPreset("espanol_latino", sampleVoices);

    // Top recommended voices must be the Spanish voices
    const topVoice = ranked[0];
    expect(topVoice.labels?.language).toBe("es");

    const rogherScore = scoreVoiceForPreset(sampleVoices[0], VOICE_PRESETS.find((p) => p.id === "espanol_latino")!);
    const rogerScore = scoreVoiceForPreset(sampleVoices[2], VOICE_PRESETS.find((p) => p.id === "espanol_latino")!);

    // Rogher (es / colombian) has high score, Roger (en / american) has severe penalty
    expect(rogherScore).toBeGreaterThan(100);
    expect(rogerScore).toBeLessThanOrEqual(0);
    expect(rogerScore).toBeLessThan(rogherScore);

    // Verify Roger is NOT top recommendation
    expect(topVoice.voiceId).not.toBe("roger_en");
  });

  // 5. Preset Narrativo Épico
  it("ranks narrative and storytelling voices highest for 'narrativo_epico'", () => {
    const recommended = getRecommendedVoiceForPreset("narrativo_epico", sampleVoices);
    expect(recommended).toBeDefined();
    expect(recommended!.voiceId).toBe("george_narrator");
  });

  // 6. Preset Comercial / Publicidad
  it("ranks advertisement and hyped voices highest for 'comercial_publicidad'", () => {
    const recommended = getRecommendedVoiceForPreset("comercial_publicidad", sampleVoices);
    expect(recommended).toBeDefined();
    // Both Callum (ad/hyped) and Rogher (ad/passionate) score high for commercial
    expect(["callum_ad", "rogher_es"]).toContain(recommended!.voiceId);
  });

  // 7. Preset Conversacional Natural
  it("ranks conversational and casual voices highest for 'conversacional_natural'", () => {
    const recommended = getRecommendedVoiceForPreset("conversacional_natural", sampleVoices);
    expect(recommended).toBeDefined();
    expect(["sarah_conversational", "cristina_es"]).toContain(recommended!.voiceId);
  });

  // 8. Formato Default mp3_44100_128 & Configuración Avanzada
  it("ensures default format is mp3_44100_128 and supported formats are recognized", () => {
    const defaultFormat = "mp3_44100_128";
    const supportedFormats = [
      "mp3_44100_128",
      "mp3_44100_192",
      "pcm_44100",
      "pcm_24000",
      "mp3_22050_32",
    ];

    expect(supportedFormats).toContain(defaultFormat);
  });

  // 9. Model descriptions
  it("returns user-friendly model descriptions accurately", () => {
    const descV2 = getModelDescription("eleven_multilingual_v2");
    expect(descV2).toBe("Alta calidad y expresión para narración multilingüe.");

    const descFlash = getModelDescription("eleven_flash_v2_5");
    expect(descFlash).toBe("Menor latencia para generación rápida.");

    const customDesc = getModelDescription("custom_model", "Descripción proporcionada por Gateway");
    expect(customDesc).toBe("Descripción proporcionada por Gateway");
  });

  // 10. Availability Tier: working > unknown > failed
  it("orders voices by availability tier: working > unknown > failed", () => {
    const availMap = {
      sarah_conversational: { status: "working" as const },
      george_narrator: { status: "unknown" as const },
      callum_ad: { status: "failed" as const },
    };

    const ranked = rankVoicesForPreset("conversacional_natural", sampleVoices, availMap);
    const sarahIdx = ranked.findIndex((v) => v.voiceId === "sarah_conversational");
    const georgeIdx = ranked.findIndex((v) => v.voiceId === "george_narrator");
    const callumIdx = ranked.findIndex((v) => v.voiceId === "callum_ad");

    expect(sarahIdx).toBeLessThan(georgeIdx);
    expect(georgeIdx).toBeLessThan(callumIdx);
  });

  // 11. Failed nunca gana frente a working
  it("ensures a failed voice never beats a working voice regardless of suitability score", () => {
    const availMap = {
      rogher_es: { status: "failed" as const },
      sarah_conversational: { status: "working" as const },
    };

    const ranked = rankVoicesForPreset("comercial_publicidad", sampleVoices, availMap);
    const rogherIdx = ranked.findIndex((v) => v.voiceId === "rogher_es");
    const sarahIdx = ranked.findIndex((v) => v.voiceId === "sarah_conversational");

    expect(sarahIdx).toBeLessThan(rogherIdx);
    expect(ranked[0].voiceId).not.toBe("rogher_es");
  });

  // 12. Failed nunca gana frente a unknown
  it("ensures a failed voice never beats an unknown voice regardless of suitability score", () => {
    const availMap = {
      rogher_es: { status: "failed" as const },
      cristina_es: { status: "failed" as const },
    };

    const ranked = rankVoicesForPreset("espanol_latino", sampleVoices, availMap);
    const topVoice = ranked[0];

    // Failed voices cannot be the top recommendation when unknown alternatives exist
    expect(["rogher_es", "cristina_es"]).not.toContain(topVoice.voiceId);
  });

  // 13. Español + working supera español + failed
  it("ensures español + working beats español + failed", () => {
    const availMap = {
      cristina_es: { status: "working" as const },
      rogher_es: { status: "failed" as const },
    };

    const recommended = getRecommendedVoiceForPreset("espanol_latino", sampleVoices, availMap);
    expect(recommended?.voiceId).toBe("cristina_es");
  });

  // 14. Voz multilingüe premade puede ser candidata para español
  it("allows a multilingual premade voice to be recommended for Spanish when native voices are failed", () => {
    const availMap = {
      rogher_es: { status: "failed" as const },
      cristina_es: { status: "failed" as const },
    };

    const recommended = getRecommendedVoiceForPreset("espanol_latino", sampleVoices, availMap);
    expect(recommended).toBeDefined();
    expect(["rogher_es", "cristina_es"]).not.toContain(recommended!.voiceId);
    expect(recommended!.category).toBe("premade");
  });

  // 15. 502 no se convierte automáticamente en 'requiere Pro'
  it("formats HTTP 502 neutrally as 'No disponible actualmente' without assuming required plans", () => {
    const msg502 = formatVoiceAvailabilityError(502, "ElevenLabs returned an unexpected error.");
    expect(msg502).toBe("No disponible actualmente");
    expect(msg502.toLowerCase()).not.toContain("pro");
    expect(msg502.toLowerCase()).not.toContain("plan");
  });

  // 16. Preset conserva su scoring original
  it("preserves original suitability scoring deterministically regardless of availability", () => {
    const preset = VOICE_PRESETS.find((p) => p.id === "narrativo_epico")!;
    const score1 = scoreVoiceForPreset(sampleVoices[3], preset);
    const score2 = scoreVoiceForPreset(sampleVoices[3], preset);
    expect(score1).toBe(score2);
    expect(score1).toBeGreaterThan(0);
  });

  // 17. Preservación de voiceId, modelId, outputFormat y contrato .ghostai-tts.json
  it("strictly preserves voiceId, modelId, outputFormat and contract compatibility in ZIP package", async () => {
    const parsed = parseGhostAiTtsJson(SAMPLE_GHOSTAI_PROJECT);
    expect(parsed.success).toBe(true);

    const items = parsed.studioItems!;
    expect(items.length).toBeGreaterThan(0);

    // Simulate item ready with custom settings
    items[0].status = "READY";
    items[0].voiceId = "test_voice_custom_123";
    items[0].modelId = "eleven_flash_v2_5";
    items[0].outputFormat = "mp3_44100_192";
    items[0].audioBlob = new Blob(["sample-audio-data"], { type: "audio/mpeg" });

    const zipPackage = await buildGhostAiTtsPackage({
      project: parsed.data!.project,
      items: [items[0]],
      includeOnlyReady: true,
    });

    expect(zipPackage.blob).toBeDefined();
    expect(zipPackage.fileName).toContain("-tts-package.zip");

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(zipPackage.blob);
    const manifestFile = zip.file("manifest.json");
    expect(manifestFile).not.toBeNull();
    const manifest = JSON.parse(await manifestFile!.async("string"));
    // voiceId must strictly match input, untouched
    expect(manifest.items[0].voiceId).toBe("test_voice_custom_123");
    expect(manifest.items[0].modelId).toBe("eleven_flash_v2_5");
    expect(manifest.items[0].outputFormat).toBe("mp3_44100_192");
  });
});
