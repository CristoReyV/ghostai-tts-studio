/**
 * @file src/services/voicePresets.ts
 * Dynamic classification and deterministic matching of ElevenLabs voices
 * into high-level Voice Presets based strictly on real API metadata.
 * NO hardcoded voice IDs.
 */

import type { GatewayVoice } from "../types/tts";

export type VoicePresetId =
  | "narrativo_epico"
  | "cinematico_trailer"
  | "storytelling"
  | "documental"
  | "comercial_publicidad"
  | "corporativo_profesional"
  | "social_media_reels"
  | "conversacional_natural"
  | "espanol_latino"
  | "energetico"
  | "calido_emotivo"
  | "recomendadas";

export interface VoicePreset {
  id: VoicePresetId;
  name: string;
  emoji: string;
  description: string;
  targetKeywords: {
    useCases?: string[];
    descriptive?: string[];
    accents?: string[];
    languages?: string[];
    nameKeywords?: string[];
    category?: string[];
  };
  negativeKeywords?: {
    languages?: string[];
    accents?: string[];
  };
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: "narrativo_epico",
    name: "Narrativo Épico",
    emoji: "🎬",
    description: "Voces profundas, expresivas y con presencia para historias, documentales y contenido cinematográfico.",
    targetKeywords: {
      useCases: ["narrative_story", "entertainment_tv"],
      descriptive: ["mature", "classy", "confident", "rough", "formal"],
      nameKeywords: ["storyteller", "deep", "resonant", "mature", "captivating", "warrior", "firm"],
    },
  },
  {
    id: "cinematico_trailer",
    name: "Cinemático / Trailer",
    emoji: "⚡",
    description: "Mayor presencia y dramatismo para intros, trailers y piezas audiovisuales.",
    targetKeywords: {
      useCases: ["entertainment_tv", "narrative_story", "characters_animation"],
      descriptive: ["rough", "classy", "confident", "mature", "crisp"],
      nameKeywords: ["deep", "resonant", "warrior", "dominant", "firm", "broadcaster"],
    },
  },
  {
    id: "storytelling",
    name: "Storytelling",
    emoji: "📖",
    description: "Natural, expresiva y cercana para contar historias.",
    targetKeywords: {
      useCases: ["narrative_story", "conversational"],
      descriptive: ["mature", "casual", "calm", "classy", "warm"],
      nameKeywords: ["storyteller", "captivating", "warm", "casual", "laid-back"],
    },
  },
  {
    id: "documental",
    name: "Documental",
    emoji: "🎙️",
    description: "Tono sobrio, informativo y con credibilidad para narraciones formales y educativas.",
    targetKeywords: {
      useCases: ["informative_educational", "narrative_story"],
      descriptive: ["professional", "formal", "mature", "calm", "crisp"],
      nameKeywords: ["broadcaster", "educator", "steady", "wise", "balanced", "reassuring"],
    },
  },
  {
    id: "comercial_publicidad",
    name: "Comercial / Publicidad",
    emoji: "📢",
    description: "Voces claras, atractivas y dinámicas para anuncios y promociones.",
    targetKeywords: {
      useCases: ["advertisement"],
      descriptive: ["hyped", "classy", "confident", "crisp", "professional"],
      nameKeywords: ["encouraging", "passionate", "confident", "bright", "creator"],
    },
  },
  {
    id: "corporativo_profesional",
    name: "Corporativo / Profesional",
    emoji: "💼",
    description: "Dicción clara y tono profesional para presentaciones, capacitación y comunicación empresarial.",
    targetKeywords: {
      useCases: ["informative_educational"],
      descriptive: ["professional", "formal", "confident", "classy"],
      category: ["professional"],
      nameKeywords: ["professional", "educator", "reassuring", "clear", "steady"],
    },
  },
  {
    id: "social_media_reels",
    name: "Social Media / Reels",
    emoji: "📱",
    description: "Voces dinámicas y naturales para contenido corto y redes sociales.",
    targetKeywords: {
      useCases: ["social_media"],
      descriptive: ["sassy", "confident", "hyped", "excited", "upbeat"],
      nameKeywords: ["creator", "enthusiast", "energetic", "quirky"],
    },
  },
  {
    id: "conversacional_natural",
    name: "Conversacional Natural",
    emoji: "💬",
    description: "Una voz natural, cercana y poco formal.",
    targetKeywords: {
      useCases: ["conversational"],
      descriptive: ["casual", "chill", "calm", "friendly", "natural"],
      nameKeywords: ["casual", "laid-back", "down-to-earth", "optimist", "friendly"],
    },
  },
  {
    id: "espanol_latino",
    name: "Español Latino / Neutro",
    emoji: "🌎",
    description: "Voces nativas y optimizadas para pronunciación natural en español latinoamericano.",
    targetKeywords: {
      languages: ["es"],
      accents: ["latin american", "colombian"],
      nameKeywords: ["latino", "español", "spanish", "campos", "rogher", "fran", "cristina"],
    },
    negativeKeywords: {
      languages: ["en", "pt"],
      accents: ["british", "australian", "american"],
    },
  },
  {
    id: "energetico",
    name: "Energético",
    emoji: "🔥",
    description: "Más energía y ritmo para contenido dinámico.",
    targetKeywords: {
      descriptive: ["excited", "hyped", "upbeat", "sassy"],
      useCases: ["social_media", "advertisement"],
      nameKeywords: ["energetic", "fresh", "upbeat", "hyped", "passionate", "bright"],
    },
  },
  {
    id: "calido_emotivo",
    name: "Cálido / Emotivo",
    emoji: "✨",
    description: "Tono humano y emocional para contenido cercano.",
    targetKeywords: {
      descriptive: ["casual", "calm", "classy", "cute"],
      nameKeywords: ["warm", "comforting", "reassuring", "passionate", "gentle", "velvety", "optimist"],
    },
  },
  {
    id: "recomendadas",
    name: "Recomendadas",
    emoji: "⭐",
    description: "Selección balanceada por calidad de síntesis, metadatos y versatilidad.",
    targetKeywords: {
      category: ["professional", "premade"],
      languages: ["es", "en"],
      descriptive: ["classy", "professional", "mature", "confident"],
    },
  },
];

