/**
 * @file src/components/BatchControls.tsx
 * Control bar for global voice/model configuration, sequential batch generation,
 * cancellation, retry and ZIP package export.
 */

import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  Square,
  PackageCheck,
  Volume2,
  Sliders,
  Check,
} from "lucide-react";
import type { GatewayModel, GatewayVoice } from "../types/tts";

interface BatchControlsProps {
  voices: GatewayVoice[];
  models: GatewayModel[];
  selectedVoiceId: string;
  selectedModelId: string;
  selectedOutputFormat: string;
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

  const selectedVoice = voices.find((v) => v.voiceId === selectedVoiceId);

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

  const handleApplyClick = () => {
    onApplyToPending();
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2000);
  };

  const formats = [
    { id: "mp3_44100_128", label: "MP3 44.1kHz 128kbps (Recomendado)" },
    { id: "mp3_44100_192", label: "MP3 44.1kHz 192kbps (Alta Calidad)" },
    { id: "mp3_22050_32", label: "MP3 22kHz 32kbps (Ligero)" },
    { id: "pcm_24000", label: "PCM WAV 24kHz (Sin compresión)" },
    { id: "pcm_44100", label: "PCM WAV 44.1kHz (Estudio)" },
  ];

  return (
    <div className="batch-controls-card">
      {/* Configuration bar */}
      <div className="controls-settings-row">
        {/* Voice Selector */}
        <div className="form-group flex-1">
          <label className="field-label">
            <span>Voz de ElevenLabs</span>
            {selectedVoice?.previewUrl && (
              <button
                type="button"
                onClick={handlePlayVoicePreview}
                className="btn-link-preview"
                title="Escuchar muestra de voz"
              >
                <Volume2 size={12} className={isPlayingVoicePreview ? "text-accent animate-pulse" : ""} />
                <span>{isPlayingVoicePreview ? "Detener" : "Escuchar"}</span>
              </button>
            )}
          </label>
          <select
            value={selectedVoiceId}
            onChange={(e) => onSelectVoice(e.target.value)}
            disabled={isGenerating}
            className="select-input"
          >
            {voices.length === 0 ? (
              <option value="">Cargando voces del Gateway...</option>
            ) : (
              voices.map((v) => (
                <option key={v.voiceId} value={v.voiceId}>
                  {v.name} {v.category ? `(${v.category})` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Model Selector */}
        <div className="form-group flex-1">
          <label className="field-label">
            <span>Modelo TTS</span>
          </label>
          <select
            value={selectedModelId}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isGenerating}
            className="select-input"
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
        </div>

        {/* Output Format */}
        <div className="form-group flex-1">
          <label className="field-label">Formato de Salida</label>
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
        </div>

        {/* Apply to Pending */}
        <div className="form-group flex-initial justify-end">
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={isGenerating}
            className="btn-secondary h-input"
            title="Aplica la voz y modelo actual a todas las narraciones pendientes"
          >
            {appliedNotice ? <Check size={14} className="text-emerald mr-1" /> : <Sliders size={14} className="mr-1" />}
            <span>{appliedNotice ? "¡Aplicado!" : "Aplicar a Pendientes"}</span>
          </button>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="controls-actions-row">
        <div className="actions-left">
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
