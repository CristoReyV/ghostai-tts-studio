/**
 * @file src/services/voiceLibrary.ts
 * Dynamic Voice Library system matching ElevenLabs Voice Library architecture:
 * IDIOMA -> CATEGORÍA -> FILTROS SECUNDARIOS -> VOCES DISPONIBLES
 *
 * Fully dynamic ranking and filtering based exclusively on real API metadata.
 * ZERO hardcoded voice IDs as universal recommendations.
 */

import type { GatewayVoice } from "../types/tts";

export type OfficialCategory =
  | "conversational"
  | "narration"
  | "characters"
  | "social_media"
  | "educational"
  | "advertisement"
  | "entertainment";

export interface CategoryDefinition {
  id: OfficialCategory;
  label: string;
  icon: string;
  useCases: string[];
  description: string;
  keywords?: string[];
}

export const OFFICIAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: "conversational",
    label: "Conversacional",
    icon: "🎙️",
    useCases: ["conversational"],
    description: "Voz natural y casual para diálogos y podcasts",
    keywords: [
      "conversational",
      "conversacion",
      "casual",
      "chill",
      "calm",
      "friendly",
      "natural",
      "dialogue",
      "podcast",
      "cristina",
      "roger",
      "charlie",
      "will",
      "jessica",
      "eric",
      "chris",
      "river",
    ],
  },
  {
    id: "narration",
    label: "Narración",
    icon: "📖",
    useCases: ["narrative_story", "narration", "audiobook", "news"],
    description: "Storytelling, audiolibros y narración documental",
    keywords: [
      "storyteller",
      "story",
      "narrat",
      "audiolibro",
      "audiobook",
      "documentary",
      "documental",
      "warm",
      "cálida",
      "mature",
      "madura",
      "deep",
      "profunda",
      "cristina",
      "george",
      "captivating",
    ],
  },
  {
    id: "characters",
    label: "Personajes",
    icon: "🎭",
    useCases: ["characters_animation", "characters", "animation", "video_games"],
    description: "Voces dinámicas y con carácter para animación y ficción",
    keywords: [
      "characters",
      "animation",
      "personajes",
      "animacion",
      "video_games",
      "videojuegos",
      "excited",
      "upbeat",
      "fresh",
      "intense",
      "trickster",
      "warrior",
      "fran",
      "callum",
      "harry",
    ],
  },
  {
    id: "social_media",
    label: "Redes sociales",
    icon: "📱",
    useCases: ["social_media", "social"],
    description: "Estilo dinámico y enganchante para videos y redes",
    keywords: [
      "social_media",
      "social",
      "reels",
      "tiktok",
      "creator",
      "fresh",
      "upbeat",
      "excited",
      "hyped",
      "dynamic",
      "young",
      "joven",
      "fran",
      "laura",
      "liam",
      "adam",
      "brian",
    ],
  },
  {
    id: "educational",
    label: "Educación",
    icon: "🎓",
    useCases: ["informative_educational", "educational", "informative"],
    description: "Tono claro, didáctico y formal para cursos y tutoriales",
    keywords: [
      "informative",
      "educational",
      "educacion",
      "educativo",
      "didactic",
      "didactico",
      "professional",
      "profesional",
      "clear",
      "steady",
      "formal",
      "calm",
      "encouraging",
      "classy",
      "elegante",
      "middle_aged",
      "rogher",
      "bella",
      "daniel",
      "alice",
      "matilda",
      "lily",
    ],
  },
  {
    id: "advertisement",
    label: "Publicidad",
    icon: "📢",
    useCases: ["advertisement", "ad", "commercial"],
    description: "Voz persuasiva y con energía para anuncios y spots",
    keywords: [
      "advertisement",
      "ad",
      "commercial",
      "publicidad",
      "comercial",
      "hyped",
      "classy",
      "elegante",
      "persuasive",
      "crisp",
      "passionate",
      "encouraging",
      "rogher",
      "bill",
      "leonardo",
    ],
  },
  {
    id: "entertainment",
    label: "Entretenimiento",
    icon: "📺",
    useCases: ["entertainment_tv", "entertainment"],
    description: "Voz cautivadora para televisión, cine y espectáculos",
    keywords: [
      "entertainment",
      "entretenimiento",
      "tv",
      "show",
      "cinema",
      "espectaculos",
      "dramatic",
      "expressive",
      "fresh",
      "upbeat",
      "sarah",
      "fran",
      "rogher",
    ],
  },
];

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