export type VoiceAvailabilityStatus = "unknown" | "working" | "failed";

export interface VoiceAvailabilityRecord {
  status: VoiceAvailabilityStatus;
  lastStatus?: number;
  lastError?: string;
  updatedAt?: number;
}

export type VoiceAvailabilityMap = Record<string, VoiceAvailabilityRecord>;

/**
 * Returns a clean, neutral error message when a voice generation fails,
 * avoiding unverified assumptions about plan tiers (e.g. 502 -> 'No disponible actualmente').
 */
export function formatVoiceAvailabilityError(status?: number, rawMessage?: string): string {
  if (status === 502 || rawMessage?.includes("502") || rawMessage?.includes("unexpected error")) {
    return "No disponible actualmente";
  }
  return rawMessage || "No disponible actualmente";
}

/**
 * Computes a deterministic suitability score for a voice against a given preset based strictly on real metadata.
 */
export function scoreVoiceForPreset(voice: GatewayVoice, preset: VoicePreset): number {
  let score = 0;
  const labels = voice.labels || {};
  const voiceLang = (labels.language || "").toLowerCase().trim();
  const voiceAccent = (labels.accent || "").toLowerCase().trim();
  const voiceUseCase = (labels.use_case || "").toLowerCase().trim();
  const voiceDesc = (labels.descriptive || "").toLowerCase().trim();
  const voiceCat = (voice.category || "").toLowerCase().trim();
  const voiceName = (voice.name || "").toLowerCase().trim();

  // 1. Language matching & Multilingual Suitability (Critical for Español Latino)
  if (preset.id === "espanol_latino") {
    // Native Spanish signals
    if (voiceLang === "es") {
      score += 90;
    }
    if (voiceAccent === "latin american" || voiceAccent === "colombian") {
      score += 45;
    }

    // Multilingual Premade compatibility (eleven_multilingual_v2):
    // Neutral and calm premade voices are viable candidates for Spanish narration.
    if (voiceCat === "premade") {
      score += 25; // baseline premade stability bonus
      if (labels.gender === "neutral") {
        score += 30; // River (gender: neutral, calm)
      }
      if (voiceDesc === "calm" || voiceDesc === "professional" || voiceDesc === "mature" || voiceDesc === "warm") {
        score += 15;
      }
    }

    // Penalize strong non-Spanish regional English accents
    if (voiceAccent === "british" || voiceAccent === "australian") {
      score -= 20;
    }
    // Avoid Roger as the primary recommendation for Spanish
    if (voiceName.includes("roger")) {
      score -= 30;
    }
  }

  // 2. Use case matching
  if (preset.targetKeywords.useCases && voiceUseCase) {
    if (preset.targetKeywords.useCases.includes(voiceUseCase)) {
      score += 40;
    }
  }

  // 3. Descriptive label matching
  if (preset.targetKeywords.descriptive && voiceDesc) {
    if (preset.targetKeywords.descriptive.includes(voiceDesc)) {
      score += 30;
    }
  }

  // 4. Accent matching
  if (preset.targetKeywords.accents && voiceAccent) {
    if (preset.targetKeywords.accents.includes(voiceAccent)) {
      score += 25;
    }
  }

  // 5. Category matching
  if (preset.targetKeywords.category && voiceCat) {
    if (preset.targetKeywords.category.includes(voiceCat)) {
      score += 15;
    }
  }

  // 6. Name keyword matching
  if (preset.targetKeywords.nameKeywords) {
    for (const kw of preset.targetKeywords.nameKeywords) {
      if (voiceName.includes(kw.toLowerCase())) {
        score += 25;
        break; // Count once
      }
    }
  }

  // 7. General quality/readiness bonus
  if (voice.previewUrl) {
    score += 5; // Has sample audio
  }
  if (voice.category === "professional") {
    score += 5;
  }

  return score;
}

