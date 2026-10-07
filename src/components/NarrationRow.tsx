/**
 * @file src/components/NarrationRow.tsx
 * Individual narration row with full metadata, status badge, individual generate/retry,
 * and stable audio preview player.
 */

import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { GatewayModel, GatewayVoice, StudioNarrationItem } from "../types/tts";
import { AudioPlayer } from "./AudioPlayer";

interface NarrationRowProps {
  item: StudioNarrationItem;
  index: number;
  voices: GatewayVoice[];
  models: GatewayModel[];
  isGeneratingAny: boolean;
  onGenerateSingle: (id: string) => void;
  onUpdateItemVoice: (id: string, voiceId: string) => void;
  onUpdateItemModel: (id: string, modelId: string) => void;
  onUpdateDuration: (id: string, durationSecs: number) => void;
}

export const NarrationRow: React.FC<NarrationRowProps> = ({
  item,
  index,
  voices,
  models,
  isGeneratingAny,
  onGenerateSingle,
  onUpdateItemVoice,
  onUpdateItemModel,
  onUpdateDuration,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCurrentGenerating = item.status === "GENERATING";

  const renderStatusBadge = () => {
    switch (item.status) {
      case "READY":
        return (
          <span className="badge badge-ready">
            <CheckCircle2 size={12} className="mr-1" />
            READY
          </span>
        );
      case "GENERATING":
        return (
          <span className="badge badge-generating">
            <span className="badge-spinner mr-1"></span>
            GENERATING
          </span>
        );
      case "ERROR":
        return (
          <span className="badge badge-error" title={item.error || "Error en la generación"}>
            <AlertCircle size={12} className="mr-1" />
            ERROR
          </span>
        );
      case "CANCELLED":
        return (
          <span className="badge badge-cancelled">
            <Square size={10} className="mr-1" />
            CANCELLED
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="badge badge-pending">
            <Clock size={11} className="mr-1" />
            PENDING
          </span>
        );
    }
  };

  const padIndex = String(index + 1).padStart(2, "0");
  const fileName = `narration_${String(index + 1).padStart(3, "0")}.mp3`;

  return (
    <tr className={`narration-row status-border-${item.status.toLowerCase()}`}>
      {/* Index & ID */}
      <td className="col-index-id">
        <div className="index-number">{padIndex}</div>
        <div className="id-block">
          <span className="narration-id" title={item.id}>
            {item.id}
          </span>
          <span className="scene-tag">
            Escena {item.sceneIndex}: {item.sceneId}
          </span>
        </div>
      </td>

      {/* Text with Expand */}
      <td className="col-text">
        <div className="text-wrapper">
          <p className={`narration-text ${!isExpanded && item.text.length > 120 ? "text-truncated" : ""}`}>
            {item.text}
          </p>
          {item.text.length > 120 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn-text-expand"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={12} className="mr-0.5" /> Menos
                </>
              ) : (
                <>
                  <ChevronDown size={12} className="mr-0.5" /> Más ({item.text.length} chars)
                </>
              )}
            </button>
          )}
        </div>

        {/* Error Details if ERROR */}
        {item.status === "ERROR" && item.error && (
          <div className="item-error-notice">
            <AlertCircle size={12} className="text-rose mr-1 flex-shrink-0" />
            <span className="error-text-msg">{item.error}</span>
          </div>
        )}

        {/* Request ID Metadata if present */}
        {item.requestId && (
          <div className="item-request-id">
            <span>req: {item.requestId.slice(0, 8)}...</span>
          </div>
        )}
      </td>

      {/* Voice & Model Config */}
      <td className="col-voice-model">
        <div className="voice-select-wrapper">
          <select
            value={item.voiceId || ""}
            onChange={(e) => onUpdateItemVoice(item.id, e.target.value)}
            disabled={isGeneratingAny}
            className="row-select"
            title="Voz asignada a este elemento"
          >
            {item.voiceId && !voices.some((v) => v.voiceId === item.voiceId) && (
              <option key={item.voiceId} value={item.voiceId}>
                {item.voiceId} (original)
              </option>
            )}
            {voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="model-select-wrapper mt-1">
          <select
            value={item.modelId || "eleven_multilingual_v2"}
            onChange={(e) => onUpdateItemModel(item.id, e.target.value)}
            disabled={isGeneratingAny}
            className="row-select row-select-muted"
            title="Modelo asignado a este elemento"
          >
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* Status Badge & Duration */}
      <td className="col-status">
        <div className="status-cell">
          {renderStatusBadge()}
          {item.duration !== undefined && item.duration > 0 && (
            <span className="duration-tag">{item.duration.toFixed(1)}s</span>
          )}
        </div>
      </td>

      {/* Audio Preview Player */}
      <td className="col-audio">
        {item.status === "READY" && item.audioUrl ? (
          <AudioPlayer
            src={item.audioUrl}
            fileName={fileName}
            onDurationLoaded={(dur) => onUpdateDuration(item.id, dur)}
          />
        ) : isCurrentGenerating ? (
          <div className="audio-generating-placeholder">
            <span className="pulse-text">Sintetizando narración...</span>
          </div>
        ) : (
          <span className="audio-empty-placeholder">Sin audio generado</span>
        )}
      </td>

      {/* Row Actions */}
      <td className="col-actions">
        <div className="row-actions-group">
          {item.status === "READY" ? (
            <button
              type="button"
              onClick={() => onGenerateSingle(item.id)}
              disabled={isGeneratingAny}
              className="btn-row-action"
              title="Regenerar este audio individualmente"
            >
              <RotateCcw size={13} className="mr-1" />
              <span>Regenerar</span>
            </button>
          ) : item.status === "ERROR" ? (
            <button
              type="button"
              onClick={() => onGenerateSingle(item.id)}
              disabled={isGeneratingAny}
              className="btn-row-action btn-row-retry"
              title="Reintentar esta narración"
            >
              <RotateCcw size={13} className="mr-1" />
              <span>Reintentar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onGenerateSingle(item.id)}
              disabled={isGeneratingAny}
              className="btn-row-action btn-row-generate"
              title="Generar este audio individualmente"
            >
              <Play size={13} className="mr-1" />
              <span>Generar</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
