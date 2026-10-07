/**
 * @file src/components/RecoveryVaultSection.tsx
 * Discrete UI section displaying temporary recovery sessions.
 * Allows instant rehydration without ElevenLabs re-synthesis.
 */

import React, { useState, useEffect } from "react";
import { Archive, RefreshCw, Trash2, RotateCcw } from "lucide-react";
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
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "1.25rem", margin: "1rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Archive size={18} className="text-cyan-400" />
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600", color: "#f8fafc" }}>
            RECUPERACIÓN TEMPORAL
          </h3>
        </div>
        <button
          onClick={loadSessions}
          disabled={loading}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      <p style={{ margin: "0 0 1rem 0", fontSize: "0.75rem", color: "#94a3b8", lineHeight: "1.4" }}>
        GhostAI conserva temporalmente tus narraciones para que puedas restaurarlas sin volver a generarlas.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
        {sessions.map((session) => (
          <div
            key={session.id}
            style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "8px", padding: "0.85rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#f8fafc", wordBreak: "break-word" }}>
                  {session.projectTitle || "Proyecto sin título"}
                </span>
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: "4px", background: session.readyCount === session.itemCount ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: session.readyCount === session.itemCount ? "#34d399" : "#fbbf24", fontWeight: "bold" }}>
                  {session.readyCount}/{session.itemCount} AUDIOS
                </span>
              </div>

              <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "0.75rem" }}>
                <span>Creado {formatRelativeTime(session.createdAt)}</span>
                <span style={{ color: "#38bdf8" }}>{formatExpiryTime(session.expiresAt)}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => handleRestore(session)}
                disabled={restoringSessionId === session.id}
                style={{ flex: 1, padding: "0.4rem 0.6rem", background: "#0284c7", border: "none", borderRadius: "4px", color: "#ffffff", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
              >
                {restoringSessionId === session.id ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                <span>{restoringSessionId === session.id ? "Restaurando..." : "RESTAURAR"}</span>
              </button>

              <button
                onClick={() => handleDelete(session.id)}
                style={{ padding: "0.4rem 0.6rem", background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: "4px", color: "#fda4af", fontSize: "0.75rem", cursor: "pointer" }}
                title="Eliminar"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
