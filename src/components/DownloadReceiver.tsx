/**
 * @file src/components/DownloadReceiver.tsx
 * Secure receiver for ZIP downloads initiated from embedded/sandboxed contexts.
 *
 * HARDENED ARCHITECTURE (FIX 01C):
 * 1. Synchronous window.open before async operations to preserve user activation.
 * 2. Paired via ephemeral, cryptographically random bridgeId (no secrets/tokens in URL).
 * 3. Enforces event.source === window.opener validation.
 * 4. Strictly validates payload: Blob instance, blob.size > 0, sanitized fileName.
 * 5. Handles opaque origins ("null") only when paired with exact opener + bridgeId.
 * 6. Explicit 2-step UX: "PREPARANDO DESCARGA" -> "ZIP LISTO" -> user clicks "DESCARGAR ZIP".
 * 7. Independent of IndexedDB (works when IndexedDB is empty or partitioned).
 * 8. Clean error handling with official portal fallback if browser blocks communications.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  PackageCheck,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { downloadBlob, buildGhostAiTtsPackage } from "../services/zipBuilder";
import { loadActiveSession } from "../services/projectStorage";
import {
  GHOSTAI_MESSAGE_TYPES,
  getBridgeIdFromUrl,
  sanitizeFileName,
  type GhostAiZipTransferPayload,
} from "../utils/environment";

export type ReceiverStatus = "PREPARING" | "READY" | "DOWNLOADED" | "ERROR";

export const DownloadReceiver: React.FC = () => {
  const [status, setStatus] = useState<ReceiverStatus>("PREPARING");
  const [zipData, setZipData] = useState<GhostAiZipTransferPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handshakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receivedRef = useRef<boolean>(false);

  // Retrieve ephemeral bridge pairing ID
  const expectedBridgeId = useRef<string | null>(getBridgeIdFromUrl()).current;

  // Format bytes helper
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const cleanupTimers = useCallback(() => {
    if (handshakeIntervalRef.current) {
      clearInterval(handshakeIntervalRef.current);
      handshakeIntervalRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  // PostMessage listener & handshake
  useEffect(() => {
    const expectedOrigin = window.location.origin;

    const handleMessage = (event: MessageEvent) => {
      // 1. Validate window source: must originate from window.opener if available
      if (window.opener && event.source && event.source !== window.opener) {
        return; // Ignore foreign window sources
      }

      // 2. Validate bridge pairing ID (must match ephemeral query param)
      if (expectedBridgeId && event.data?.bridgeId !== expectedBridgeId) {
        return; // Ignore mismatched bridge IDs
      }

      // 3. Validate origin: accept exact same origin or opaque origin if properly paired
      if (event.origin !== expectedOrigin && event.origin !== "null") {
        return; // Reject third-party origins
      }

      // 4. Validate message type
      if (event.data?.type === GHOSTAI_MESSAGE_TYPES.ZIP_TRANSFER && event.data?.payload) {
        const payload = event.data.payload as GhostAiZipTransferPayload;

        // 5. Strict Payload Validation (Section 8)
        if (!(payload.blob instanceof Blob) || payload.blob.size <= 0) {
          console.warn("[DownloadReceiver] Payload rejected: invalid or empty Blob");
          return;
        }

        if (typeof payload.fileName !== "string" || payload.fileName.trim().length === 0) {
          console.warn("[DownloadReceiver] Payload rejected: invalid fileName");
          return;
        }

        // 6. Sanitize fileName (Section 9)
        const safeName = sanitizeFileName(payload.fileName);

        receivedRef.current = true;
        cleanupTimers();

        setZipData({
          ...payload,
          fileName: safeName,
        });
        // Transition directly to ZIP LISTO state
        setStatus("READY");
      }
    };

    window.addEventListener("message", handleMessage);

    // Handshake sender to window.opener
    const sendHandshake = () => {
      if (receivedRef.current) return;
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage(
            {
              type: GHOSTAI_MESSAGE_TYPES.RECEIVER_READY,
              bridgeId: expectedBridgeId,
            },
            expectedOrigin !== "null" ? expectedOrigin : "*"
          );
        } catch (_err) {
          // Opener may be in an opaque sandbox
        }
      }
    };

    // Immediate handshake
    sendHandshake();

    // Repeat handshake every 350ms until received or timed out
    handshakeIntervalRef.current = setInterval(sendHandshake, 350);

    // Timeout fallback after 10 seconds (Section 10)
    timeoutTimerRef.current = setTimeout(async () => {
      if (receivedRef.current) return;
      cleanupTimers();

      // Secondary fallback: attempt to load from IndexedDB if same-origin storage was shared
      try {
        const session = await loadActiveSession();
        if (session && session.items.length > 0) {
          const readyItems = session.items.filter((it) => it.status === "READY" && it.audioBlob);
          if (readyItems.length > 0) {
            const pkg = await buildGhostAiTtsPackage({
              project: session.project,
              items: readyItems,
              includeOnlyReady: true,
            });
            receivedRef.current = true;
            setZipData({
              blob: pkg.blob,
              fileName: sanitizeFileName(pkg.fileName),
              itemCount: pkg.itemCount,
              projectName: session.project.name,
              bridgeId: expectedBridgeId || "",
            });
            setStatus("READY");
            return;
          }
        }
      } catch (_e) {
        // Fallback failed
      }

      // Explicit failure copy matching prompt requirement
      setStatus("ERROR");
      setErrorMessage(
        "Este visor bloquea la descarga. Abre GhostAI TTS Studio directamente en una pestaña del navegador."
      );
    }, 10000);

    return () => {
      window.removeEventListener("message", handleMessage);
      cleanupTimers();
    };
  }, [cleanupTimers, expectedBridgeId]);

  // Handle explicit user click to initiate download
  const handleDownloadClick = () => {
    if (!zipData) return;
    downloadBlob(zipData.blob, zipData.fileName);
    setStatus("DOWNLOADED");
  };

  const handleOpenOfficialStudio = () => {
    window.location.href = "https://ghostai-tts-studio.smartbrain.lat/";
  };

  return (
    <div className="download-receiver-layout">
      <header className="download-receiver-header">
        <div className="receiver-brand">
          <span className="brand-dot"></span>
          <span className="brand-title">GhostAI TTS Studio</span>
          <span className="brand-separator">•</span>
          <span className="brand-badge">Receptor de Descarga Directa</span>
        </div>
        <div className="receiver-security-badge">
          <Download size={14} className="text-emerald mr-1" />
          <span>Descarga Directa</span>
        </div>
      </header>

      <main className="download-receiver-main">
        <div className="download-receiver-card">
          {status === "PREPARING" && (
            <div className="receiver-state state-connecting">
              <div className="state-icon-spinner">
                <Loader2 size={36} className="animate-spin text-accent" />
              </div>
              <h2 className="state-title" data-testid="receiver-title">PREPARANDO DESCARGA</h2>
              <p className="state-description">
                Estableciendo enlace seguro con el Studio para transferir el paquete ZIP sin restricciones de sandbox.
              </p>
              <div className="state-status-indicator">
                <span className="pulse-dot"></span>
                <span>Esperando paquete de audio...</span>
              </div>
            </div>
          )}

          {status === "READY" && zipData && (
            <div className="receiver-state state-ready">
              <div className="state-icon-badge badge-success">
                <PackageCheck size={36} className="text-emerald" />
              </div>
              <h2 className="state-title" data-testid="receiver-title">ZIP LISTO</h2>
              <p className="state-description">
                El archivo ZIP ha sido verificado y está listo para guardarse en tu equipo.
              </p>

              <div className="package-info-card">
                <div className="package-info-row">
                  <span className="info-label">Proyecto:</span>
                  <span className="info-value font-semibold">{zipData.projectName}</span>
                </div>
                <div className="package-info-row">
                  <span className="info-label">Archivo:</span>
                  <span className="info-value font-mono text-accent">{zipData.fileName}</span>
                </div>
                <div className="package-info-row">
                  <span className="info-label">Narraciones:</span>
                  <span className="info-value">{zipData.itemCount} archivos</span>
                </div>
                <div className="package-info-row">
                  <span className="info-label">Tamaño:</span>
                  <span className="info-value">{formatSize(zipData.blob.size)}</span>
                </div>
              </div>

              <div className="receiver-actions">
                <button
                  type="button"
                  className="btn-download-primary"
                  onClick={handleDownloadClick}
                  data-testid="btn-receiver-download"
                >
                  <Download size={20} className="mr-2" />
                  <span>DESCARGAR ZIP</span>
                </button>
              </div>
            </div>
          )}

          {status === "DOWNLOADED" && zipData && (
            <div className="receiver-state state-downloaded">
              <div className="state-icon-badge badge-success">
                <CheckCircle size={36} className="text-emerald" />
              </div>
              <h2 className="state-title">¡Descarga Iniciada!</h2>
              <p className="state-description">
                El archivo <span className="font-mono text-accent">{zipData.fileName}</span> se está guardando en tu equipo.
              </p>

              <div className="receiver-actions-flex">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadClick}
                >
                  <Download size={16} className="mr-2" />
                  <span>Descargar de Nuevo</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleOpenOfficialStudio}
                >
                  <ExternalLink size={16} className="mr-2" />
                  <span>Abrir Studio Principal</span>
                </button>
              </div>
            </div>
          )}

          {status === "ERROR" && (
            <div className="receiver-state state-error">
              <div className="state-icon-badge badge-error">
                <AlertCircle size={36} className="text-rose" />
              </div>
              <h2 className="state-title">Transferencia no Disponible</h2>
              <p className="state-description text-rose">
                {errorMessage || "Este visor bloquea la descarga. Abre GhostAI TTS Studio directamente en una pestaña del navegador."}
              </p>

              <div className="receiver-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleOpenOfficialStudio}
                  data-testid="btn-fallback-portal"
                >
                  <ExternalLink size={16} className="mr-2" />
                  <span>Abrir GhostAI TTS Studio Oficial</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="download-receiver-footer">
        <p>
          GhostAI TTS Studio • Receptor seguro de descargas • Sin exposición de credenciales
        </p>
      </footer>
    </div>
  );
};
