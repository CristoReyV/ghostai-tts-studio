/**
 * @file tests/voiceLibrary.test.ts
 * Comprehensive test suite for the dynamic Voice Library architecture:
 * IDIOMA -> CATEGORÍA -> FILTROS SECUNDARIOS -> VOCES DISPONIBLES
 *
 * Verifies dynamic ranking, official categories, language filtering,
 * Spanish priority, secondary filters, preview behavior, and zero generation calls.
 */

import { describe, it, expect, vi } from "vitest";
import {
  OFFICIAL_CATEGORIES,
  OFFICIAL_LANGUAGES,
  scoreVoice,
  filterVoices,
  getRecommendedVoice,
  getAvailableAccents,
  getVoiceStyleTags,
  type VoiceFilterCriteria,
} from "../src/services/voiceLibrary";
import type { GatewayVoice } from "../src/types/tts";

describe("Voice Library - Architecture & Dynamic Ranking Suite", () => {
  // Realistic catalog matching ElevenLabs real API metadata structure
  const realVoicesCatalog: GatewayVoice[] = [
    {
      voiceId: "UaeEQHfiDI8l58WWXiwS",
      name: "Leonardo Hamaral - Warm and Confident",
      category: "professional",
      labels: {
        language: "pt",
        accent: "brazilian",
        use_case: "advertisement",
        gender: "male",
        age: "middle_aged",
        descriptive: "hyped",
      },
      previewUrl: "https://storage.googleapis.com/preview-leonardo.mp3",
    },
    {
      voiceId: "0ji4DHZV895MuXeZB0PL",
      name: "Rogher - Encouraging and Passionate",
      category: "professional",
      labels: {
        language: "es",
        accent: "colombian",
        use_case: "advertisement",
        gender: "male",
        age: "middle_aged",
        descriptive: "classy",
      },
      previewUrl: "https://storage.googleapis.com/preview-rogher.mp3",
    },
    {
      voiceId: "CaJslL1xziwefCeTNzHv",
      name: "Cristina Campos",
      category: "professional",
      labels: {
        language: "es",
        accent: "latin american",
        use_case: "conversational",
        gender: "female",
        age: "young",
        descriptive: "casual",
      },
      previewUrl: "https://storage.googleapis.com/preview-cristina.mp3",
    },
    {
      voiceId: "crQgCQuWgUucmYHEPsrB",
      name: "Fran - Fresh & Upbeat",
      category: "professional",
      labels: {
        language: "es",
        accent: "latin american",
        use_case: "conversational",
        gender: "female",
        age: "young",
        descriptive: "excited",
      },
      previewUrl: "https://storage.googleapis.com/preview-fran.mp3",
    },
    {
      voiceId: "JBFqnCBsd6RMkjVDRZzb",
      name: "George - Warm, Captivating Storyteller",
      category: "premade",
      labels: {
        language: "en",
        accent: "british",
        use_case: "narrative_story",
        gender: "male",
        age: "middle_aged",
        descriptive: "warm",
      },
      previewUrl: "https://storage.googleapis.com/preview-george.mp3",
    },
    {
      voiceId: "N2lVS1w4EtoT3dr4eOWO",
      name: "Callum - Husky Trickster",
      category: "premade",
      labels: {
        language: "en",
        accent: "american",
        use_case: "characters_animation",
        gender: "male",
        age: "middle_aged",
        descriptive: "intense",
      },
      previewUrl: "https://storage.googleapis.com/preview-callum.mp3",
    },
    {
      voiceId: "hpp4J3VqgZpRt0q8x9Yw",
      name: "Bella - Professional & Articulate",
      category: "premade",
      labels: {
        language: "en",
        accent: "american",
        use_case: "informative_educational",
        gender: "female",
        age: "middle_aged",
        descriptive: "calm",
      },
      previewUrl: "https://storage.googleapis.com/preview-bella.mp3",
    },
    {
      voiceId: "FGY2WhTYp9aZ18o3V2mP",
      name: "Laura - Enthusiastic & Dynamic",
      category: "premade",
      labels: {
        language: "en",
        accent: "american",
        use_case: "social_media",
        gender: "female",
        age: "young",
        descriptive: "upbeat",
      },
      previewUrl: "https://storage.googleapis.com/preview-laura.mp3",
    },
    {
      voiceId: "EXAVITQu4vr4xnSDxMaL",
      name: "Sarah - Expressive & Cinematic",
      category: "premade",
      labels: {
        language: "en",
        accent: "american",
        use_case: "entertainment_tv",
        gender: "female",
        age: "young",
        descriptive: "dramatic",
      },
      previewUrl: "https://storage.googleapis.com/preview-sarah.mp3",
    },
    {
      voiceId: "pqHfZKP75CvOlQ2vVGy2",
      name: "Bill - Wise Commercial Voice",
      category: "premade",
      labels: {
        language: "en",
        accent: "american",
        use_case: "advertisement",
        gender: "male",
        age: "old",
        descriptive: "authoritative",
      },
      previewUrl: "https://storage.googleapis.com/preview-bill.mp3",
    },
  ];

  // 1. Official Categories Structure
  it("uses the 7 official ElevenLabs categories without invented presets", () => {
    const categoryIds = OFFICIAL_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toEqual([
      "conversational",
      "narration",
      "characters",
      "social_media",
      "educational",
      "advertisement",
      "entertainment",
    ]);

    // Zero hardcoded defaultVoiceId on category definitions
    OFFICIAL_CATEGORIES.forEach((cat) => {
      expect((cat as unknown as { defaultVoiceId?: string }).defaultVoiceId).toBeUndefined();
    });
  });

  // 2. Official Languages
  it("includes official languages Español, Inglés, Portugués, and Todos", () => {
    const langCodes = OFFICIAL_LANGUAGES.map((l) => l.code);
    expect(langCodes).toContain("es");
    expect(langCodes).toContain("en");
    expect(langCodes).toContain("pt");
    expect(langCodes).toContain("all");
  });

  // 3. Idioma + Categoría filtran correctamente
  it("filters accurately by language and category", () => {
    const esConv = filterVoices(realVoicesCatalog, {
      language: "es",
      category: "conversational",
    });
    expect(esConv.length).toBeGreaterThan(0);
    esConv.forEach((v) => {
      expect(v.labels?.language).toBe("es");
      expect(v.labels?.use_case).toBe("conversational");
    });
  });

  // 4. Español + Narración NO recomienda una voz inglesa (CRÍTICO)
  it("ensures Español + Narración NEVER recommends an English voice like George", () => {
    const rec = getRecommendedVoice(realVoicesCatalog, {
      language: "es",
      category: "narration",
    });

    expect(rec).toBeDefined();
    // MUST be Spanish!
    expect(rec!.labels?.language).toBe("es");
    // MUST NOT be George (British English)
    expect(rec!.voiceId).not.toBe("JBFqnCBsd6RMkjVDRZzb");
    expect(rec!.labels?.language).not.toBe("en");
  });

  // 5. Con voz española de narración explícita, gana con máxima puntuación
  it("prioritizes an explicit Spanish narration voice when present in catalog", () => {
    const catalogWithSpanishNarrator: GatewayVoice[] = [
      ...realVoicesCatalog,
      {
        voiceId: "mateo_es_narrator",
        name: "Mateo - Narrador Latino",
        category: "professional",
        labels: {
          language: "es",
          accent: "latin american",
          use_case: "narrative_story",
          gender: "male",
          age: "middle_aged",
          descriptive: "warm",
        },
        previewUrl: "https://sample.audio/mateo.mp3",
      },
    ];

    const rec = getRecommendedVoice(catalogWithSpanishNarrator, {
      language: "es",
      category: "narration",
    });

    expect(rec).toBeDefined();
    expect(rec!.voiceId).toBe("mateo_es_narrator");
    expect(rec!.labels?.language).toBe("es");
    expect(rec!.labels?.use_case).toBe("narrative_story");
  });

  // 6. Español + Publicidad prioriza voces españolas de publicidad (Rogher)
  it("prioritizes Spanish advertisement voices for Español + Publicidad", () => {
    const rec = getRecommendedVoice(realVoicesCatalog, {
      language: "es",
      category: "advertisement",
    });

    expect(rec).toBeDefined();
    expect(rec!.voiceId).toBe("0ji4DHZV895MuXeZB0PL"); // Rogher
    expect(rec!.labels?.language).toBe("es");
    expect(rec!.labels?.use_case).toBe("advertisement");
  });

  // 7. Inglés + Narración prioriza voces inglesas de narración (George)
  it("prioritizes English narration voices for Inglés + Narración", () => {
    const rec = getRecommendedVoice(realVoicesCatalog, {
      language: "en",
      category: "narration",
    });

    expect(rec).toBeDefined();
    expect(rec!.voiceId).toBe("JBFqnCBsd6RMkjVDRZzb"); // George
    expect(rec!.labels?.language).toBe("en");
    expect(rec!.labels?.use_case).toBe("narrative_story");
  });

  // 8. Inglés + Personajes prioriza Callum
  it("prioritizes English character voices for Inglés + Personajes", () => {
    const rec = getRecommendedVoice(realVoicesCatalog, {
      language: "en",
      category: "characters",
    });

    expect(rec).toBeDefined();
    expect(rec!.voiceId).toBe("N2lVS1w4EtoT3dr4eOWO"); // Callum
    expect(rec!.labels?.language).toBe("en");
    expect(rec!.labels?.use_case).toBe("characters_animation");
  });

  // 9. Cambio de idioma actualiza las voces disponibles
  it("updates voice list dynamically when changing language", () => {
    const esVoices = filterVoices(realVoicesCatalog, { language: "es", category: "all" });
    const enVoices = filterVoices(realVoicesCatalog, { language: "en", category: "all" });
    const ptVoices = filterVoices(realVoicesCatalog, { language: "pt", category: "all" });

    expect(esVoices.every((v) => v.labels?.language === "es")).toBe(true);
    expect(enVoices.every((v) => v.labels?.language === "en")).toBe(true);
    expect(ptVoices.every((v) => v.labels?.language === "pt")).toBe(true);

    expect(esVoices.map((v) => v.voiceId)).not.toEqual(enVoices.map((v) => v.voiceId));
  });

  // 10. Cambio de categoría actualiza la recomendación dinámicamente
  it("updates recommendation dynamically when changing category", () => {
    const recConv = getRecommendedVoice(realVoicesCatalog, { language: "en", category: "conversational" });
    const recNarr = getRecommendedVoice(realVoicesCatalog, { language: "en", category: "narration" });
    const recChar = getRecommendedVoice(realVoicesCatalog, { language: "en", category: "characters" });
    const recAd = getRecommendedVoice(realVoicesCatalog, { language: "en", category: "advertisement" });

    expect(recNarr?.voiceId).toBe("JBFqnCBsd6RMkjVDRZzb"); // George
    expect(recChar?.voiceId).toBe("N2lVS1w4EtoT3dr4eOWO"); // Callum
    expect(recAd?.voiceId).toBe("pqHfZKP75CvOlQ2vVGy2"); // Bill
    expect(recNarr?.voiceId).not.toBe(recChar?.voiceId);
  });

  // 11. "Ver todas las voces" muestra solamente voces compatibles con los filtros
  it("ensures voice catalog modal receives only compatible voices for active filters", () => {
    const criteria: VoiceFilterCriteria = {
      language: "es",
      category: "conversational",
    };
    const catalogModalVoices = filterVoices(realVoicesCatalog, criteria);

    expect(catalogModalVoices.length).toBe(2); // Cristina Campos & Fran
    catalogModalVoices.forEach((v) => {
      expect(v.labels?.language).toBe("es");
      expect(v.labels?.use_case).toBe("conversational");
    });
  });

  // 12. Filtros secundarios (Género, Edad, Acento) funcionan
  it("filters accurately with secondary filters (gender, age, accent)", () => {
    // Gender filter: Female in Spanish
    const esFemale = filterVoices(realVoicesCatalog, {
      language: "es",
      category: "all",
      gender: "female",
    });
    expect(esFemale.length).toBe(2); // Cristina & Fran
    esFemale.forEach((v) => expect(v.labels?.gender).toBe("female"));

    // Gender filter: Male in Spanish
    const esMale = filterVoices(realVoicesCatalog, {
      language: "es",
      category: "all",
      gender: "male",
    });
    expect(esMale.length).toBe(1); // Rogher
    expect(esMale[0].voiceId).toBe("0ji4DHZV895MuXeZB0PL");

    // Accent filter: Colombian in Spanish
    const esColombian = filterVoices(realVoicesCatalog, {
      language: "es",
      category: "all",
      accent: "colombian",
    });
    expect(esColombian.length).toBe(1);
    expect(esColombian[0].labels?.accent).toBe("colombian");

    // Age filter: Old in English
    const enOld = filterVoices(realVoicesCatalog, {
      language: "en",
      category: "all",
      age: "old",
    });
    expect(enOld.length).toBe(1);
    expect(enOld[0].voiceId).toBe("pqHfZKP75CvOlQ2vVGy2"); // Bill
  });

  // 13. Detección dinámica de acentos disponibles
  it("discovers available accents dynamically without hardcoding", () => {
    const esAccents = getAvailableAccents(realVoicesCatalog, "es");
    expect(esAccents).toContain("colombian");
    expect(esAccents).toContain("latin american");
    expect(esAccents).not.toContain("british");

    const enAccents = getAvailableAccents(realVoicesCatalog, "en");
    expect(enAccents).toContain("british");
    expect(enAccents).toContain("american");
    expect(enAccents).not.toContain("brazilian");
  });

  // 14. Extracción de tags de estilo reales sin inventar datos
  it("extracts real descriptive style tags from labels and subtitle without inventing metadata", () => {
    const rogherTags = getVoiceStyleTags(realVoicesCatalog[1]);
    expect(rogherTags).toContain("Elegante"); // classy translated

    const georgeTags = getVoiceStyleTags(realVoicesCatalog[4]);
    expect(georgeTags.length).toBeGreaterThan(0);
  });

  // 15. NO se llama /api/tts/generate al cambiar filtros o seleccionar voces
  it("ensures changing filters or selecting voices never invokes audio generation", async () => {
    const gatewayModule = await import("../src/services/gateway");
    const generateSpy = vi.spyOn(gatewayModule, "generateNarrationAudio");

    // Simulate user operations: changing language, category, secondary filter
    filterVoices(realVoicesCatalog, { language: "es", category: "narration" });
    filterVoices(realVoicesCatalog, { language: "en", category: "conversational" });
    filterVoices(realVoicesCatalog, { language: "pt", category: "advertisement" });
    getRecommendedVoice(realVoicesCatalog, { language: "es", category: "conversational" });

    expect(generateSpy).not.toHaveBeenCalled();
    generateSpy.mockRestore();
  });

  // 16. Disponibilidad (failed es penalizada frente a working/unknown)
  it("ensures failed voice is never recommended if viable alternatives exist", () => {
    const availMap = {
      CaJslL1xziwefCeTNzHv: { status: "failed" as const }, // Cristina failed
      crQgCQuWgUucmYHEPsrB: { status: "working" as const }, // Fran working
    };

    const rec = getRecommendedVoice(
      realVoicesCatalog,
      { language: "es", category: "conversational" },
      availMap
    );

    expect(rec).toBeDefined();
    expect(rec!.voiceId).toBe("crQgCQuWgUucmYHEPsrB"); // Fran wins over failed Cristina
  });
});
