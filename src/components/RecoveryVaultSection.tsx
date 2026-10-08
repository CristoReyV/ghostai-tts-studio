/**
 * @file src/components/RecoveryVaultSection.tsx
 * Discrete UI section displaying temporary recovery sessions.
 * Allows instant rehydration without ElevenLabs re-synthesis.
 * UX 04: Compact collapsible block inside UTILIDADES.
 */

import React, { useState, useEffect } from "react";
import { Archive, RefreshCw, Trash2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import {
  fetchRecoverySessions,
  recoverSession,
  downloadRecoveredAudioBlob,
  deleteRecoverySession,
} from "../services/recoveryService";
import type { RecoverySessionSummary, StudioNarrationItem, GhostAiTtsFile } from "../types/tts";

interface RecoveryVaultSectionProps {
  isAuthenticated: boolean;
  hasActiveProject: boolean;
  onRestoreProject: (project: GhostAiTtsFile, items: StudioNarrationItem[]) => void;
  onNotification: (type: "success" | "error" | "info" | "warning", msg: string) => void;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours} h ${mins % 60} min`;
}

function formatExpiryTime(isoString: string): string {
  const diffMs = new Date(isoString).getTime() - Date.now();
  if (diffMs <= 0) return "Expirado";
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `Expira en ${hours} h ${mins} min`;
}

export const RecoveryVaultSection: React.FC<RecoveryVaultSectionProps> = ({
  isAuthenticated,
  hasActiveProject,
  onRestoreProject,
  onNotification,
}) => {
  const [sessions, setSessions] = useState<RecoverySessionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(!hasActiveProject);

  const loadSessions = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await fetchRecoverySessions();
      setSessions(data);
    } catch (_) {
      // Graceful silence for legacy or network glitches
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    } else {
      setSessions([]);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated || sessions.length === 0) {
    return null;
  }

  const handleRestore = async (session: RecoverySessionSummary) => {
    if (hasActiveProject) {
      const confirmed = window.confirm(
        `Ya tienes un proyecto activo en el Studio. ¿Deseas reemplazarlo con la sesión de recuperación '${session.projectTitle || "Sin título"}'?`
      );
      if (!confirmed) return;
    }

    setRestoringSessionId(session.id);
    onNotification("info", `Iniciando restauración de '${session.projectTitle || "Sesión"}' sin consultar ElevenLabs...`);

    try {
      // 1. Recover session metadata
      const { session: recoveredMeta, items: recoveredItems } = await recoverSession(session.id);

      // 2. Download audio blobs from Recovery Vault
      const restoredStudioItems: StudioNarrationItem[] = [];
      let audioRecoveredCount = 0;

      for (const item of recoveredItems) {
        let audioBlob: Blob | undefined;
        let audioUrl: string | undefined;

        if (item.hasAudio) {
          try {
            audioBlob = await downloadRecoveredAudioBlob(session.id, item.narrationId);
            audioUrl = URL.createObjectURL(audioBlob);
            audioRecoveredCount++;
          } catch (_) {}
        }

        restoredStudioItems.push({
          id: item.narrationId,
          narrationId: item.narrationId,
          sceneId: item.sceneId || `scene_${item.sceneIndex || 1}`,
          sceneIndex: typeof item.sceneIndex === "number" ? item.sceneIndex : 1,
          text: item.text || `[Narración recuperada ${item.narrationId}]`,
          voiceId: item.voiceId || undefined,
          modelId: item.modelId || undefined,
          outputFormat: item.outputFormat || undefined,
          duration: item.durationSeconds || undefined,
          status: audioBlob ? "READY" : "ERROR",
          error: audioBlob ? undefined : "Audio no disponible en el vault",
          audioBlob,
          audioUrl,
        });
      }

      // 3. Reconstruct Project
      const restoredProject: GhostAiTtsFile = {
        format: "ghostai-tts",
        version: "1.0",
        project: {
          name: recoveredMeta.projectTitle || "Proyecto Recuperado",
          exportedAt: recoveredMeta.createdAt,
        },
        items: restoredStudioItems,
      };

      onRestoreProject(restoredProject, restoredStudioItems);
      onNotification(
        "success",
        `Sesión restaurada: ${audioRecoveredCount}/${restoredStudioItems.length} audios listos (0 consumos de ElevenLabs).`
      );
    } catch (err) {
      onNotification("error", `Error restaurando sesión: ${(err as Error).message}`);
    } finally {
      setRestoringSessionId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm("¿Deseas eliminar anticipadamente esta copia temporal de recuperación?")) {
      return;
    }
    try {
      await deleteRecoverySession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      onNotification("info", "Copia de recuperación eliminada.");
    } catch (err) {
      onNotification("error", `Error eliminando sesión: ${(err as Error).message}`);
    }
  };

  return (
    <div className="utilities-vault-card" data-testid="utilities-vault-card">
      <div className="utilities-vault-bar">
        <div className="utilities-bar-left">
          <div className="utilities-tag">
            <Archive size={15} className="text-cyan-400 mr-1.5" />
            <span className="utilities-eyebrow">UTILIDADES</span>
          </div>
          <span className="utilities-sep">·</span>
          <span className="utilities-title">RECUPERACIÓN TEMPORAL</span>
          <span className="utilities-badge" data-testid="recovery-projects-count">
            {sessions.length} {sessions.length === 1 ? "proyecto disponible" : "proyectos disponibles"}
          </span>
        </div>

        <div className="utilities-bar-right">
          <button
            type="button"
            className="btn-toggle-vault"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="btn-toggle-recovery"
          >
            <span>{isExpanded ? "OCULTAR RECUPERACIÓN" : "VER RECUPERACIÓN"}</span>
            {isExpanded ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="utilities-vault-expanded animate-fade-in">
          <div className="utilities-vault-subbar">
            <p className="utilities-desc">
              GhostAI conserva temporalmente tus narraciones para que puedas restaurarlas sin volver a generarlas.
            </p>
            <button
              type="button"
              onClick={loadSessions}
              disabled={loading}
              className="btn-refresh-vault"
            >
              <RefreshCw size={13} className={loading ? "animate-spin mr-1" : "mr-1"} /> Actualizar
            </button>
          </div>

          <div className="utilities-sessions-grid">
            {sessions.map((session) => (
              <div key={session.id} className="recovery-session-item">
                <div className="session-item-header">
                  <span className="session-project-title" title={session.projectTitle || "Proyecto sin título"}>
                    {session.projectTitle || "Proyecto sin título"}
                  </span>
                  <span
                    className={`session-audios-badge ${
                      session.readyCount === session.itemCount ? "is-complete" : "is-partial"
                    }`}
                  >
                    {session.readyCount}/{session.itemCount} AUDIOS
                  </span>
                </div>

                <div className="session-item-meta">
                  <span>Creado {formatRelativeTime(session.createdAt)}</span>
                  <span className="session-expiry">{formatExpiryTime(session.expiresAt)}</span>
                </div>

                <div className="session-item-actions">
                  <button
                    type="button"
                    onClick={() => handleRestore(session)}
                    disabled={restoringSessionId === session.id}
                    className="btn-restore-session"
                  >
                    {restoringSessionId === session.id ? (
                      <RefreshCw size={12} className="animate-spin mr-1" />
                    ) : (
                      <RotateCcw size={12} className="mr-1" />
                    )}
                    <span>{restoringSessionId === session.id ? "Restaurando..." : "RESTAURAR"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(session.id)}
                    className="btn-delete-session"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
