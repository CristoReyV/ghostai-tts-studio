/**
 * @file src/components/ZipVerificationCard.tsx
 * Download State Machine & Verification UI.
 * Distinct states: not_prepared, prepared, download_triggered, verification_pending, verified, failed.
 */

import React, { useRef, useState } from "react";
import { CheckCircle2, AlertOctagon, FileCheck, RefreshCw, Download, FileArchive } from "lucide-react";
import type { ZipDownloadStatus, ZipVerificationResult } from "../types/tts";
import { verifyGhostAiTtsZip } from "../services/zipVerifier";
import { reportZipVerification } from "../services/recoveryService";

interface ZipVerificationCardProps {
  status: ZipDownloadStatus;
  currentSessionId?: string | null;
  expectedItemCount?: number;
  expectedItems?: Array<{ narrationId: string; sha256?: string | null }>;
  onStatusChange: (status: ZipDownloadStatus) => void;
  onRetryDownload: () => void;
  onNotification: (type: "success" | "error" | "info" | "warning", msg: string) => void;
}

export const ZipVerificationCard: React.FC<ZipVerificationCardProps> = ({
  status,
  currentSessionId,
  expectedItemCount,
  expectedItems,
  onStatusChange,
  onRetryDownload,
  onNotification,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<ZipVerificationResult | null>(null);

  if (status === "not_prepared" || status === "prepared") {
    return null;
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setResult(null);

    try {
      const outcome = await verifyGhostAiTtsZip(file, {
        itemCount: expectedItemCount,
        items: expectedItems,
      });

      setResult(outcome);
      if (outcome.ok) {
        onStatusChange("verified");
        onNotification("success", `¡ZIP verificado con éxito! Paquete íntegro (${outcome.details?.verifiedItems} audios).`);
        // Report verification metadata to gateway if session exists
        if (currentSessionId && outcome.details?.packageSha256) {
          reportZipVerification(currentSessionId, true, outcome.details.packageSha256, outcome.details.verifiedItems).catch(() => {});
        }
      } else {
        onStatusChange("failed");
        onNotification("error", `Fallo en la verificación: ${outcome.error}`);
        if (currentSessionId) {
          reportZipVerification(currentSessionId, false).catch(() => {});
        }
      }
    } catch (err) {
      const errRes: ZipVerificationResult = {
        ok: false,
        error: (err as Error).message || "Error durante la verificación del archivo.",
      };
      setResult(errRes);
      onStatusChange("failed");
      onNotification("error", errRes.error!);
    } finally {
      setVerifying(false);
      // Reset input value so user can pick again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePickFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        margin: "1rem 0",
        padding: "1.25rem",
        borderRadius: "10px",
        background: status === "verified" ? "rgba(16, 185, 129, 0.08)" : status === "failed" ? "rgba(244, 63, 94, 0.08)" : "#0f172a",
        border: status === "verified" ? "1px solid #10b981" : status === "failed" ? "1px solid #f43f5e" : "1px solid #38bdf8",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />

      {/* ── State: verification_pending or download_triggered ─────────────── */}
      {(status === "download_triggered" || status === "verification_pending") && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", color: "#38bdf8" }}>
            <FileArchive size={20} />
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "bold" }}>DESCARGA INICIADA</h4>
          </div>

          <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "#cbd5e1" }}>
            ¿Quieres confirmar que el archivo ZIP se descargó de manera íntegra y completa?
          </p>

          <p style={{ margin: "0 0 1rem 0", fontSize: "0.75rem", color: "#94a3b8" }}>
            Selecciona el ZIP que acabas de descargar. GhostAI lo revisará localmente (validación de manifest 1.0, firmas de audio e integridad).
          </p>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={handlePickFileClick}
              disabled={verifying}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1rem",
                background: "#0284c7",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {verifying ? <RefreshCw size={15} className="animate-spin" /> : <FileCheck size={15} />}
              <span>{verifying ? "Verificando ZIP..." : "VERIFICAR ZIP DESCARGADO"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── State: verified ──────────────────────────────────────────────── */}
      {status === "verified" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color: "#34d399" }}>
            <CheckCircle2 size={22} />
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold" }}>✓ ZIP VERIFICADO LOCALMENTE</h4>
          </div>

          {result?.details && (
            <div style={{ background: "#0b1320", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.8rem", color: "#cbd5e1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div><strong>Formato:</strong> {result.details.format} {result.details.version}</div>
              <div><strong>Audios:</strong> {result.details.verifiedItems} / {result.details.totalItems}</div>
              <div><strong>Integridad:</strong> 100% Correcta</div>
              <div><strong>Archivo:</strong> {result.details.fileName}</div>
              <div style={{ gridColumn: "1 / -1", fontFamily: "monospace", color: "#38bdf8", wordBreak: "break-all" }}>
                <strong>SHA-256:</strong> {result.details.packageSha256.slice(0, 32)}...
              </div>
            </div>
          )}

          <p style={{ margin: 0, fontSize: "0.75rem", color: "#6ee7b7" }}>
            El paquete está certificado y listo para su uso.
          </p>
        </div>
      )}

      {/* ── State: failed ────────────────────────────────────────────────── */}
      {status === "failed" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", color: "#fda4af" }}>
            <AlertOctagon size={22} />
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold" }}>NO SE PUDO VERIFICAR EL ZIP</h4>
          </div>

          <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "#fda4af" }}>
            {result?.error || "El paquete ZIP no superó los controles de integridad."}
          </p>

          <p style={{ margin: "0 0 1rem 0", fontSize: "0.75rem", color: "#94a3b8" }}>
            Los audios siguen seguros localmente y en el Recovery Vault. Puedes reintentar la descarga sin regenerar ni consumir caracteres adicionales.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={onRetryDownload}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1rem",
                background: "#0284c7",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <Download size={15} />
              <span>REINTENTAR DESCARGA</span>
            </button>

            <button
              onClick={handlePickFileClick}
              disabled={verifying}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1rem",
                background: "#334155",
                border: "none",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <FileCheck size={15} />
              <span>SELECCIONAR OTRO ZIP</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