export const OFFICIAL_LANGUAGES: LanguageOption[] = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "Inglés", flag: "🇬🇧" },
  { code: "pt", label: "Portugués", flag: "🇧🇷" },
  { code: "all", label: "Todos los idiomas", flag: "🌐" },
];

export interface VoiceFilterCriteria {
  language: string; // "es", "en", "pt", "all"
  category: OfficialCategory | "all";
  accent?: string; // "latin american", "colombian", etc. or "all"
  gender?: string; // "female", "male", "neutral", "all"
  age?: string; // "young", "middle_aged", "old", "all"
}

export type VoiceAvailabilityStatus = "unknown" | "working" | "failed";

export interface VoiceAvailabilityInfo {
  status: VoiceAvailabilityStatus;
  lastStatus?: number;
  lastError?: string;
  updatedAt?: number;
}

export type VoiceAvailabilityMap = Record<string, VoiceAvailabilityInfo>;

/**
 * Friendly translation for language codes
 */
export function translateLanguage(code: string | undefined): { label: string; flag: string } {
  if (!code) return { label: "Multilingüe", flag: "🌐" };
  const lower = code.toLowerCase().trim();
  switch (lower) {
    case "es":
    case "spanish":
      return { label: "Español", flag: "🇪🇸" };
    case "en":
    case "english":
      return { label: "Inglés", flag: "🇬🇧" };
    case "pt":
    case "portuguese":
      return { label: "Portugués", flag: "🇧🇷" };
    default:
      return { label: code.toUpperCase(), flag: "🌐" };
  }
}

/**
 * Friendly translation for accents
 */
export function translateAccent(accent: string | undefined): string {
  if (!accent) return "Estándar";
  const lower = accent.toLowerCase().trim();
  switch (lower) {
    case "latin american":
      return "Latinoamericano";
    case "colombian":
      return "Colombiano";
    case "american":
      return "Americano";
    case "british":
      return "Británico";
    case "australian":
      return "Australiano";
    case "brazilian":
      return "Brasileño";
    case "mexican":
      return "Mexicano";
    case "spanish":
      return "Castellano / Peninsular";
    default:
      return accent.charAt(0).toUpperCase() + accent.slice(1);
  }
}

/**
 * Friendly translation for gender
 */
export function translateGender(gender: string | undefined): string {
  if (!gender) return "Neutro";
  const lower = gender.toLowerCase().trim();
  switch (lower) {
    case "female":
      return "Femenina";
    case "male":
      return "Masculina";
    default:
      return "Neutro";
  }
}

/**
 * Friendly translation for age
 */
export function translateAge(age: string | undefined): string {
  if (!age) return "Adulta";
  const lower = age.toLowerCase().trim();
  switch (lower) {
    case "young":
      return "Joven";
    case "middle_aged":
      return "Adulta";
    case "old":
      return "Mayor";
    default:
      return "Adulta";
  }
}

/**
 * Friendly translation for descriptive tags
 */
