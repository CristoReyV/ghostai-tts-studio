/**
 * @file src/sampleData.ts
 * Example .ghostai-tts.json package for 1-click testing and demonstration.
 */

import type { GhostAiTtsFile } from "./types/tts";

export const SAMPLE_GHOSTAI_PROJECT: GhostAiTtsFile = {
  format: "ghostai-tts",
  version: "1.0",
  project: {
    name: "Lia y el Faro Encantado",
    exportedAt: new Date().toISOString(),
    author: "GhostAI Studio",
    language: "es",
  },
  items: [
    {
      id: "narr_scene1_001",
      sceneId: "scene_cliff_arrival",
      sceneIndex: 1,
      text: "La noche caía sobre los acantilados de piedra gris, y a lo lejos, la silueta del viejo faro comenzaba a despertar.",
      voiceId: "CwhRBWXzGAHq8TQ4Fs17", // Roger
      modelId: "eleven_multilingual_v2",
      language: "es",
      speed: 1,
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: true,
      },
      outputFormat: "mp3_44100_128",
    },
    {
      id: "narr_scene2_002",
      sceneId: "scene_lantern_room",
      sceneIndex: 2,
      text: "Lía subió cada uno de los escalones de hierro en espiral. El viento silbaba entre los cristales rotos de la torre.",
      voiceId: "CwhRBWXzGAHq8TQ4Fs17",
      modelId: "eleven_multilingual_v2",
      language: "es",
      speed: 1,
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: true,
      },
      outputFormat: "mp3_44100_128",
    },
    {
      id: "narr_scene3_003",
      sceneId: "scene_light_awakens",
      sceneIndex: 3,
      text: "Al tocar la lente de Fresnel, un resplandor dorado iluminó todo el océano, revelando senderos invisibles sobre el agua.",
      voiceId: "CwhRBWXzGAHq8TQ4Fs17",
      modelId: "eleven_multilingual_v2",
      language: "es",
      speed: 1,
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: true,
      },
      outputFormat: "mp3_44100_128",
    },
  ],
};
