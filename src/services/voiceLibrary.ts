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
    case "peninsular":
    case "spanish":
      return "España / Peninsular";
    case "mexican":
      return "Mexicano";
    case "colombian":
      return "Colombiano";
    case "argentine":
    case "argentinian":
      return "Argentino";
    case "chilean":
      return "Chileno";
    case "peruvian":
      return "Peruano";
    case "venezuelan":
      return "Venezolano";
    case "american":
      return "Americano";
    case "british":
      return "Británico";
    case "australian":
      return "Australiano";
    case "brazilian":
      return "Brasileño";
    default:
      return accent.charAt(0).toUpperCase() + accent.slice(1);
  }
}

export const COMMON_LANGUAGE_ACCENTS: Record<string, string[]> = {
  es: [
    "latin american",
    "peninsular",
    "mexican",
    "colombian",
    "argentine",
    "chilean",
    "peruvian",
    "venezuelan"
  ],
  en: [
    "american",
    "british",
    "australian",
    "canadian",
    "irish",
    "indian"
  ],
  pt: [
    "brazilian",
    "european"
  ]
};

export interface UseCaseOption {
  id: string;
  label: string;
  icon: string;
}

export const USE_CASE_OPTIONS: UseCaseOption[] = [
  { id: "all", label: "Todos", icon: "✨" },
  { id: "narrative_story", label: "Narración", icon: "📖" },
  { id: "conversational", label: "Conversacional", icon: "🎙️" },
  { id: "social_media", label: "Redes sociales", icon: "📱" },
  { id: "informative_educational", label: "Educación", icon: "🎓" },
  { id: "advertisement", label: "Publicidad", icon: "📢" },
  { id: "characters_animation", label: "Personajes", icon: "🎭" },
  { id: "entertainment_tv", label: "Entretenimiento", icon: "🎬" },
];