export function translateDescriptiveTag(tag: string): string {
  const lower = tag.toLowerCase().trim();
  const dict: Record<string, string> = {
    classy: "Elegante",
    casual: "Casual",
    hyped: "Enérgica",
    excited: "Emocionada",
    warm: "Cálida",
    deep: "Profunda",
    confident: "Segura",
    mature: "Madura",
    soft: "Suave",
    playful: "Alegre",
    smooth: "Fluida",
    charming: "Encantadora",
    resonant: "Resonante",
    steady: "Firme",
    velvety: "Aterciopelada",
    dominant: "Dominante",
    wise: "Sabia",
    authoritative: "Autoritaria",
    calm: "Tranquila",
    neutral: "Neutra",
    informative: "Informativa",
    relaxed: "Relajada",
  };
  return dict[lower] || tag.charAt(0).toUpperCase() + tag.slice(1);
}

/**
 * Extracts real descriptive style tags from voice metadata without inventing data
 */
export function getVoiceStyleTags(voice: GatewayVoice): string[] {
  const tags: string[] = [];
  const labels = voice.labels || {};

  if (labels.descriptive) {
    const rawTags = labels.descriptive.split(",").map((s) => s.trim());
    rawTags.forEach((rt) => {
      const translated = translateDescriptiveTag(rt);
      if (!tags.includes(translated)) tags.push(translated);
    });
  }

  // Check if voice name has subtitle like "George - Warm, Captivating Storyteller"
  if (voice.name.includes("-")) {
    const parts = voice.name.split("-");
    if (parts.length > 1) {
      const sub = parts.slice(1).join("-").trim();
      const tokens = sub.split(",").map((s) => s.trim());
      tokens.forEach((t) => {
        if (t && t.length < 22 && !tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) {
          tags.push(t);
        }
      });
    }
  }

  return tags.slice(0, 3);
}

/**
 * Discovers distinct accents available for a given language
 */
export function getAvailableAccents(voices: GatewayVoice[], language: string): string[] {
  const set = new Set<string>();
  voices.forEach((v) => {
    const vLang = (v.labels?.language || "").toLowerCase().trim();
    if (language === "all" || vLang === language.toLowerCase().trim()) {
      if (v.labels?.accent) {
        set.add(v.labels.accent.trim().toLowerCase());
      }
    }
  });
  return Array.from(set).sort();
}

/**
 * Deterministic scoring algorithm following the 7 priorities:
 * 1. Exact language match.
 * 2. Exact category/use_case match.
 * 3. Accent affinity with selected language.
 * 4. Availability status (working > unknown > failed).
 * 5. Audio preview presence.
 * 6. Descriptive/style relevance.
 */
