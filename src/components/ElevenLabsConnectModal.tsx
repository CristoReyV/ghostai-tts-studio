/**
 * @file src/components/ElevenLabsConnectModal.tsx
 * Modal de conexión BYOK de ElevenLabs. La validación real la hace el gateway contra la API
 * oficial de ElevenLabs (el navegador nunca llama a ElevenLabs ni persiste la clave).
 * La clave vive solo en el estado local del modal y se borra al cerrar o al conectar.
 */

import React, { useEffect, useRef, useState } from "react";
import { KeyRound, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";

export type ConnectPhase = "idle" | "connecting" | "connected" | "invalid" | "network" | "unavailable" | "auth";

export const CONNECT_PHASE_LABEL: Record<ConnectPhase, string> = {
  idle: "",
  connecting: "Conectando…",
  connected: "Conectado",
  invalid: "Clave inválida",
  network: "Error de conexión",
  unavailable: "Servicio no disponible",
  auth: "Acceso GhostAI requerido",
};

/** Clasifica un error del gateway SIN incluir nunca la clave. */
export function classifyConnectError(err: unknown): ConnectPhase {
  const e = err as { code?: string; statusCode?: number; name?: string } | null;
  const code = e?.code || "";
  const status = e?.statusCode ?? 0;
  if (code === "ELEVENLABS_INVALID_API_KEY" || code === "VALIDATION_MISSING_FIELD") return "invalid";
  if (code === "AUTH_REQUIRED" || code === "AUTH_INVALID" || code === "GHOSTAI_AUTH_INVALID") return "auth";
  if (code === "GATEWAY_NOT_CONFIGURED" || status === 500 || status === 503 || status === 404) return "unavailable";
  if (code === "ELEVENLABS_NETWORK_ERROR" || status === 502 || status === 504) return "network";
  if (status === 401 || status === 403) return code === "ELEVENLABS_INVALID_API_KEY" ? "invalid" : "auth";
  // fetch() sin respuesta (offline, CORS, DNS) lanza TypeError
  if (!status) return "network";
  return "unavailable";
}

export interface ConnectAttempt {
  phase: ConnectPhase;
  detail: string | null;
}

/** Lógica de conexión pura (sin DOM): nunca marca «connected» salvo que onConnect confirme ok. */
export async function attemptConnect(
  rawKey: string,
  isAuthenticated: boolean,
  onConnect: (apiKey: string) => Promise<{ ok: boolean; message?: string }>
): Promise<ConnectAttempt> {
  const clean = rawKey.trim();
  if (!clean) return { phase: "invalid", detail: "Introduce tu API key de ElevenLabs." };
  if (!isAuthenticated) return { phase: "auth", detail: "Conecta primero tu acceso GhostAI." };
  try {
    const res = await onConnect(clean);
    return res.ok ? { phase: "connected", detail: null } : { phase: "invalid", detail: res.message || null };
  } catch (err) {
    return { phase: classifyConnectError(err), detail: (err as Error)?.message || null };
  }
}

export interface ElevenLabsConnectModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  isProviderConnected: boolean;
  onClose: () => void;
  /** Debe devolver ok solo si el gateway validó la clave con ElevenLabs. Puede lanzar TtsGatewayError. */
  onConnect: (apiKey: string) => Promise<{ ok: boolean; message?: string }>;
  onDisconnect?: () => Promise<void>;
}

