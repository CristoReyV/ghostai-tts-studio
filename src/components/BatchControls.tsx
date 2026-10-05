/**
 * @file src/components/BatchControls.tsx
 * Professional Voice Studio Control Bar:
 * - Visual Preset Buttons (preset click dynamically selects recommended voice)
 * - Large Visual Voice Card with active/recommended state distinction
 * - Voice Explorer Modal for manual voice discovery
 * - Streamlined Model and Output Format cards with collapsible advanced settings
 * - Global singleton audio player for sample preview without memory leaks
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  RotateCcw,
  Square,
  PackageCheck,
  Volume2,
  VolumeX,
  Sliders,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
  Mic,
  Search,
  X,
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
  // Global Audio Preview Singleton Player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // UI state
  const [appliedNotice, setAppliedNotice] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerFilter, setExplorerFilter] = useState<"all" | "es" | "en">("all");
  const [isModelAdvancedOpen, setIsModelAdvancedOpen] = useState(false);
  const [isFormatAdvancedOpen, setIsFormatAdvancedOpen] = useState(false);

  // Find models, voices and presets
  const selectedVoice = voices.find((v) => v.voiceId === selectedVoiceId);
  const selectedModel = models.find((m) => m.modelId === selectedModelId);
  const activePreset = VOICE_PRESETS.find((p) => p.id === selectedPresetId) || VOICE_PRESETS[0];

  // Recommended voice for active preset
  const recommendedVoiceForPreset = getRecommendedVoiceForPreset(selectedPresetId, voices, availabilityMap);

  // Distinguish recommended vs manual override
  const isManualOverride = Boolean(
    recommendedVoiceForPreset && selectedVoiceId && selectedVoiceId !== recommendedVoiceForPreset.voiceId
  );

  const selectedVoiceAvail = selectedVoiceId ? availabilityMap?.[selectedVoiceId] : undefined;
  const isSelectedVoiceFailed = selectedVoiceAvail?.status === "failed";
  const isSelectedVoiceWorking = selectedVoiceAvail?.status === "working";

  // Singleton Audio Player
  const handlePlayVoicePreview = (voiceId: string, previewUrl: string) => {
    if (!previewUrl) return;

    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      setPlayingVoiceId(voiceId);

      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      audio.play().catch(() => setPlayingVoiceId(null));
    } catch {
      setPlayingVoiceId(null);
    }
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Preset Click Handler: MUST update selectedPresetId AND selectedVoiceId to recommended voice
  const handlePresetClick = (presetId: VoicePresetId) => {
    onSelectPreset(presetId);
    const recVoice = getRecommendedVoiceForPreset(presetId, voices, availabilityMap);
    if (recVoice) {
      onSelectVoice(recVoice.voiceId);
    }
  };

  const handleApplyClick = () => {
    onApplyToPending();
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2000);
  };

  const formats = [
    { id: "mp3_44100_128", label: "MP3 44.1 kHz / 128 kbps", recommended: true },
    { id: "mp3_44100_192", label: "MP3 44.1 kHz / 192 kbps", recommended: false },
    { id: "pcm_44100", label: "PCM 44.1 kHz", recommended: false },
    { id: "pcm_24000", label: "PCM 24 kHz", recommended: false },
    { id: "mp3_22050_32", label: "MP3 22.05 kHz / 32 kbps", recommended: false },
  ];

  const currentFormatObj = formats.find((f) => f.id === selectedOutputFormat) || formats[0];

  // Filter voices for explorer modal
  const filteredExplorerVoices = useMemo(() => {
    let result = voices;
    if (explorerFilter === "es") {
      result = result.filter(
        (v) =>
          v.labels?.language === "es" ||
          v.labels?.accent?.toLowerCase().includes("colombian") ||
          v.labels?.accent?.toLowerCase().includes("latin")
      );
    } else if (explorerFilter === "en") {
      result = result.filter((v) => v.labels?.language === "en" || !v.labels?.language);
    }

    if (explorerSearch.trim()) {
      const q = explorerSearch.toLowerCase().trim();
      result = result.filter((v) => {
        const name = (v.name || "").toLowerCase();
        const accent = (v.labels?.accent || "").toLowerCase();
        const desc = (v.labels?.descriptive || "").toLowerCase();
        const useCase = (v.labels?.use_case || "").toLowerCase();
        return name.includes(q) || accent.includes(q) || desc.includes(q) || useCase.includes(q);
      });
    }

    return result;
  }, [voices, explorerSearch, explorerFilter]);

  return (
    <div className="batch-controls-card">
      {/* ── 1. TIPO DE VOZ (Visual Preset Cards Row) ── */}
      <div className="presets-block">
        <div className="block-header">
          <div className="flex items-center gap-2">
            <span className="block-title">TIPO DE VOZ</span>
            <span className="block-badge">{VOICE_PRESETS.length} presets</span>
          </div>
          <span className="block-subtitle">{activePreset.description}</span>
        </div>

        <div className="presets-scroll-container">
          <div className="presets-button-grid">
            {VOICE_PRESETS.map((preset) => {
              const isActive = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  disabled={isGenerating}
                  className={`preset-card-btn ${isActive ? "preset-card-active" : ""}`}
                  title={preset.description}
                >
                  <span className="preset-card-emoji">{preset.emoji}</span>
                  <span className="preset-card-name">{preset.name}</span>
                  {isActive && <Check size={14} className="preset-card-check" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 2. VOZ RECOMENDADA Y ACTIVA (Showcase Section) ── */}
      <div className="voice-showcase-block">
        {isManualOverride ? (
          /* Dual card presentation when user manually chose a different voice */
          <div className="dual-voice-layout">
            {/* Selected Manual Voice Card */}
            <div className="showcase-card active-card flex-1">
              <div className="card-top-bar">
                <span className="status-badge badge-manual">
                  <Sliders size={12} className="inline mr-1" /> Selección manual
                </span>
                <span className="status-badge badge-current">✓ Voz activa para generar</span>
              </div>

              <div className="card-main-content">
                <div className="voice-avatar-icon active-avatar">
                  <Mic size={24} className="text-accent" />
                </div>
                <div className="voice-details">
                  <div className="voice-title-row">
                    <h3 className="showcase-voice-name">{selectedVoice?.name || "Voz seleccionada"}</h3>
                    {selectedVoice?.previewUrl && (
                      <button
                        type="button"
                        onClick={() => handlePlayVoicePreview(selectedVoice.voiceId, selectedVoice.previewUrl!)}
                        className={`btn-preview-circle ${playingVoiceId === selectedVoice.voiceId ? "playing" : ""}`}
                        title="Escuchar muestra"
                      >
                        {playingVoiceId === selectedVoice.voiceId ? (
                          <VolumeX size={15} className="text-accent animate-pulse" />
                        ) : (
                          <Volume2 size={15} />
                        )}
                        <span>{playingVoiceId === selectedVoice.voiceId ? "Detener" : "Escuchar"}</span>
                      </button>
                    )}
                  </div>
                  <div className="voice-tags-row">
                    <span className="tag-pill tag-accent-pill">
                      {selectedVoice?.labels?.accent || "Acento estándar"} · {selectedVoice?.labels?.language?.toUpperCase() || "EN"}
                    </span>
                    {selectedVoice?.labels?.descriptive && (
                      <span className="tag-pill">{selectedVoice.labels.descriptive}</span>
                    )}
                    {isSelectedVoiceFailed && (
                      <span className="tag-pill tag-danger">⚠️ No disponible actualmente</span>
                    )}
                    {isSelectedVoiceWorking && (
                      <span className="tag-pill tag-success">✓ Verificada</span>
                    )}
                  </div>
                </div>
              </div>

              {recommendedVoiceForPreset && (
                <div className="card-footer-action">
                  <button
                    type="button"
                    onClick={() => onSelectVoice(recommendedVoiceForPreset.voiceId)}
                    className="btn-link-action"
                  >
                    ↺ Volver a la voz recomendada: <strong>{recommendedVoiceForPreset.name}</strong>
                  </button>
                </div>
              )}
            </div>

            {/* Recommended Voice for current preset */}
            {recommendedVoiceForPreset && (
              <div className="showcase-card ghost-card flex-1">
                <div className="card-top-bar">
                  <span className="status-badge badge-recommended">
                    <Sparkles size={12} className="inline mr-1 text-accent" /> Recomendada por preset: {activePreset.name}
                  </span>
                </div>

                <div className="card-main-content">
                  <div className="voice-avatar-icon">
                    <Mic size={24} className="text-dim" />
                  </div>
                  <div className="voice-details">
                    <div className="voice-title-row">
                      <h3 className="showcase-voice-name">{recommendedVoiceForPreset.name}</h3>
                      {recommendedVoiceForPreset.previewUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            handlePlayVoicePreview(recommendedVoiceForPreset.voiceId, recommendedVoiceForPreset.previewUrl!)
                          }
                          className={`btn-preview-circle ${playingVoiceId === recommendedVoiceForPreset.voiceId ? "playing" : ""}`}
                          title="Escuchar muestra recomendada"
                        >
                          {playingVoiceId === recommendedVoiceForPreset.voiceId ? (
                            <VolumeX size={15} className="text-accent animate-pulse" />
                          ) : (
                            <Volume2 size={15} />
                          )}
                          <span>{playingVoiceId === recommendedVoiceForPreset.voiceId ? "Detener" : "Escuchar"}</span>
                        </button>
                      )}
                    </div>
                    <div className="voice-tags-row">
                      <span className="tag-pill">
                        {recommendedVoiceForPreset.labels?.accent || "Acento estándar"} ·{" "}
                        {recommendedVoiceForPreset.labels?.language?.toUpperCase() || "EN"}
                      </span>
                      {recommendedVoiceForPreset.labels?.descriptive && (
                        <span className="tag-pill">{recommendedVoiceForPreset.labels.descriptive}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-footer-action">
                  <button
                    type="button"
                    onClick={() => onSelectVoice(recommendedVoiceForPreset.voiceId)}
                    className="btn-select-recommended-btn"
                  >
                    Usar voz recomendada
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Recommended Voice matches Selected Voice */
          <div className="showcase-card active-card single-showcase">
            <div className="card-top-bar">
              <div className="flex items-center gap-2">
                <span className="status-badge badge-recommended">
                  <Sparkles size={12} className="inline mr-1 text-accent" />
                  {selectedPresetId === "espanol_latino" ? "Voz recomendada para español" : "Voz recomendada"}
                </span>
                <span className="status-badge badge-current">✓ Seleccionada y activa</span>
              </div>
              <span className="preset-pill-tag">
                {activePreset.emoji} {activePreset.name}
              </span>
            </div>

            <div className="card-main-content">
              <div className="voice-avatar-icon active-avatar">
                <Mic size={26} className="text-accent" />
              </div>
              <div className="voice-details">
                <div className="voice-title-row">
                  <h3 className="showcase-voice-name text-xl">
                    {selectedVoice?.name || "Cargando voces del Gateway..."}
                  </h3>
                  {selectedVoice?.previewUrl && (
                    <button
                      type="button"
                      onClick={() => handlePlayVoicePreview(selectedVoice.voiceId, selectedVoice.previewUrl!)}
                      className={`btn-preview-circle ${playingVoiceId === selectedVoice.voiceId ? "playing" : ""}`}
                      title="Escuchar muestra"
                    >
                      {playingVoiceId === selectedVoice.voiceId ? (
                        <VolumeX size={15} className="text-accent animate-pulse" />
                      ) : (
                        <Volume2 size={15} />
                      )}
                      <span>{playingVoiceId === selectedVoice.voiceId ? "Detener muestra" : "Escuchar muestra"}</span>
                    </button>
                  )}
                </div>

                <div className="voice-tags-row">
                  <span className="tag-pill tag-accent-pill">
                    {selectedVoice?.labels?.accent || "Acento estándar"} · {selectedVoice?.labels?.language?.toUpperCase() || "EN"}
                  </span>
                  {selectedVoice?.labels?.descriptive && (
                    <span className="tag-pill">{selectedVoice.labels.descriptive}</span>
                  )}
                  {selectedVoice?.labels?.use_case && (
                    <span className="tag-pill">{selectedVoice.labels.use_case}</span>
                  )}
                  {isSelectedVoiceFailed && (
                    <span className="tag-pill tag-danger">⚠️ No disponible actualmente</span>
                  )}
                  {isSelectedVoiceWorking && (
                    <span className="tag-pill tag-success">✓ Verificada en esta sesión</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Explore All Voices Button */}
        <div className="explore-all-row">
          <button
            type="button"
            onClick={() => setIsExplorerOpen(true)}
            disabled={isGenerating || voices.length === 0}
            className="btn-explore-catalog"
          >
            <Search size={15} className="mr-2" />
            <span>EXPLORAR TODAS LAS VOCES ({voices.length})</span>
          </button>
        </div>
      </div>

      {/* ── 3. MODELO TTS & FORMATO DE SALIDA (Two Cards with Accordion) ── */}
      <div className="tech-config-row">
        {/* Model Card */}
        <div className="tech-box">
          <div className="tech-box-header">
            <span className="tech-label">MODELO TTS</span>
          </div>
          <div className="tech-box-body">
            <h4 className="tech-title">{selectedModel?.name || "Eleven Multilingual v2"}</h4>
            <p className="tech-desc">
              {selectedModelId === "eleven_multilingual_v2"
                ? "Recomendado para narraciones multilingües y español."
                : getModelDescription(selectedModelId, selectedModel?.description)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModelAdvancedOpen(!isModelAdvancedOpen)}
            className="btn-tech-toggle"
          >
            <Settings size={13} className="mr-1" />
            <span>Configuración avanzada</span>
            {isModelAdvancedOpen ? <ChevronUp size={13} className="ml-1" /> : <ChevronDown size={13} className="ml-1" />}
          </button>

          {isModelAdvancedOpen && (
            <div className="tech-accordion-body animate-slide-down">
              <label className="field-subhead">MODELOS ALTERNATIVOS DISPONIBLES</label>
              <select
                value={selectedModelId}
                onChange={(e) => onSelectModel(e.target.value)}
                disabled={isGenerating}
                className="select-input"
              >
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Output Format Card */}
        <div className="tech-box">
          <div className="tech-box-header">
            <span className="tech-label">FORMATO DE SALIDA</span>
            <span className="tag-rec-mini">✓ RECOMENDADO</span>
          </div>
          <div className="tech-box-body">
            <h4 className="tech-title">
              {selectedOutputFormat === "mp3_44100_128" ? "MP3 · 44.1 kHz · 128 kbps" : currentFormatObj.label}
            </h4>
            <p className="tech-desc">
              Balance óptimo de fidelidad acústica y ligereza de archivo para GhostAI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormatAdvancedOpen(!isFormatAdvancedOpen)}
            className="btn-tech-toggle"
          >
            <Settings size={13} className="mr-1" />
            <span>Configuración avanzada</span>
            {isFormatAdvancedOpen ? <ChevronUp size={13} className="ml-1" /> : <ChevronDown size={13} className="ml-1" />}
          </button>

          {isFormatAdvancedOpen && (
            <div className="tech-accordion-body animate-slide-down">
              <label className="field-subhead">FORMATOS DE AUDIO COMPATIBLES</label>
              <select
                value={selectedOutputFormat}
                onChange={(e) => onSelectOutputFormat(e.target.value)}
                disabled={isGenerating}
                className="select-input"
              >
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} {f.recommended ? "(Recomendado)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. ACTION BUTTONS ROW ── */}
      <div className="controls-actions-row">
        <div className="actions-left">
          {/* Apply to Pending */}
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={isGenerating || totalCount === 0}
            className="btn-secondary"
            title="Aplica la voz y modelo actual a todas las narraciones pendientes"
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

      {/* ── 5. VOICE EXPLORER MODAL (Visual Card Grid) ── */}
      {isExplorerOpen && (
        <div className="explorer-modal-backdrop" onClick={() => setIsExplorerOpen(false)}>
          <div className="explorer-modal-dialog animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="explorer-dialog-header">
              <div>
                <h3 className="explorer-dialog-title">Catálogo Completo de Voces</h3>
                <p className="explorer-dialog-desc">
                  Selecciona manualmente cualquier voz de ElevenLabs disponible en tu cuenta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExplorerOpen(false)}
                className="btn-dialog-close"
                title="Cerrar catálogo"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="explorer-toolbar">
              <div className="explorer-search-field">
                <Search size={15} className="search-field-icon" />
                <input
                  type="text"
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  placeholder="Buscar voz por nombre, acento o estilo..."
                  className="search-field-input"
                  autoFocus
                />
                {explorerSearch && (
                  <button
                    type="button"
                    onClick={() => setExplorerSearch("")}
                    className="btn-clear-search-input"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="explorer-filter-pills">
                <button
                  type="button"
                  onClick={() => setExplorerFilter("all")}
                  className={`pill-btn ${explorerFilter === "all" ? "pill-btn-active" : ""}`}
                >
                  Todas ({voices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExplorerFilter("es")}
                  className={`pill-btn ${explorerFilter === "es" ? "pill-btn-active" : ""}`}
                >
                  Español / Latino
                </button>
                <button
                  type="button"
                  onClick={() => setExplorerFilter("en")}
                  className={`pill-btn ${explorerFilter === "en" ? "pill-btn-active" : ""}`}
                >
                  Multilingüe / EN
                </button>
              </div>
            </div>

            {/* Voices Grid */}
            <div className="explorer-cards-container">
              {filteredExplorerVoices.length === 0 ? (
                <div className="explorer-empty-notice">
                  <p>No se encontraron voces que coincidan con la búsqueda.</p>
                </div>
              ) : (
                <div className="explorer-voice-grid">
                  {filteredExplorerVoices.map((voice) => {
                    const isSelected = voice.voiceId === selectedVoiceId;
                    const isRecommended = recommendedVoiceForPreset?.voiceId === voice.voiceId;
                    const avail = availabilityMap?.[voice.voiceId];
                    const isFailed = avail?.status === "failed";
                    const isWorking = avail?.status === "working";

                    return (
                      <div
                        key={voice.voiceId}
                        onClick={() => {
                          onSelectVoice(voice.voiceId);
                          setIsExplorerOpen(false);
                        }}
                        className={`explorer-voice-card ${isSelected ? "card-selected" : ""} ${isFailed ? "card-failed" : ""}`}
                      >
                        <div className="card-top">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (voice.previewUrl) {
                                handlePlayVoicePreview(voice.voiceId, voice.previewUrl);
                              }
                            }}
                            disabled={!voice.previewUrl}
                            className={`btn-card-audio ${playingVoiceId === voice.voiceId ? "playing" : ""}`}
                            title={voice.previewUrl ? "Escuchar muestra" : "Sin muestra disponible"}
                          >
                            {playingVoiceId === voice.voiceId ? (
                              <VolumeX size={14} className="text-accent animate-pulse" />
                            ) : (
                              <Volume2 size={14} />
                            )}
                          </button>

                          <div className="card-headings">
                            <h4 className="card-voice-name">{voice.name}</h4>
                            <span className="card-voice-meta">
                              {voice.labels?.language?.toUpperCase() || "EN"} · {voice.labels?.accent || "Standard"}
                            </span>
                          </div>
                        </div>

                        <div className="card-badges-bottom">
                          {isRecommended && (
                            <span className="badge-tag-rec">RECOMENDADA</span>
                          )}
                          {isSelected && (
                            <span className="badge-tag-sel">✓ SELECCIONADA</span>
                          )}
                          {isFailed && (
                            <span className="badge-tag-fail">⚠️ No disponible</span>
                          )}
                          {isWorking && (
                            <span className="badge-tag-work">✓ Verificada</span>
                          )}
                          {voice.labels?.descriptive && (
                            <span className="badge-tag-desc">{voice.labels.descriptive}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