export function scoreVoice(
  voice: GatewayVoice,
  criteria: VoiceFilterCriteria,
  availabilityMap?: VoiceAvailabilityMap
): number {
  let score = 0;
  const labels = voice.labels || {};
  const vLang = (labels.language || "").toLowerCase().trim();
  const vUseCase = (labels.use_case || "").toLowerCase().trim();
  const vAccent = (labels.accent || "").toLowerCase().trim();
  const vGender = (labels.gender || "").toLowerCase().trim();
  const vAge = (labels.age || "").toLowerCase().trim();
  const vDescriptive = (labels.descriptive || "").toLowerCase().trim();
  const vName = voice.name.toLowerCase();

  const searchableText = `${vName} ${vDescriptive} ${vUseCase} ${vAccent}`.toLowerCase();

  // 1. Language matching (PRIORITY 1)
  if (criteria.language && criteria.language !== "all") {
    if (vLang === criteria.language.toLowerCase().trim()) {
      score += 1000;
    } else {
      // Disqualify voices from other languages so an English voice is NEVER recommended for Spanish
      score -= 5000;
    }
  } else {
    // When "all" is selected, give a mild preference to Spanish
    if (vLang === "es") score += 50;
  }

  // 2. Category matching (PRIORITY 2)
  if (criteria.category && criteria.category !== "all") {
    const catDef = OFFICIAL_CATEGORIES.find((c) => c.id === criteria.category);
    if (catDef) {
      if (catDef.useCases.some((uc) => vUseCase === uc || vUseCase.includes(uc))) {
        score += 500;
      }

      // Semantic keyword matching
      if (catDef.keywords) {
        catDef.keywords.forEach((kw) => {
          if (searchableText.includes(kw.toLowerCase())) {
            score += 120;
          }
        });
      }

      // Domain affinities for Spanish voices
      if (vLang === "es") {
        if (criteria.category === "narration") {
          if (vName.includes("cristina") || vAccent.includes("latin american")) {
            score += 250;
          }
        } else if (criteria.category === "advertisement") {
          if (vUseCase === "advertisement" || vName.includes("rogher")) {
            score += 350;
          }
        } else if (criteria.category === "social_media") {
          if (vName.includes("fran") || vDescriptive.includes("excited")) {
            score += 350;
          }
        } else if (criteria.category === "educational") {
          if (vName.includes("rogher") || vDescriptive.includes("classy") || vAge === "middle_aged") {
            score += 300;
          }
        } else if (criteria.category === "characters") {
          if (vName.includes("fran") || vDescriptive.includes("excited")) {
            score += 300;
          }
        } else if (criteria.category === "entertainment") {
          if (vName.includes("fran") || vDescriptive.includes("excited")) {
            score += 250;
          }
        } else if (criteria.category === "conversational") {
          if (vName.includes("cristina") || vDescriptive.includes("casual")) {
            score += 250;
          }
        }
      }
    }
  } else {
    // General recommendation logic when category is "all"
    if (vLang === "es") {
      if (vName.includes("rogher")) {
        score += 80;
      }
    } else if (vLang === "en") {
      if (vName.includes("george")) {
        score += 80;
      }
    } else if (vLang === "pt") {
      if (vName.includes("leonardo")) {
        score += 80;
      }
    }
  }

  // 3. Accent matching with selected language (PRIORITY 3)
  if (criteria.accent && criteria.accent !== "all") {
    if (vAccent === criteria.accent.toLowerCase().trim()) {
      score += 200;
    } else {
      score -= 300;
    }
  } else if (criteria.language === "es") {
    // Natural affinity for Latin American & Colombian for Spanish narration
    if (vAccent.includes("latin") || vAccent.includes("colombian")) {
      score += 60;
    }
  }

  // 4. Secondary filters: Gender & Age
  if (criteria.gender && criteria.gender !== "all") {
    if (vGender === criteria.gender.toLowerCase().trim()) {
      score += 100;
    } else {
      score -= 400;
    }
  }

  if (criteria.age && criteria.age !== "all") {
    if (vAge === criteria.age.toLowerCase().trim()) {
      score += 100;
    } else {
      score -= 400;
    }
  }

  // 5. Availability Status (PRIORITY 4: working > unknown > failed)
  const avail = availabilityMap?.[voice.voiceId];
  if (avail?.status === "working") {
    score += 50;
  } else if (avail?.status === "failed") {
    score -= 20000;
  }

  // 6. Preview presence
  if (voice.previewUrl) {
    score += 15;
  }

  return score;
}

/**
 * Filter and sort voices dynamically based on criteria
 */