export const ElevenLabsConnectModal: React.FC<ElevenLabsConnectModalProps> = ({
  isOpen,
  isAuthenticated,
  isProviderConnected,
  onClose,
  onConnect,
  onDisconnect,
}) => {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<ConnectPhase>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const alive = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Al abrir/cerrar: estado limpio y la clave nunca sobrevive al cierre.
  useEffect(() => {
    setKeyInput("");
    setShowKey(false);
    setPhase("idle");
    setDetail(null);
    if (isOpen) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && phase !== "connecting") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, phase, onClose]);

  if (!isOpen) return null;

  const busy = phase === "connecting";

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!keyInput.trim() || busy) return;
    setPhase("connecting");
    setDetail(null);
    const result = await attemptConnect(keyInput, isAuthenticated, onConnect);
    if (!alive.current) return;
    setPhase(result.phase);
    setDetail(result.detail);
    if (result.phase === "connected") {
      setKeyInput("");
      setShowKey(false);
      window.setTimeout(() => {
        if (alive.current) onClose();
      }, 900);
    }
  };

  const disconnect = async () => {
    if (!onDisconnect || busy) return;
    setPhase("connecting");
    try {
      await onDisconnect();
    } finally {
      if (alive.current) {
        setPhase("idle");
        setDetail(null);
      }
    }
  };

  const isError = phase === "invalid" || phase === "network" || phase === "unavailable" || phase === "auth";

  const dialog = (
    <div
      className="explorer-modal-backdrop"
      data-testid="elevenlabs-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="explorer-modal-dialog el-connect-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="el-connect-title"
        data-testid="elevenlabs-modal"
        style={{ maxWidth: 460 }}
      >
        <div className="explorer-modal-header">
          <h2 id="el-connect-title" className="explorer-modal-title">
            {isProviderConnected ? "Cambiar clave de ElevenLabs" : "Conectar ElevenLabs"}
          </h2>
          <button type="button" className="btn-close-modal" onClick={onClose} disabled={busy} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: "1.25rem 1.5rem", display: "grid", gap: "0.9rem" }}>
          <p className="provider-explain-text">
            Introduce tu API key de ElevenLabs. Se valida con ElevenLabs a través del gateway, no se guarda en tu
            navegador ni en el proyecto, y las generaciones usan los créditos de tu cuenta.
          </p>

          <div className="provider-input-wrapper">
            <KeyRound size={15} className="provider-input-icon" />
            <input
              ref={inputRef}
              type={showKey ? "text" : "password"}
              data-testid="elevenlabs-modal-key-input"
              className="provider-key-input"
              placeholder="Tu API key de ElevenLabs"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                if (isError) {
                  setPhase("idle");
                  setDetail(null);
                }
              }}
              disabled={busy || phase === "connected"}
              autoComplete="off"
              spellCheck={false}
              aria-label="API key de ElevenLabs"
            />
            <button
              type="button"
              className="provider-toggle-visibility"
              data-testid="elevenlabs-modal-toggle"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Ocultar API key" : "Mostrar API key"}
              aria-pressed={showKey}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <div role="status" aria-live="polite" data-testid="elevenlabs-modal-status" data-phase={phase}>
            {busy && (
              <span className="check-status-label">
                <Loader2 size={13} className="spin mr-1.5 inline" />
                {CONNECT_PHASE_LABEL.connecting}
              </span>
            )}
            {phase === "connected" && (
              <span className="check-status-label text-emerald">
                <CheckCircle2 size={13} className="inline mr-1.5" />✓ {CONNECT_PHASE_LABEL.connected}
              </span>
            )}
            {isError && (
              <div className="provider-error-message" role="alert">
                <AlertCircle size={13} className="mr-1.5 flex-shrink-0 text-rose" />
                <span>
                  <strong>{CONNECT_PHASE_LABEL[phase]}.</strong>
                  {detail ? ` ${detail}` : ""}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
            {isProviderConnected && onDisconnect && (
              <button
                type="button"
                className="btn-provider-disconnect"
                data-testid="elevenlabs-modal-disconnect"
                onClick={disconnect}
                disabled={busy}
                style={{ marginRight: "auto" }}
              >
                DESCONECTAR
              </button>
            )}
            <button
              type="button"
              className="btn-provider-disconnect"
              data-testid="elevenlabs-modal-cancel"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-provider-connect"
              data-testid="elevenlabs-modal-submit"
              disabled={busy || phase === "connected" || !keyInput.trim()}
            >
              Conectar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return dialog;
};
