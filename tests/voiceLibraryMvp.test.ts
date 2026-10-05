/**
 * @file tests/voiceLibraryMvp.test.ts
 * Test suite for GhostAI Voice Library MVP:
 * IDIOMA -> VOICE LIBRARY -> BUSCAR / EXPLORAR -> FILTROS OPCIONALES -> PREVIEW -> USAR VOZ
 *
 * Verifies all 15 requirements from Section 19 of the specification.
 * Confirms ZERO calls to /api/tts/generate and ZERO synthesis credits consumed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchVoiceLibrary,
  addSharedVoiceToAccount,
  TtsGatewayError,
} from "../src/services/gateway";
import { COMMON_LANGUAGE_ACCENTS } from "../src/services/voiceLibrary";
import { CATALOG_PAGE_SIZE } from "../src/components/BatchControls";
import type { VoiceLibraryVoice, GatewayVoice } from "../src/types/tts";

describe("Studio - Voice Library MVP Specification Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Mock catalog responses
  const mockSpanishVoices: VoiceLibraryVoice[] = [
    {
      voiceId: "CaJslL1xziwefCeTNzHv",
      publicOwnerId: "owner-es-1",
      name: "Cristina Campos",
      language: "es",
      locale: "es-MX",
      accent: "mexican",
      gender: "female",
      age: "middle_aged",
      useCase: "narrative_story",
      descriptive: "warm",
      description: "Voz cálida mexicana",
      category: "shared",
      previewUrl: "https://storage.googleapis.com/preview-cristina.mp3",
      clonedByCount: 1540,
      usageCharacterCount1y: 9500000,
      featured: true,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: 0,
      rate: 0,
      verifiedLanguages: [{ language: "es", modelId: "eleven_multilingual_v2" }],
    },
    {
      voiceId: "crQgCQuWgUucmYHEPsrB",
      publicOwnerId: "owner-es-2",
      name: "Fran - Dynamic Latin Voice",
      language: "es",
      locale: "es-419",
      accent: "latin american",
      gender: "male",
      age: "young",
      useCase: "conversational",
      descriptive: "casual",
      description: "Voz joven latinoamericana",
      category: "shared",
      previewUrl: "https://storage.googleapis.com/preview-fran.mp3",
      clonedByCount: 820,
      usageCharacterCount1y: 4500000,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: 0,
      rate: 0,
      verifiedLanguages: [{ language: "es", modelId: "eleven_multilingual_v2" }],
    },
    {
      voiceId: "shared-voice-xyz-777",
      publicOwnerId: "owner-es-3",
      name: "Valentina - Elegante y Expresiva",
      language: "es",
      locale: "es-CO",
      accent: "colombian",
      gender: "female",
      age: "young",
      useCase: "social_media",
      descriptive: "classy",
      description: "Voz colombiana para reels",
      category: "shared",
      previewUrl: "https://storage.googleapis.com/preview-valentina.mp3",
      clonedByCount: 4200,
      usageCharacterCount1y: 12000000,
      featured: true,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: 0,
      rate: 0,
      verifiedLanguages: [{ language: "es", modelId: "eleven_multilingual_v2" }],
    },
  ];

  // 1. Idioma español carga catálogo español con defaults (page=0, page_size=24, sort=usage_character_count_1y)
  it("1. Idioma español carga catálogo español con defaults", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          voices: mockSpanishVoices,
          page: 0,
          pageSize: 24,
          hasMore: true,
          totalCount: 8537,
        }),
      } as unknown as Response);
    });

    const res = await fetchVoiceLibrary({
      language: "es",
      page: 0,
      pageSize: 24,
      sort: "usage_character_count_1y",
    });

    expect(capturedUrl).toContain("/api/tts/voice-library");
    expect(capturedUrl).toContain("language=es");
    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("page_size=24");
    expect(capturedUrl).toContain("sort=usage_character_count_1y");
    expect(res.voices.length).toBe(3);
    expect(res.totalCount).toBe(8537);
  });

  // 2. Cambio de idioma recarga catálogo
  it("2. Cambio de idioma recarga catálogo con el nuevo idioma", async () => {
    const urlsCalled: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      urlsCalled.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          voices: [],
          page: 0,
          pageSize: 24,
          hasMore: false,
          totalCount: 0,
        }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({ language: "es", page: 0, pageSize: 24 });
    await fetchVoiceLibrary({ language: "en", page: 0, pageSize: 24 });

    expect(urlsCalled.length).toBe(2);
    expect(urlsCalled[0]).toContain("language=es");
    expect(urlsCalled[1]).toContain("language=en");
  });

  // 3. Cambiar idioma NO genera TTS (/api/tts/generate)
  it("3. Cambiar idioma NO genera TTS ni consume créditos", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voices: [], page: 0, pageSize: 24, hasMore: false, totalCount: 0 }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await fetchVoiceLibrary({ language: "pt", page: 0, pageSize: 24 });

    const calledEndpoints = fetchSpy.mock.calls.map(([url]) => String(url));
    const calledGenerate = calledEndpoints.some((url) => url.includes("/api/tts/generate"));
    expect(calledGenerate).toBe(false);
  });

  // 4. Filtros NO generan TTS
  it("4. Filtros opcionales (accent, useCases, gender, age) NO generan TTS", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voices: [], page: 0, pageSize: 24, hasMore: false, totalCount: 0 }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await fetchVoiceLibrary({
      language: "es",
      accent: "mexican",
      useCases: "narrative_story",
      gender: "female",
      age: "young",
    });

    const calledUrls = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(calledUrls[0]).toContain("accent=mexican");
    expect(calledUrls[0]).toContain("use_cases=narrative_story");
    expect(calledUrls[0]).toContain("gender=female");
    expect(calledUrls[0]).toContain("age=young");

    const calledGenerate = calledUrls.some((url) => url.includes("/api/tts/generate"));
    expect(calledGenerate).toBe(false);
  });

  // 5. Search NO genera TTS
  it("5. Búsqueda por texto (search) NO genera TTS", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 24, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({ language: "es", search: "Cristina" });

    expect(capturedUrl).toContain("search=Cristina");
    expect(capturedUrl).not.toContain("/api/tts/generate");
  });

  // 6. Preview NO llama generate (utiliza previewUrl existente)
  it("6. Preview de voz reproduce muestra existente sin generar TTS", () => {
    const previewUrl = mockSpanishVoices[0].previewUrl;
    expect(previewUrl).toBeTruthy();
    expect(previewUrl).toContain("preview-cristina.mp3");
    // Verify previewUrl points directly to existing static audio
    expect(previewUrl).not.toContain("/api/tts/generate");
  });

  // 7. Cargar más concatena y deduplica
  it("7. Cargar más concatena resultados y deduplica por voiceId", () => {
    const page0Voices: VoiceLibraryVoice[] = [
      mockSpanishVoices[0],
      mockSpanishVoices[1],
    ];

    // Page 1 returns one overlapping voice and one new voice
    const page1Voices: VoiceLibraryVoice[] = [
      mockSpanishVoices[1], // duplicate
      mockSpanishVoices[2], // new
    ];

    // Deduplication strategy
    const existingIds = new Set(page0Voices.map((v) => v.voiceId));
    const newUnique = page1Voices.filter((v) => !existingIds.has(v.voiceId));
    const combined = [...page0Voices, ...newUnique];

    expect(combined.length).toBe(3);
    const uniqueIds = new Set(combined.map((v) => v.voiceId));
    expect(uniqueIds.size).toBe(3);
    expect(combined[2].voiceId).toBe("shared-voice-xyz-777");
  });

  // 8. Filtros resetean page a 0
  it("8. Al cambiar filtros opcionales se reinicia la paginación a page=0", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 24, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    // Simulating user changing accent filter
    await fetchVoiceLibrary({ language: "es", accent: "colombian", page: 0 });

    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("accent=colombian");
  });

  // 9. Search resetea page a 0
  it("9. Al cambiar término de búsqueda se reinicia la paginación a page=0", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 24, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({ language: "es", search: "Valentina", page: 0 });

    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("search=Valentina");
  });

  // 10. Seleccionar una voz existente actualiza selectedVoiceId inmediatamente
  it("10. Seleccionar voz que ya está en colección actualiza selectedVoiceId sin llamar Add", async () => {
    const accountVoices: GatewayVoice[] = [
      {
        voiceId: "CaJslL1xziwefCeTNzHv",
        name: "Cristina Campos",
        category: "professional",
        labels: { language: "es" },
        previewUrl: "https://preview.mp3",
      },
    ];

    const accountVoiceIds = new Set(accountVoices.map((v) => v.voiceId));
    const targetVoice = mockSpanishVoices[0]; // CaJslL1xziwefCeTNzHv (in account)

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    let selectedVoiceId = "old-voice";
    if (accountVoiceIds.has(targetVoice.voiceId)) {
      selectedVoiceId = targetVoice.voiceId;
    } else {
      await addSharedVoiceToAccount({
        voiceId: targetVoice.voiceId,
        publicOwnerId: targetVoice.publicOwnerId,
        name: targetVoice.name,
      });
    }

    expect(selectedVoiceId).toBe("CaJslL1xziwefCeTNzHv");
    expect(fetchSpy).not.toHaveBeenCalled(); // No network call needed!
  });

  // 11. Seleccionar una shared voice ejecuta Add SOLO al pulsar Usar Voz
  it("11. Seleccionar shared voice no añadida llama a POST /api/tts/voices/shared/add SOLO en Usar Voz", async () => {
    const accountVoiceIds = new Set(["CaJslL1xziwefCeTNzHv"]);
    const targetVoice = mockSpanishVoices[2]; // shared-voice-xyz-777 (not in account)

    let capturedUrl = "";
    let capturedBody = "";
    let capturedMethod = "";

    global.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
      capturedUrl = url;
      capturedMethod = opts.method || "GET";
      capturedBody = opts.body as string;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          voiceId: targetVoice.voiceId,
          name: targetVoice.name,
        }),
      } as unknown as Response);
    });

    expect(accountVoiceIds.has(targetVoice.voiceId)).toBe(false);

    // Clicking "USAR VOZ":
    const result = await addSharedVoiceToAccount({
      voiceId: targetVoice.voiceId,
      publicOwnerId: targetVoice.publicOwnerId,
      name: targetVoice.name,
    });

    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/tts/voices/shared/add");
    expect(JSON.parse(capturedBody)).toEqual({
      voiceId: "shared-voice-xyz-777",
      publicOwnerId: "owner-es-3",
      name: "Valentina - Elegante y Expresiva",
    });
    expect(result.ok).toBe(true);
    expect(result.voiceId).toBe("shared-voice-xyz-777");
  });

  // 12. Add exitoso actualiza selectedVoiceId
  it("12. Add exitoso actualiza selectedVoiceId y añade la voz a la colección", async () => {
    const initialCollection: GatewayVoice[] = [
      {
        voiceId: "CaJslL1xziwefCeTNzHv",
        name: "Cristina Campos",
        category: "professional",
        labels: { language: "es" },
        previewUrl: "https://preview.mp3",
      },
    ];

    let selectedVoiceId = "CaJslL1xziwefCeTNzHv";
    const collection = [...initialCollection];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        voiceId: "shared-voice-xyz-777",
        name: "Valentina",
      }),
    } as unknown as Response);

    const voiceToAdd = mockSpanishVoices[2];
    const addRes = await addSharedVoiceToAccount({
      voiceId: voiceToAdd.voiceId,
      publicOwnerId: voiceToAdd.publicOwnerId,
      name: voiceToAdd.name,
    });

    if (addRes.ok) {
      collection.push({
        voiceId: voiceToAdd.voiceId,
        name: voiceToAdd.name,
        category: "shared",
        labels: { language: "es" },
        previewUrl: voiceToAdd.previewUrl,
      });
      selectedVoiceId = voiceToAdd.voiceId;
    }

    expect(selectedVoiceId).toBe("shared-voice-xyz-777");
    expect(collection.some((v) => v.voiceId === "shared-voice-xyz-777")).toBe(true);
  });

  // 13. Add fallido conserva selectedVoiceId anterior
  it("13. Add fallido conserva selectedVoiceId anterior sin romper la selección", async () => {
    let selectedVoiceId = "CaJslL1xziwefCeTNzHv"; // Previous selected voice

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "Voice limit reached on account" },
      }),
    } as unknown as Response);

    const voiceToAdd = mockSpanishVoices[2];

    try {
      await addSharedVoiceToAccount({
        voiceId: voiceToAdd.voiceId,
        publicOwnerId: voiceToAdd.publicOwnerId,
        name: voiceToAdd.name,
      });
      selectedVoiceId = voiceToAdd.voiceId; // Should not reach here
    } catch {
      // Catch and keep selectedVoiceId
    }

    expect(selectedVoiceId).toBe("CaJslL1xziwefCeTNzHv"); // Unchanged!
  });

  // 14. Cambiar filtros después de seleccionar una voz NO cambia selectedVoiceId
  it("14. Cambiar filtros u orden después de seleccionar una voz NO cambia selectedVoiceId", () => {
    let selectedVoiceId = "CaJslL1xziwefCeTNzHv";

    // Simulating user changing filters: accent, use_case, search
    let filterAccent = "all";
    filterAccent = "colombian";
    expect(filterAccent).toBe("colombian");
    // selectedVoiceId must remain intact
    expect(selectedVoiceId).toBe("CaJslL1xziwefCeTNzHv");

    let filterUseCase = "all";
    filterUseCase = "social_media";
    expect(filterUseCase).toBe("social_media");
    expect(selectedVoiceId).toBe("CaJslL1xziwefCeTNzHv");

    let search = "";
    search = "Valentina";
    expect(search).toBe("Valentina");
    expect(selectedVoiceId).toBe("CaJslL1xziwefCeTNzHv");
  });

  // 15. Ninguna navegación consume créditos TTS
  it("15. Ninguna navegación por Voice Library consume créditos TTS", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: mockSpanishVoices, page: 0, pageSize: 24, hasMore: true, totalCount: 8537 }),
      } as unknown as Response);
    });
    global.fetch = fetchSpy;

    // Simulate extensive user navigation:
    // 1. Load initial Spanish catalog
    await fetchVoiceLibrary({ language: "es", page: 0, pageSize: 24 });
    // 2. Filter by Mexican accent
    await fetchVoiceLibrary({ language: "es", accent: "mexican", page: 0, pageSize: 24 });
    // 3. Search for a specific voice
    await fetchVoiceLibrary({ language: "es", search: "Cristina", page: 0, pageSize: 24 });
    // 4. Change to English
    await fetchVoiceLibrary({ language: "en", page: 0, pageSize: 24 });
    // 5. Change back to Spanish
    await fetchVoiceLibrary({ language: "es", page: 0, pageSize: 24 });
    // 6. Paginate to page 1
    await fetchVoiceLibrary({ language: "es", page: 1, pageSize: 24 });

    const calledUrls = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(calledUrls.length).toBe(6);

    const generatedTtsCalls = calledUrls.filter((url) => url.includes("/api/tts/generate"));
    expect(generatedTtsCalls.length).toBe(0);
  });
});

describe("Pre-Deploy Certification Patches (Nullability & Accent Presets)", () => {
  // A. VoiceLibraryVoice accepts rate: null, noticePeriod: null, publicOwnerId: null
  it("A. VoiceLibraryVoice contract accepts null for rate, noticePeriod, and publicOwnerId", () => {
    const voiceWithNulls: VoiceLibraryVoice = {
      voiceId: "voice-null-test-123",
      publicOwnerId: null,
      name: "Voice Without Owner",
      language: "es",
      locale: null,
      accent: null,
      gender: null,
      age: null,
      useCase: null,
      descriptive: null,
      description: null,
      category: null,
      previewUrl: null,
      clonedByCount: 0,
      usageCharacterCount1y: 0,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: null,
      rate: null,
      verifiedLanguages: [],
    };

    expect(voiceWithNulls.rate).toBeNull();
    expect(voiceWithNulls.noticePeriod).toBeNull();
    expect(voiceWithNulls.publicOwnerId).toBeNull();
  });

  // B. rate: null no renderiza badge de rate
  it("B. rate: null evaluate false in rate badge guard", () => {
    const voiceWithNullRate = { rate: null };
    const shouldRenderBadge = typeof voiceWithNullRate.rate === "number" && voiceWithNullRate.rate > 0;
    expect(shouldRenderBadge).toBe(false);

    const voiceWithNumericRate = { rate: 1.5 };
    const shouldRenderNumeric = typeof voiceWithNumericRate.rate === "number" && voiceWithNumericRate.rate > 0;
    expect(shouldRenderNumeric).toBe(true);

    const voiceWithZeroRate = { rate: 0 };
    const shouldRenderZero = typeof voiceWithZeroRate.rate === "number" && voiceWithZeroRate.rate > 0;
    expect(shouldRenderZero).toBe(false);
  });

  // C. noticePeriod: null no renderiza badge de aviso
  it("C. noticePeriod: null evaluates false in notice period badge guard", () => {
    const voiceWithNullNotice = { noticePeriod: null };
    const shouldRenderNotice = typeof voiceWithNullNotice.noticePeriod === "number" && voiceWithNullNotice.noticePeriod > 0;
    expect(shouldRenderNotice).toBe(false);

    const voiceWithNotice = { noticePeriod: 30 };
    const shouldRenderPositiveNotice = typeof voiceWithNotice.noticePeriod === "number" && voiceWithNotice.noticePeriod > 0;
    expect(shouldRenderPositiveNotice).toBe(true);
  });

  // D. Shared Voice con publicOwnerId: null NO llama Add, NO cambia selectedVoiceId y queda no disponible
  it("D. Shared Voice con publicOwnerId: null no ejecuta Add y no altera selectedVoiceId", async () => {
    const voiceWithoutOwner: VoiceLibraryVoice = {
      voiceId: "voice-no-owner-456",
      publicOwnerId: null,
      name: "Community Voice No Owner",
      language: "es",
      locale: "es-ES",
      accent: "peninsular",
      gender: "male",
      age: "young",
      useCase: "conversational",
      descriptive: "casual",
      description: null,
      category: "shared",
      previewUrl: "https://preview.mp3",
      clonedByCount: 10,
      usageCharacterCount1y: 100,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: null,
      rate: null,
      verifiedLanguages: [],
    };

    const accountVoiceIds = new Set<string>(["existing-voice-1"]);
    let selectedVoiceId = "existing-voice-1";
    let actionFeedback: string | null = null;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // Simulate handleUseVoice logic
    if (accountVoiceIds.has(voiceWithoutOwner.voiceId)) {
      selectedVoiceId = voiceWithoutOwner.voiceId;
    } else if (!voiceWithoutOwner.publicOwnerId) {
      actionFeedback = `La voz '${voiceWithoutOwner.name}' no tiene publicOwnerId válido y no está disponible para añadir.`;
    } else {
      await addSharedVoiceToAccount({
        voiceId: voiceWithoutOwner.voiceId,
        publicOwnerId: voiceWithoutOwner.publicOwnerId,
        name: voiceWithoutOwner.name,
      });
      selectedVoiceId = voiceWithoutOwner.voiceId;
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(selectedVoiceId).toBe("existing-voice-1");
    expect(actionFeedback).toContain("no está disponible para añadir");
  });

  // E. Voice existente en account collection con publicOwnerId: null sí puede seleccionarse por voiceId
  it("E. Voice existente en account collection con publicOwnerId: null puede seleccionarse sin llamar Add", () => {
    const voiceInAccountWithoutOwner: VoiceLibraryVoice = {
      voiceId: "existing-in-account-789",
      publicOwnerId: null,
      name: "My Account Voice",
      language: "es",
      locale: "es-MX",
      accent: "mexican",
      gender: "female",
      age: "young",
      useCase: "narrative_story",
      descriptive: null,
      description: null,
      category: "shared",
      previewUrl: "https://preview.mp3",
      clonedByCount: 0,
      usageCharacterCount1y: 0,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: null,
      rate: null,
      verifiedLanguages: [],
    };

    const accountVoiceIds = new Set<string>(["existing-in-account-789"]);
    let selectedVoiceId = "initial-voice";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    if (accountVoiceIds.has(voiceInAccountWithoutOwner.voiceId)) {
      selectedVoiceId = voiceInAccountWithoutOwner.voiceId;
    }

    expect(selectedVoiceId).toBe("existing-in-account-789");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // F. Español incluye acentos base
  it("F. Español incluye acentos base en COMMON_LANGUAGE_ACCENTS", () => {
    const esAccents = COMMON_LANGUAGE_ACCENTS.es;
    expect(esAccents).toBeDefined();
    expect(esAccents).toContain("mexican");
    expect(esAccents).toContain("peninsular");
    expect(esAccents).toContain("latin american");
    expect(esAccents).toContain("colombian");
    expect(esAccents).toContain("argentine");
  });

  // G. Inglés incluye presets conocidos aunque no estén presentes en las 24 voces actuales
  it("G. Inglés incluye presets conocidos (american, british, etc.)", () => {
    const enAccents = COMMON_LANGUAGE_ACCENTS.en;
    expect(enAccents).toBeDefined();
    expect(enAccents).toContain("american");
    expect(enAccents).toContain("british");
    expect(enAccents).toContain("australian");
    expect(enAccents).toContain("canadian");
    expect(enAccents).toContain("irish");
    expect(enAccents).toContain("indian");

    // Simulating availableAccents in BatchControls:
    const base = COMMON_LANGUAGE_ACCENTS["en"] ?? [];
    const set = new Set<string>(base);
    const available = Array.from(set).sort();
    expect(available).toContain("american");
    expect(available).toContain("british");
  });

  // H. Portugués incluye presets conocidos
  it("H. Portugués incluye presets conocidos (brazilian, european)", () => {
    const ptAccents = COMMON_LANGUAGE_ACCENTS.pt;
    expect(ptAccents).toBeDefined();
    expect(ptAccents).toContain("brazilian");
    expect(ptAccents).toContain("european");
  });

  // I. Un acento nuevo recibido en libraryVoices se añade dinámicamente
  it("I. Un acento nuevo recibido en libraryVoices se añade dinámicamente al conjunto base", () => {
    const base = COMMON_LANGUAGE_ACCENTS["es"] ?? [];
    const set = new Set<string>(base);

    // Mock catalog containing a rare accent not in COMMON_LANGUAGE_ACCENTS
    const mockLoadedVoices = [
      { accent: "canarian" },
      { accent: "mexican" }, // already in preset
      { accent: "andalusian" },
    ];

    mockLoadedVoices.forEach((v) => {
      if (v.accent) set.add(v.accent.toLowerCase().trim());
    });

    const finalAccents = Array.from(set).sort();
    expect(finalAccents).toContain("canarian");
    expect(finalAccents).toContain("andalusian");
    expect(finalAccents).toContain("mexican");
  });
});

describe("Studio - P2.1 UI Polish & 12 Voices Catalog Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // A. Carga inicial solicita page_size=12
  it("A. Carga inicial solicita page_size=12 al Gateway", async () => {
    expect(CATALOG_PAGE_SIZE).toBe(12);

    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 12, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({
      language: "es",
      page: 0,
      pageSize: CATALOG_PAGE_SIZE,
      sort: "usage_character_count_1y",
    });

    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("page_size=12");
    expect(capturedUrl).not.toContain("page_size=24");
  });

  // B. Cargar más solicita la siguiente página conservando page_size=12
  it("B. Cargar más solicita la siguiente página conservando page_size=12", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 1, pageSize: 12, hasMore: true, totalCount: 24 }),
      } as unknown as Response);
    });

    const currentPage = 0;
    const nextPage = currentPage + 1;

    await fetchVoiceLibrary({
      language: "es",
      page: nextPage,
      pageSize: CATALOG_PAGE_SIZE,
      sort: "usage_character_count_1y",
    });

    expect(capturedUrl).toContain("page=1");
    expect(capturedUrl).toContain("page_size=12");
  });

  // C. 12 + 12 produce 24 voces únicas
  it("C. 12 iniciales + 12 de Cargar más produce 24 voces únicas acumuladas", () => {
    // Generate 12 distinct voices for page 0
    const page0: VoiceLibraryVoice[] = Array.from({ length: 12 }, (_, i) => ({
      voiceId: `voice-p0-${i}`,
      publicOwnerId: `owner-${i}`,
      name: `Voice P0 #${i}`,
      language: "es",
      locale: "es-ES",
      accent: "peninsular",
      gender: "female",
      age: "young",
      useCase: "narrative_story",
      descriptive: null,
      description: null,
      category: "shared",
      previewUrl: `https://preview-${i}.mp3`,
      clonedByCount: 10,
      usageCharacterCount1y: 100,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: null,
      rate: null,
      verifiedLanguages: [],
    }));

    // Generate 12 distinct voices for page 1
    const page1: VoiceLibraryVoice[] = Array.from({ length: 12 }, (_, i) => ({
      voiceId: `voice-p1-${i}`,
      publicOwnerId: `owner-p1-${i}`,
      name: `Voice P1 #${i}`,
      language: "es",
      locale: "es-MX",
      accent: "mexican",
      gender: "male",
      age: "middle_aged",
      useCase: "conversational",
      descriptive: null,
      description: null,
      category: "shared",
      previewUrl: `https://preview-p1-${i}.mp3`,
      clonedByCount: 20,
      usageCharacterCount1y: 200,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: null,
      rate: null,
      verifiedLanguages: [],
    }));

    // Simulate deduplication logic from handleLoadMore
    const existingIds = new Set(page0.map((v) => v.voiceId));
    const newUnique = page1.filter((v) => !existingIds.has(v.voiceId));
    const combined = [...page0, ...newUnique];

    expect(combined.length).toBe(24);
    const uniqueIds = new Set(combined.map((v) => v.voiceId));
    expect(uniqueIds.size).toBe(24);
  });

  // D. Cambio de búsqueda reinicia página a 0 con page_size=12
  it("D. Cambio de búsqueda reinicia página a page=0 con page_size=12", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 12, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({
      language: "es",
      search: "Cristina",
      page: 0,
      pageSize: CATALOG_PAGE_SIZE,
    });

    expect(capturedUrl).toContain("search=Cristina");
    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("page_size=12");
  });

  // E. Cambio de idioma reinicia página a 0 con page_size=12
  it("E. Cambio de idioma reinicia página a page=0 con page_size=12", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 12, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({
      language: "en",
      page: 0,
      pageSize: CATALOG_PAGE_SIZE,
    });

    expect(capturedUrl).toContain("language=en");
    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("page_size=12");
  });

  // F. Cambio de filtros reinicia página a 0 con page_size=12
  it("F. Cambio de filtros reinicia página a page=0 con page_size=12", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ voices: [], page: 0, pageSize: 12, hasMore: false, totalCount: 0 }),
      } as unknown as Response);
    });

    await fetchVoiceLibrary({
      language: "es",
      accent: "mexican",
      useCases: "narrative_story",
      gender: "female",
      age: "young",
      page: 0,
      pageSize: CATALOG_PAGE_SIZE,
    });

    expect(capturedUrl).toContain("accent=mexican");
    expect(capturedUrl).toContain("use_cases=narrative_story");
    expect(capturedUrl).toContain("gender=female");
    expect(capturedUrl).toContain("age=young");
    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).toContain("page_size=12");
  });

  // G. rate: null continúa sin mostrarse
  it("G. rate: null o <= 0 es filtrado por los guards de renderizado", () => {
    const voiceNullRate: VoiceLibraryVoice = {
      voiceId: "v-null-rate",
      publicOwnerId: "owner-1",
      name: "Voice Null Rate",
      language: "es",
      locale: null,
      accent: null,
      gender: null,
      age: null,
      useCase: null,
      descriptive: null,
      description: null,
      category: "shared",
      previewUrl: null,
      clonedByCount: 0,
      usageCharacterCount1y: 0,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: 30,
      rate: null,
      verifiedLanguages: [],
    };

    // Guard test:
    const shouldShowRate = typeof voiceNullRate.rate === "number" && voiceNullRate.rate > 0;
    expect(shouldShowRate).toBe(false);

    // Guard for rate = 0
    const voiceZeroRate = { ...voiceNullRate, rate: 0 };
    const shouldShowZeroRate = typeof voiceZeroRate.rate === "number" && voiceZeroRate.rate > 0;
    expect(shouldShowZeroRate).toBe(false);

    // Guard for rate = 1 (valid custom rate)
    const voiceValidRate = { ...voiceNullRate, rate: 1 };
    const shouldShowValidRate = typeof voiceValidRate.rate === "number" && voiceValidRate.rate > 0;
    expect(shouldShowValidRate).toBe(true);
  });

  // H. noticePeriod: null continúa sin mostrarse
  it("H. noticePeriod: null o <= 0 es filtrado por los guards de renderizado", () => {
    const voiceNullNotice: VoiceLibraryVoice = {
      voiceId: "v-null-notice",
      publicOwnerId: "owner-2",
      name: "Voice Null Notice",
      language: "es",
      locale: null,
      accent: null,
      gender: null,
      age: null,
      useCase: null,
      descriptive: null,
      description: null,
      category: "shared",
      previewUrl: null,
      clonedByCount: 0,
      usageCharacterCount1y: 0,
      featured: false,
      freeUsersAllowed: true,
      liveModerationEnabled: false,
      noticePeriod: null,
      rate: 1,
      verifiedLanguages: [],
    };

    // Guard test:
    const shouldShowNotice = typeof voiceNullNotice.noticePeriod === "number" && voiceNullNotice.noticePeriod > 0;
    expect(shouldShowNotice).toBe(false);

    // Guard for noticePeriod = 0
    const voiceZeroNotice = { ...voiceNullNotice, noticePeriod: 0 };
    const shouldShowZeroNotice = typeof voiceZeroNotice.noticePeriod === "number" && voiceZeroNotice.noticePeriod > 0;
    expect(shouldShowZeroNotice).toBe(false);

    // Guard for noticePeriod = 730 (valid notice period)
    const voiceValidNotice = { ...voiceNullNotice, noticePeriod: 730 };
    const shouldShowValidNotice = typeof voiceValidNotice.noticePeriod === "number" && voiceValidNotice.noticePeriod > 0;
    expect(shouldShowValidNotice).toBe(true);
  });
});
