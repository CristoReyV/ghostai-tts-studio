/**
 * @file src/types/tts.ts
 * Type definitions for GhostAI TTS Studio
 */

export interface GhostAiVoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
}

export interface GhostAiTtsItem {
  id: string; // stable narration id (canonical)
  narrationId?: string; // fallback alias supported from Flow/GhostAI
  sceneId: string; // GhostAI scene id
  sceneIndex: number;
  text: string;
  voiceId?: string;
  modelId?: string;
  language?: string;
  speed?: number;
  voiceSettings?: GhostAiVoiceSettings;
  outputFormat?: string;
  // Preserves any additional custom metadata
  [key: string]: unknown;
}

export interface GhostAiTtsProject {
  name: string;
  exportedAt: string;
  [key: string]: unknown;
}

export interface GhostAiTtsFile {
  format: "ghostai-tts";
  version: string;
  project: GhostAiTtsProject;
  items: GhostAiTtsItem[];
  [key: string]: unknown;
}

export type NarrationStatus = "PENDING" | "GENERATING" | "READY" | "ERROR" | "CANCELLED";

export interface StudioNarrationItem extends GhostAiTtsItem {
  status: NarrationStatus;
  duration?: number; // duration in seconds
  requestId?: string;
  error?: string;
  audioBlob?: Blob;
  audioUrl?: string; // stable URL.createObjectURL
  responseBytes?: number;
}

export interface GatewayVoice {
  voiceId: string;
  name: string;
  category: string | null;
  labels: Record<string, string>;
  previewUrl: string | null;
}

export interface GatewayModel {
  modelId: string;
  name: string;
  description: string;
  languages: { code: string; name: string }[];
  supportsStyle: boolean;
  supportsSpeakerBoost: boolean;
}

export interface OutputPackageItem {
  id: string;
  sceneId: string;
  sceneIndex: number;
  file: string;
  voiceId: string;
  modelId: string;
  duration: number;
  requestId: string;
  [key: string]: unknown;
}

export interface OutputPackageManifest {
  format: "ghostai-tts";
  version: "1.0";
  project: GhostAiTtsProject;
  generatedWith: {
    provider: string;
    gateway: string;
  };
  items: OutputPackageItem[];
}

export interface GatewayHealth {
  ok: boolean;
  service: string;
  version: string;
  provider: string;
  configured: boolean;
}

export interface VoiceLibraryVoice {
  voiceId: string;
  publicOwnerId: string | null;
  name: string;
  language: string | null;
  locale: string | null;
  accent: string | null;
  gender: string | null;
  age: string | null;
  useCase: string | null;
  descriptive: string | null;
  description: string | null;
  category: string | null;
  previewUrl: string | null;
  clonedByCount: number;
  usageCharacterCount1y: number;
  featured: boolean;
  freeUsersAllowed: boolean;
  liveModerationEnabled: boolean;
  noticePeriod: number | null;
  rate: number | null;
  verifiedLanguages: { language: string; modelId: string }[];
}

export interface VoiceLibraryResponse {
  voices: VoiceLibraryVoice[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount: number;
}

export interface VoiceLibraryQueryParams {
  language?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  accent?: string;
  locale?: string;
  gender?: string;
  age?: string;
  useCases?: string;
  sort?: string;
}

export interface AddSharedVoiceRequest {
  voiceId: string;
  publicOwnerId: string;
  name: string;
}

export interface AddSharedVoiceResponse {
  ok: boolean;
  voiceId: string;
  name?: string;
  category?: string;
  [key: string]: unknown;
}
