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

export type VoiceOrigin = "default" | "premade" | "shared_library" | "library_copy" | "personal" | "workspace" | "owned" | "unknown";

export interface GatewayVoice {
  voiceId: string;
  name: string;
  category: string | null;
  labels: Record<string, string>;
  previewUrl: string | null;
  availableForTiers?: string[] | null;
  isOwner?: boolean | null;
  voiceOrigin?: VoiceOrigin;
  sharedLibraryOrigin?: boolean;
  libraryAllowsFreeUsers?: boolean | null;
  publicOwnerId?: string | null;
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
  libraryAllowsFreeUsers?: boolean;
  freeUsersAllowed: boolean;
  voiceOrigin?: VoiceOrigin;
  sharedLibraryOrigin?: boolean;
  isBookmarked?: boolean;
  isAddedByUser?: boolean;
  availableForTiers?: string[] | null;
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

// ── Control Plane 01: Download State Machine ────────────────────────────────
export type ZipDownloadStatus =
  | "not_prepared"
  | "prepared"
  | "download_triggered"
  | "verification_pending"
  | "verified"
  | "failed";

// ── Control Plane 01: Temporary Recovery Vault ─────────────────────────────
export interface RecoverySessionSummary {
  id: string;
  projectId?: string | null;
  projectTitle?: string | null;
  status: string;
  itemCount: number;
  readyCount: number;
  errorCount: number;
  zipStatus: string;
  createdAt: string;
  expiresAt: string;
}

export interface RecoveryItem {
  id: string;
  narrationId: string;
  sceneId: string | null;
  sceneIndex: number | null;
  status: string;
  hasAudio: boolean;
  sha256?: string | null;
  sizeBytes?: number | null;
  mimeType?: string;
  voiceId?: string | null;
  modelId?: string | null;
  outputFormat?: string | null;
  durationSeconds?: number | null;
  text?: string | null;
}

// ── Control Plane 01: ZIP Verifier ─────────────────────────────────────────
export interface ZipVerificationResult {
  ok: boolean;
  error?: string;
  errorCode?: string;
  details?: {
    format: string;
    version: string;
    fileName: string;
    totalItems: number;
    verifiedItems: number;
    packageSha256: string;
    itemHashesMatch?: boolean;
  };
}

