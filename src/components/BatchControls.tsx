/**
 * @file src/components/BatchControls.tsx
 * Redesigned Voice & Format Selector with High-Level Voice Presets,
 * Dynamic Metadata Matching, Streamlined Default Format, and Collapsible Advanced Config.
 */

import React, { useState, useEffect } from "react";
import {
  Play,
  RotateCcw,
  Square,
  PackageCheck,
  Volume2,
  Sliders,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
} from "lucide-react";
import type { GatewayModel, GatewayVoice } from "../types/tts";
import {
  VOICE_PRESETS,
  type VoicePresetId,
  type VoiceAvailabilityMap,
  getRecommendedVoiceForPreset,
  getModelDescription,
} from "../services/voicePresets";

interface BatchControlsProps {
  voices: GatewayVoice[];
  models: GatewayModel[];
  selectedVoiceId: string;
  selectedModelId: string;
  selectedOutputFormat: string;
  selectedPresetId: VoicePresetId;
  availabilityMap?: VoiceAvailabilityMap;
  onSelectPreset: (presetId: VoicePresetId) => void;
  onSelectVoice: (voiceId: string) => void;
  onSelectModel: (modelId: string) => void;
  onSelectOutputFormat: (format: string) => void;
  onApplyToPending: () => void;
  isGenerating: boolean;
  onGenerateAll: () => void;
  onCancelGeneration: () => void;
  onRetryFailed: () => void;
  onExportZip: () => void;
  hasErrors: boolean;
  hasReadyItems: boolean;
  readyCount: number;
  totalCount: number;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  voices,
  models,
  selectedVoiceId,
  selectedModelId,
  selectedOutputFormat,
  selectedPresetId,
  availabilityMap,
  onSelectPreset,
  onSelectVoice,
  onSelectModel,
  onSelectOutputFormat,
  onApplyToPending,
  isGenerating,
  onGenerateAll,
  onCancelGeneration,
  onRetryFailed,
  onExportZip,
  hasErrors,
  hasReadyItems,
  readyCount,
  totalCount,
}) => {
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingVoicePreview, setIsPlayingVoicePreview] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const selectedVoice = voices.find((v) => v.voiceId === selectedVoiceId);
  const selectedModel = models.find((m) => m.modelId === selectedModelId);
  const activePreset = VOICE_PRESETS.find((p) => p.id === selectedPresetId) || VOICE_PRESETS[0];

  // Determine if current voice is a manual override or matches the preset recommendation
  const recommendedVoiceForPreset = getRecommendedVoiceForPreset(selectedPresetId, voices, availabilityMap);
  const isManualOverride = Boolean(
    recommendedVoiceForPreset && selectedVoiceId && selectedVoiceId !== recommendedVoiceForPreset.voiceId
  );

  const recommendedBadgeText =
    selectedPresetId === "espanol_latino" ? "Voz recomendada para español" : "Recomendada";

  const selectedVoiceAvail = selectedVoiceId ? availabilityMap?.[selectedVoiceId] : undefined;
  const isSelectedVoiceFailed = selectedVoiceAvail?.status === "failed";
  const isSelectedVoiceWorking = selectedVoiceAvail?.status === "working";

  // Handle Voice Preview
  const handlePlayVoicePreview = () => {
    if (!selectedVoice?.previewUrl) return;

    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      if (isPlayingVoicePreview) {
        setIsPlayingVoicePreview(false);
        return;
      }
    }

    const audio = new Audio(selectedVoice.previewUrl);
    setPreviewAudio(audio);
    setIsPlayingVoicePreview(true);

    audio.onended = () => setIsPlayingVoicePreview(false);
    audio.onerror = () => setIsPlayingVoicePreview(false);
    audio.play().catch(() => setIsPlayingVoicePreview(false));
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
      }
    };
  }, [previewAudio]);

  const handleApplyClick = () => {
    onApplyToPending();
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2000);
  };

  const handlePresetChange = (presetId: VoicePresetId) => {
    onSelectPreset(presetId);
    const bestVoice = getRecommendedVoiceForPreset(presetId, voices, availabilityMap);
    if (bestVoice) {
      onSelectVoice(bestVoice.voiceId);
    }
  };

  const formats = [
    { id: "mp3_44100_128", label: "MP3 44.1 kHz / 128 kbps", recommended: true },
    { id: "mp3_44100_192", label: "MP3 44.1 kHz / 192 kbps", recommended: false },
    { id: "pcm_44100", label: "PCM 44.1 kHz", recommended: false },
    { id: "pcm_24000", label: "PCM 24 kHz", recommended: false },
    { id: "mp3_22050_32", label: "MP3 22.05 kHz / 32 kbps", recommended: false },
  ];

  const currentFormatObj = formats.find((f) => f.id === selectedOutputFormat) || formats[0];

  return (
    <div className="batch-controls-card">
      {/* ── Main Voice & Preset Selector (Clean, 3 primary cards) ── */}
      <div className="controls-grid">
        {/* 1. Estilo de Voz (Presets) */}
        <div className="control-box flex-1">
          <div className="control-box-header">
            <span className="control-box-label">ESTILO DE VOZ</span>
            <span className="preset-count-tag">{VOICE_PRESETS.length} presets</span>
          </div>

          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value as VoicePresetId)}
            disabled={isGenerating}
            className="select-input preset-select"
          >
            {VOICE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>

          <p className="control-box-description">{activePreset.description}</p>
        </div>

        {/* 2. Voz Seleccionada */}
        <div className="control-box flex-1">
          <div className="control-box-header">
            <div className="flex items-center gap-1.5">
              <span className="control-box-label">VOZ</span>
              {isManualOverride ? (
                <span className="badge-manual-override" title="Voz personalizada manualmente por el usuario">
                  Selección manual
                </span>
              ) : (
                <span className="badge-recommended-voice" title="Voz recomendada automáticamente para este preset">
                  <Sparkles size={10} className="mr-0.5 inline" /> {recommendedBadgeText}
                </span>
              )}
            </div>

            {selectedVoice?.previewUrl && (
              <button
                type="button"
                onClick={handlePlayVoicePreview}
                className="btn-link-preview"
                title="Escuchar muestra de voz"
              >
                <Volume2 size={13} className={isPlayingVoicePreview ? "text-accent animate-pulse" : ""} />
                <span>{isPlayingVoicePreview ? "Detener" : "Escuchar muestra"}</span>
              </button>
            )}
          </div>

          <select
            value={selectedVoiceId}
            onChange={(e) => onSelectVoice(e.target.value)}
            disabled={isGenerating}
            className="select-input voice-select"
          >
            {voices.length === 0 ? (
              <option value="">Cargando voces del Gateway...</option>
            ) : (
              voices.map((v) => {
                const avail = availabilityMap?.[v.voiceId];
                const isFailed = avail?.status === "failed";
                const isWorking = avail?.status === "working";
                const langLabel = v.labels?.language ? `[${v.labels.language.toUpperCase()}]` : "";
                const accentLabel = v.labels?.accent ? `· ${v.labels.accent}` : "";
                const statusTag = isFailed
                  ? " · [No disponible]"
                  : isWorking
                  ? " · ✓"
                  : "";
                return (
                  <option key={v.voiceId} value={v.voiceId}>
                    {v.name} {langLabel} {accentLabel} {statusTag}
                  </option>
                );
              })
            )}
          </select>

          <p className="control-box-description voice-meta-desc">
            {selectedVoice ? (
              <>
                {selectedVoice.labels?.gender && <span className="meta-pill">{selectedVoice.labels.gender}</span>}
                {selectedVoice.labels?.age && <span className="meta-pill">{selectedVoice.labels.age}</span>}
                {selectedVoice.labels?.accent && <span className="meta-pill">{selectedVoice.labels.accent}</span>}
                {selectedVoice.labels?.descriptive && (
                  <span className="meta-pill text-accent">{selectedVoice.labels.descriptive}</span>
                )}
                {isSelectedVoiceFailed && (
                  <span className="meta-pill text-rose border-rose" title={selectedVoiceAvail?.lastError || "No disponible actualmente"}>
                    ⚠️ No disponible actualmente
                  </span>
                )}
                {isSelectedVoiceWorking && (
                  <span className="meta-pill text-emerald border-emerald" title="Verificada en esta sesión">
                    ✓ Verificada
                  </span>
                )}
              </>
            ) : (
              "Selecciona una voz para la síntesis"
            )}
          </p>
        </div>

        {/* 3. Modelo TTS */}
        <div className="control-box flex-1">
          <div className="control-box-header">
            <span className="control-box-label">MODELO TTS</span>
          </div>

          <select
            value={selectedModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isGenerating}
            className="select-input model-select"
          >
            {models.length === 0 ? (
              <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
            ) : (
              models.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.name}
                </option>
              ))
            )}
          </select>

          <p className="control-box-description model-desc">
            {getModelDescription(selectedModelId, selectedModel?.description)}
          </p>
        </div>
      </div>

      {/* ── Formato de Salida & Configuración Avanzada ── */}
      <div className="format-advanced-bar">
        <div className="format-display-card">
          <div className="format-info-left">
            <span className="format-title-label">FORMATO DE SALIDA</span>
            <div className="format-badge-row">
              <span className="format-badge-value">
                {selectedOutputFormat === "mp3_44100_128" ? "MP3 · 44.1 kHz · 128 kbps" : currentFormatObj.label}
              </span>
              {selectedOutputFormat === "mp3_44100_128" && (
                <span className="badge-recommended-pill">RECOMENDADO</span>
              )}
            </div>
          </div>

          <div className="format-info-right">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="btn-toggle-advanced"
              title="Abrir u ocultar configuración avanzada de formato"
            >
              <Settings size={14} className="mr-1.5" />
              <span>CONFIGURACIÓN AVANZADA</span>
              {isAdvancedOpen ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Panel */}
        {isAdvancedOpen && (
          <div className="advanced-collapsible-panel animate-slide-down">
            <div className="advanced-grid">
              <div className="form-group flex-1">
                <label className="field-label">FORMATO DE AUDIO</label>
                <select
                  value={selectedOutputFormat}
                  onChange={(e) => onSelectOutputFormat(e.target.value)}
                  disabled={isGenerating}
                  className="select-input"
                >
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <span className="advanced-hint">
                  El formato estándar MP3 44.1kHz 128kbps es el recomendado por GhostAI Studio para balance óptimo de
                  calidad y peso de archivo.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons row ── */}
      <div className="controls-actions-row">
        <div className="actions-left">
          {/* Apply to Pending */}
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={isGenerating || totalCount === 0}
            className="btn-secondary"
            title="Aplica el estilo, voz y modelo actual a todas las narraciones pendientes"
          >
            {appliedNotice ? <Check size={14} className="text-emerald mr-1" /> : <Sliders size={14} className="mr-1" />}
            <span>{appliedNotice ? "¡Aplicado a Pendientes!" : "Aplicar a Pendientes"}</span>
          </button>

          {/* Generate All */}
          <button
            type="button"
            onClick={onGenerateAll}
            disabled={isGenerating || totalCount === 0}
            className="btn-primary"
            title="Genera secuencialmente todas las narraciones pendientes"
          >
            <Play size={16} className="mr-2" />
            <span>Generar Todo ({totalCount - readyCount} restantes)</span>
          </button>

          {/* Retry Failed */}
          {hasErrors && (
            <button
              type="button"
              onClick={onRetryFailed}
              disabled={isGenerating}
              className="btn-warning"
              title="Reintenta únicamente las narraciones que fallaron"
            >
              <RotateCcw size={15} className="mr-1.5" />
              <span>Reintentar Fallidos</span>
            </button>
          )}

          {/* Cancel */}
          {isGenerating && (
            <button
              type="button"
              onClick={onCancelGeneration}
              className="btn-danger"
              title="Cancela la secuencia de generación activa"
            >
              <Square size={15} className="mr-1.5" />
              <span>Cancelar Generación</span>
            </button>
          )}
        </div>

        <div className="actions-right">
          {/* Download Package Zip */}
          <button
            type="button"
            onClick={onExportZip}
            disabled={!hasReadyItems || isGenerating}
            className="btn-export"
            title="Descarga el archivo .ghostai-tts-package.zip compatible con GhostAI"
          >
            <PackageCheck size={16} className="mr-2" />
            <span>
              Descargar Paquete GhostAI ({readyCount}/{totalCount})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
