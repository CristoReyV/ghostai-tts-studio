/**
 * @file src/components/VoiceProviderSection.tsx
 * Clean, secure BYOK (Bring-Your-Own-Key) management section for ElevenLabs.
 *
 * Security:
 *  - Sends the key once to the Gateway via HTTPS with credentials: 'include'.
 *  - Frontend NEVER stores the key in localStorage, sessionStorage, or persistent state.
 *  - Clears input state immediately upon submission.
 *  - Never displays masked keys (••••abcd) because the frontend does not retain the secret.
 */

import React, { useState } from "react";
import { KeyRound, ShieldCheck, Eye, EyeOff, Loader2, AlertCircle, LogOut, CheckCircle2, Zap } from "lucide-react";

export interface VoiceProviderSectionProps {
  isProviderConnected: boolean;
  onConnect: (apiKey: string) => Promise<{ ok: boolean; message?: string }>;
  onDisconnect: () => Promise<void>;
  isAuthenticated: boolean;
}

export const VoiceProviderSection: React.FC<VoiceProviderSectionProps> = ({
  isProviderConnected,
  onConnect,
  onDisconnect,
  isAuthenticated,
}) => {
  const [keyInput, setKeyInput] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = keyInput.trim();
    if (!clean) {
      setErrorMessage("Introduce tu API key de ElevenLabs.");
      return;
    }

    if (!isAuthenticated) {
      setErrorMessage("Conecta primero tu acceso de operador en la cabecera antes de conectar ElevenLabs.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await onConnect(clean);
      if (res.ok) {
        // Immediately clear key from component state
        setKeyInput("");
        setShowKey(false);
        setErrorMessage(null);
      } else {
        setErrorMessage(res.message || "Error al conectar ElevenLabs.");
      }
    } catch (err) {
      setErrorMessage((err as Error).message || "Error al conectar ElevenLabs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnectClick = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onDisconnect();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="voice-provider-section" data-testid="voice-provider-section" className={`voice-provider-card ${isProviderConnected ? "is-connected" : "is-disconnected"}`}>
      <div className="provider-card-header">
        <div className="provider-eyebrow-row">
          <span className="section-eyebrow">
            <Zap size={13} className="inline mr-1 text-accent" />
            PROVEEDOR DE VOZ
          </span>
          <div className="provider-badges">
            <span className="provider-name-badge">ElevenLabs</span>
            {isProviderConnected ? (
              <span className="provider-status-badge badge-connected">
                <CheckCircle2 size={12} className="inline mr-1 text-emerald" />
                ✓ Conectado
              </span>
            ) : (
              <span className="provider-status-badge badge-disconnected">
                Sin conectar
              </span>
            )}
          </div>
        </div>
      </div>

      {isProviderConnected ? (
        <div className="provider-connected-body">
          <div className="provider-info-row">
            <ShieldCheck size={20} className="text-emerald flex-shrink-0" />
            <div className="provider-info-text">
              <span className="provider-status-title">ElevenLabs Conectado</span>
              <p className="provider-status-desc">
                Las generaciones utilizarán los créditos de tu propia cuenta de ElevenLabs. Tu clave está protegida del lado servidor en una cookie cifrada de sesión.
              </p>
            </div>
            <button
              type="button"
              className="btn-provider-disconnect"
              onClick={handleDisconnectClick}
              disabled={isSubmitting}
              title="Desconectar ElevenLabs (elimina la cookie de sesión)"
            >
              {isSubmitting ? (
                <Loader2 size={13} className="spin mr-1" />
              ) : (
                <LogOut size={13} className="mr-1" />
              )}
              <span>DESCONECTAR</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="provider-disconnected-body">
          <p className="provider-explain-text">
            Conecta tu API key de ElevenLabs. Las generaciones utilizarán los créditos de tu propia cuenta.
          </p>

          <form className="provider-connect-form" onSubmit={handleSubmit}>
            <div className="provider-input-wrapper">
              <KeyRound size={15} className="provider-input-icon" />
              <input
                type={showKey ? "text" : "password"}
                id="elevenlabs-api-key-input"
                data-testid="elevenlabs-key-input"
                className="provider-key-input"
                placeholder="sk_••••••••••••"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                autoComplete="off"
                spellCheck={false}
              />
              {keyInput && (
                <button
                  type="button"
                  className="provider-toggle-visibility"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? "Ocultar API key" : "Mostrar API key"}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>

            <button
              type="submit"
              className="btn-provider-connect"
              disabled={isSubmitting || !keyInput.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="spin mr-1.5" />
                  <span>CONECTANDO...</span>
                </>
              ) : (
                <span>CONECTAR ELEVENLABS</span>
              )}
            </button>
          </form>

          {errorMessage && (
            <div className="provider-error-message" role="alert">
              <AlertCircle size={13} className="mr-1.5 flex-shrink-0 text-rose" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