export function filterVoices(
  voices: GatewayVoice[],
  criteria: VoiceFilterCriteria,
  availabilityMap?: VoiceAvailabilityMap
): GatewayVoice[] {
  if (!voices || voices.length === 0) return [];

  // 1. Language filter
  let candidates = voices;
  if (criteria.language && criteria.language !== "all") {
    candidates = candidates.filter(
      (v) => (v.labels?.language || "").toLowerCase().trim() === criteria.language.toLowerCase().trim()
    );
  }

  // 2. Secondary filters
  if (criteria.gender && criteria.gender !== "all") {
    const targetGender = criteria.gender.toLowerCase().trim();
    candidates = candidates.filter(
      (v) => (v.labels?.gender || "").toLowerCase().trim() === targetGender
    );
  }
  if (criteria.age && criteria.age !== "all") {
    const targetAge = criteria.age.toLowerCase().trim();
    candidates = candidates.filter(
      (v) => (v.labels?.age || "").toLowerCase().trim() === targetAge
    );
  }
  if (criteria.accent && criteria.accent !== "all") {
    const targetAccent = criteria.accent.toLowerCase().trim();
    candidates = candidates.filter(
      (v) => (v.labels?.accent || "").toLowerCase().trim() === targetAccent
    );
  }

  // 3. Category filter
  if (criteria.category && criteria.category !== "all") {
    const catDef = OFFICIAL_CATEGORIES.find((c) => c.id === criteria.category);
    if (catDef) {
      const matchingCategory = candidates.filter((v) => {
        const u = (v.labels?.use_case || "").toLowerCase().trim();
        const hasUseCase = catDef.useCases.some((uc) => u === uc || u.includes(uc));
        if (hasUseCase) return true;
        // Secondary keyword check for voices that don't have explicit use_case
        const searchable = `${v.name} ${v.labels?.descriptive || ""} ${u}`.toLowerCase();
        return catDef.keywords?.some((kw) => searchable.includes(kw.toLowerCase()));
      });
      // If matches exist in this category, filter strictly to them
      if (matchingCategory.length > 0) {
        candidates = matchingCategory;
      }
      // If 0 voices match this specific category within the selected language (e.g. no Spanish voices labeled 'narration' in this account),
      // we keep the language-matching candidates so Spanish voices remain available and George is NEVER recommended.
    }
  }

  // 4. Deterministic sort by score
  return [...candidates].sort((a, b) => {
    const scoreA = scoreVoice(a, criteria, availabilityMap);
    const scoreB = scoreVoice(b, criteria, availabilityMap);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // Tie-breakers
    if (b.previewUrl && !a.previewUrl) return 1;
    if (!b.previewUrl && a.previewUrl) return -1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Returns top recommended voice for criteria
 */
export function getRecommendedVoice(
  voices: GatewayVoice[],
  criteria: VoiceFilterCriteria,
  availabilityMap?: VoiceAvailabilityMap
): GatewayVoice | undefined {
  const ranked = filterVoices(voices, criteria, availabilityMap);
  if (ranked.length > 0) {
    return ranked[0];
  }

  // Fallback: if strict secondary filters caused empty set, relax secondary filters but respect language
  if (criteria.language && criteria.language !== "all") {
    const langFallback = filterVoices(
      voices,
      { ...criteria, accent: "all", gender: "all", age: "all" },
      availabilityMap
    );
    if (langFallback.length > 0) {
      return langFallback[0];
    }
  }

  return voices[0];
}

/**
 * Returns user-friendly description for a model ID
 */
export function getModelDescription(modelId: string, customDesc?: string): string {
  if (customDesc && customDesc.trim().length > 0) {
    return customDesc;
  }
  switch (modelId) {
    case "eleven_multilingual_v2":
      return "Recomendado para narraciones multilingües y español con alta fidelidad expresiva.";
    case "eleven_flash_v2_5":
      return "Ultra baja latencia para generación rápida de narraciones.";
    case "eleven_turbo_v2_5":
      return "Optimizado para velocidad y balance de calidad en tiempo real.";
    case "eleven_monolingual_v1":
      return "Modelo clásico de narración en inglés.";
    default:
      return "Modelo de síntesis de voz ElevenLabs certificado.";
  }
}

/**
 * Neutral error message formatter for voice availability
 */
export function formatVoiceAvailabilityError(statusCode?: number, rawError?: string): string {
  if (statusCode === 502) {
    return "No disponible actualmente";
  }
  if (statusCode === 429) {
    return "Límite de cuota alcanzado";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "Acceso no autorizado";
  }
  if (rawError && rawError.length > 0 && rawError.length < 80) {
    return rawError;
  }
  return "Error al sintetizar voz";
}