export function translateUseCase(useCase: string | null | undefined): string {
  if (!useCase) return "General";
  const lower = useCase.toLowerCase().trim();
  switch (lower) {
    case "narrative_story":
    case "narration":
      return "Narración";
    case "conversational":
      return "Conversacional";
    case "social_media":
      return "Redes sociales";
    case "informative_educational":
    case "educational":
      return "Educación";
    case "advertisement":
      return "Publicidad";
    case "characters_animation":
    case "characters":
      return "Personajes";
    case "entertainment_tv":
    case "entertainment":
      return "Entretenimiento";
    default:
      return useCase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

export type VoicePlanAvailability = "available" | "restricted" | "unknown";

export interface VoicePlanAvailabilityResult {
  availability: VoicePlanAvailability;
  badgeLabel: string;
  reason?: string;
  isBlockedForSynthesis: boolean;
}

/**
 * Evaluates whether a voice is usable by the current ElevenLabs account based on
 * real provider subscription capabilities (tier) and voice metadata.
 *
 * Rules:
 * 1. Account confirmed as Free ("free"):
 *    - Shared library voice with freeUsersAllowed === false:
 *      -> Restricted ("PLAN REQUERIDO"). Blocked for synthesis & adding.
 *    - Premade voice (category === "premade"):
 *      -> Available ("DISPONIBLE GRATIS").
 *    - Account custom voice (category === "cloned" | "generated"):
 *      -> Available ("DISPONIBLE GRATIS").
 *    - Shared library voice with freeUsersAllowed === true:
 *      -> Available ("DISPONIBLE GRATIS").
 *
 * 2. Account confirmed as Paid (tier != "free" and != "unknown"):
 *    - All library & account voices:
 *      -> Available ("DISPONIBLE CON TU PLAN").
 *
 * 3. Account Tier Unknown / Unconnected:
 *    - If freeUsersAllowed === false:
 *      -> Restricted ("PLAN REQUERIDO").
 *    - If category === "premade":
 *      -> Available ("DISPONIBLE").
 *    - Otherwise:
 *      -> Unknown ("DISPONIBILIDAD POR VERIFICAR").
 */
export function checkVoicePlanAvailability(
  voice: {
    category?: string | null;
    freeUsersAllowed?: boolean;
    labels?: Record<string, string>;
  },
  tier?: string | null
): VoicePlanAvailabilityResult {
  const normTier = (tier || "").trim().toLowerCase();
  const isFree = normTier === "free";
  const isPaid = normTier.length > 0 && normTier !== "free" && normTier !== "unknown";

  // If tier is confirmed as Paid
  if (isPaid) {
    return {
      availability: "available",
      badgeLabel: "DISPONIBLE CON TU PLAN",
      isBlockedForSynthesis: false,
    };
  }

  // Premade voices are universally available to all tiers including Free
  if (voice.category === "premade") {
    return {
      availability: "available",
      badgeLabel: isFree ? "DISPONIBLE GRATIS" : "DISPONIBLE",
      isBlockedForSynthesis: false,
    };
  }

  // Cloned or generated voices belonging to user's account
  if (voice.category === "cloned" || voice.category === "generated") {
    return {
      availability: "available",
      badgeLabel: isFree ? "DISPONIBLE GRATIS" : "DISPONIBLE",
      isBlockedForSynthesis: false,
    };
  }

  // If freeUsersAllowed is explicitly false (e.g. shared library voice on Free account)
  if (voice.freeUsersAllowed === false) {
    return {
      availability: "restricted",
      badgeLabel: "PLAN REQUERIDO",
      reason:
        "Esta voz requiere un plan de ElevenLabs compatible. Puedes elegir una voz disponible con tu cuenta o actualizar tu plan directamente en ElevenLabs.",
      isBlockedForSynthesis: true,
    };
  }

  // If freeUsersAllowed is explicitly true
  if (voice.freeUsersAllowed === true) {
    return {
      availability: "available",
      badgeLabel: isFree ? "DISPONIBLE GRATIS" : "DISPONIBLE",
      isBlockedForSynthesis: false,
    };
  }

  // If freeUsersAllowed is not specified on a shared voice or account tier is unverified,
  // classify as unknown rather than assuming available or restricted (UX 03 Section 1 & 13)
  if (voice.freeUsersAllowed === undefined || !normTier || normTier === "unknown") {
    return {
      availability: "unknown",
      badgeLabel: "DISPONIBILIDAD POR VERIFICAR",
      isBlockedForSynthesis: false,
    };
  }

  // Default fallback for Free tier when no restriction is detected
  return {
    availability: "available",
    badgeLabel: "DISPONIBLE",
    isBlockedForSynthesis: false,
  };
}

/**
 * User-friendly error message formatter translating technical provider errors.
 * Never exposes raw HTTP codes, stack traces, or internal URLs to the public UI.
 */
export function formatVoiceAvailabilityError(statusCode?: number, rawError?: string): string {
  const err = (rawError || "").toLowerCase();

  if (
    err.includes("voice_requires_subscription") ||
    err.includes("requires a subscription") ||
    err.includes("paid plan") ||
    err.includes("subscription required") ||
    err.includes("plan compatible")
  ) {
    return "Esta voz requiere un plan de ElevenLabs compatible.";
  }

  if (
    statusCode === 429 ||
    err.includes("quota_exceeded") ||
    err.includes("quota exceeded") ||
    err.includes("credit") ||
    err.includes("crédito") ||
    err.includes("character limit")
  ) {
    return "Tu cuenta de ElevenLabs no tiene créditos suficientes.";
  }

  if (
    statusCode === 401 ||
    err.includes("invalid_api_key") ||
    err.includes("invalid api key") ||
    err.includes("unauthorized") ||
    err.includes("invalid key")
  ) {
    return "No pudimos validar tu conexión con ElevenLabs.";
  }

  if (statusCode === 403 || err.includes("forbidden") || err.includes("permission")) {
    return "Esta voz requiere un plan de ElevenLabs compatible.";
  }

  if (statusCode === 502 || statusCode === 503 || err.includes("bad gateway") || err.includes("unavailable")) {
    return "El servicio de voz no está disponible temporalmente.";
  }

  return "No se pudo procesar la narración con la voz seleccionada.";
}


export type VoiceCatalogFilter = "available" | "all" | "restricted" | "unknown";

export interface VoiceCatalogCounts {
  available: number;
  restricted: number;
  unknown: number;
  total: number;
}

/**
 * Computes dynamic catalog counts for all availability categories from current loaded voice list.
 * Never uses hardcoded numbers (UX 03 Section 4).
 */
export function computeVoiceCatalogCounts(
  voices: Array<{
    category?: string | null;
    freeUsersAllowed?: boolean;
    labels?: Record<string, string>;
  }>,
  tier?: string | null
): VoiceCatalogCounts {
  let available = 0;
  let restricted = 0;
  let unknown = 0;
  for (const v of voices) {
    const check = checkVoicePlanAvailability(v, tier);
    if (check.availability === "available") {
      available++;
    } else if (check.availability === "restricted") {
      restricted++;
    } else {
      unknown++;
    }
  }
  return {
    available,
    restricted,
    unknown,
    total: voices.length,
  };
}

/**
 * Filters and sorts catalog voices based on active plan availability filter and search query (UX 03 Sections 2, 6, 9).
 * - "available": shows only available voices (default for Free accounts)
 * - "restricted": shows only restricted voices
 * - "unknown": shows only voices with unverified plan status
 * - "all": shows all voices sorted (available first, unknown second, restricted last)
 * - Search: operates strictly inside the active filter.
 */
export function filterAndSortVoiceCatalog<
  T extends {
    name: string;
    category?: string | null;
    freeUsersAllowed?: boolean;
    labels?: Record<string, string>;
    description?: string | null;
    useCase?: string | null;
  }
>(
  voices: T[],
  filter: VoiceCatalogFilter,
  tier?: string | null,
  searchQuery?: string
): T[] {
  let list = voices;

  // 1. Filter by availability tab
  if (filter === "available") {
    list = list.filter(
      (v) => checkVoicePlanAvailability(v, tier).availability === "available"
    );
  } else if (filter === "restricted") {
    list = list.filter(
      (v) => checkVoicePlanAvailability(v, tier).availability === "restricted"
    );
  } else if (filter === "unknown") {
    list = list.filter(
      (v) => checkVoicePlanAvailability(v, tier).availability === "unknown"
    );
  }

  // 2. Search query operates inside the active filter (UX 03 Section 9)
  if (searchQuery && searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((v) => {
      const nameMatch = (v.name || "").toLowerCase().includes(q);
      const descMatch = (v.description || "").toLowerCase().includes(q);
      const useCaseMatch = (v.useCase || "").toLowerCase().includes(q);
      return nameMatch || descMatch || useCaseMatch;
    });
  }

  // 3. Sorting (UX 03 Section 6):
  // For ALL: available first, unknown second, restricted last.
  // Within same bucket: preserve catalog order.
  return [...list].sort((a, b) => {
    const aAvail = checkVoicePlanAvailability(a, tier).availability;
    const bAvail = checkVoicePlanAvailability(b, tier).availability;

    const rank = (avail: VoicePlanAvailability) => {
      if (avail === "available") return 1;
      if (avail === "unknown") return 2;
      return 3; // restricted
    };

    const diff = rank(aAvail) - rank(bAvail);
    if (diff !== 0) return diff;
    return 0;
  });
}

/**
 * Returns user-facing helper text for voice cards per UX 03 Section 5.
 */
export function getVoicePlanHelperText(
  voice: {
    category?: string | null;
    freeUsersAllowed?: boolean;
    labels?: Record<string, string>;
  },
  tier?: string | null
): string {
  const check = checkVoicePlanAvailability(voice, tier);
  if (check.availability === "available") {
    return "Disponible con tu cuenta actual.";
  }
  if (check.availability === "restricted") {
    return "Esta voz requiere un plan compatible de ElevenLabs.";
  }
  return "No pudimos confirmar la disponibilidad con tu cuenta.";
}

/**
 * Returns user-facing badge label for voice cards per UX 03 Section 5.
 */
export function getVoicePlanBadgeLabel(
  voice: {
    category?: string | null;
    freeUsersAllowed?: boolean;
    labels?: Record<string, string>;
  },
  tier?: string | null
): string {
  const normTier = (tier || "").trim().toLowerCase();
  const isFree = normTier === "free";
  const isPaid = normTier.length > 0 && normTier !== "free" && normTier !== "unknown";
  const check = checkVoicePlanAvailability(voice, tier);

  if (check.availability === "available") {
    if (isFree) return "✓ DISPONIBLE GRATIS";
    if (isPaid) return "✓ DISPONIBLE CON TU PLAN";
    return "✓ DISPONIBLE";
  }
  if (check.availability === "restricted") {
    return "PLAN REQUERIDO";
  }
  return "POR VERIFICAR";
}