/**
 * Returns all available voices ranked deterministically for a given preset,
 * incorporating availability status: working (tier 2) > unknown (tier 1) > failed (tier 0).
 * Failed voices are strictly relegated to tier 0 and will never be recommended over working or unknown voices.
 */
export function rankVoicesForPreset(
  presetId: VoicePresetId,
  voices: GatewayVoice[],
  availabilityMap?: VoiceAvailabilityMap
): GatewayVoice[] {
  const preset = VOICE_PRESETS.find((p) => p.id === presetId) || VOICE_PRESETS[0];

  if (!voices || voices.length === 0) return [];

  const scored = voices.map((v) => {
    const availRecord = availabilityMap?.[v.voiceId];
    const status: VoiceAvailabilityStatus = availRecord?.status || "unknown";

    // Tier mapping: working = 2, unknown = 1, failed = 0
    let tier = 1;
    if (status === "working") tier = 2;
    else if (status === "failed") tier = 0;

    return {
      voice: v,
      score: scoreVoiceForPreset(v, preset),
      tier,
      status,
    };
  });

  scored.sort((a, b) => {
    // 1. Primary: Availability Tier: working (2) > unknown (1) > failed (0)
    if (b.tier !== a.tier) {
      return b.tier - a.tier;
    }
    // 2. Secondary: Suitability score descending
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 3. Tertiary: Has previewUrl
    const aHasPreview = Boolean(a.voice.previewUrl);
    const bHasPreview = Boolean(b.voice.previewUrl);
    if (aHasPreview !== bHasPreview) {
      return aHasPreview ? -1 : 1;
    }
    // 4. Quaternary deterministic fallback: Alphabetical by name
    return a.voice.name.localeCompare(b.voice.name);
  });

  return scored.map((s) => s.voice);
}

/**
 * Returns the best recommended voice for a preset considering current session availability.
 */
export function getRecommendedVoiceForPreset(
  presetId: VoicePresetId,
  voices: GatewayVoice[],
  availabilityMap?: VoiceAvailabilityMap
): GatewayVoice | undefined {
  const ranked = rankVoicesForPreset(presetId, voices, availabilityMap);
  return ranked[0];
}

/**
 * Returns a user-friendly description for ElevenLabs models based on real Gateway metadata.
 */
export function getModelDescription(modelId: string, availableDescription?: string): string {
  if (availableDescription && availableDescription.trim()) {
    return availableDescription.trim();
  }

  const map: Record<string, string> = {
    eleven_multilingual_v2: "Alta calidad y expresión para narración multilingüe.",
    eleven_flash_v2_5: "Menor latencia para generación rápida.",
    eleven_turbo_v2_5: "Alta calidad y velocidad balanceada para desarrollo en 32 idiomas.",
    eleven_v3_conversational: "Optimizado para diálogo natural en agentes conversacionales.",
    eleven_v4: "Generación avanzada de última generación en más de 90 idiomas.",
  };

  return map[modelId] || "Modelo de síntesis de voz ElevenLabs.";
}
