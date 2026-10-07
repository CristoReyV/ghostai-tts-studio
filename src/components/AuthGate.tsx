/**
 * @file src/components/AuthGate.tsx
 * Initial GhostAI Access Gate (Frontend Login Screen).
 *
 * Requirements (UX 01):
 *  - Rendered when no valid GhostAI session exists.
 *  - Only asks for GhostAI Access Key (gai_live_...).
 *  - NEVER asks for ElevenLabs API key here.
 *  - Validates key via verifyGatewayAuthToken (/api/tts/auth/verify).
 *  - Shows loading state: 'Verificando acceso...'.
 *  - Shows compact error: 'No pudimos validar esta clave de acceso.' on failure.
 *  - Password field with show/hide toggle.
 *  - Accessible with aria labels.
 */

import React, { useState } from "react";
import { Layers, KeyRound, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import {
  verifyGatewayAuthToken,
  setGatewayAuthToken,
  clearGatewayAuthToken,
} from "../services/gateway";

export interface AuthGateProps {
  onLoginSuccess: (clientName: string | null) => void;
  initialError?: string | null;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onLoginSuccess, initialError }) => {
  const [accessKey, setAccessKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accessKey.trim();
    if (!trimmed) {
      setErrorMessage("Introduce la clave de acceso.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const result = await verifyGatewayAuthToken(trimmed);
      if (result.ok) {
        setGatewayAuthToken(trimmed);
        setAccessKey(""); // Immediately clear plain text password from memory
        setErrorMessage(null);
        onLoginSuccess(result.clientName || null);
      } else {
        clearGatewayAuthToken();
        setErrorMessage("No pudimos validar esta clave de acceso.");
      }
    } catch (_) {
      clearGatewayAuthToken();
      setErrorMessage("No pudimos validar esta clave de acceso.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="auth-gate-container" data-testid="auth-gate">
      <div className="auth-gate-card">
        <div className="auth-gate-header">
          <div className="auth-gate-logo-badge">
            <Layers size={28} className="auth-gate-logo-icon" />
          </div>
          <h1 className="auth-gate-title">GHOSTAI TTS STUDIO</h1>
          <p className="auth-gate-subtitle">Accede a tu espacio de trabajo</p>
        </div>

        <form className="auth-gate-form" onSubmit={handleSubmit}>
          <div className="auth-gate-field">
            <label htmlFor="ghostai-access-key" className="auth-gate-label">
              Access Key de GhostAI
            </label>
            <div className="auth-gate-input-wrapper">
              <KeyRound size={16} className="auth-gate-input-icon" />
              <input
                id="ghostai-access-key"
                data-testid="ghostai-access-key-input"
                type={showKey ? "text" : "password"}
                className="auth-gate-input"
                placeholder="gai_live_••••••••••••••••"
                value={accessKey}
                onChange={(e) => {
                  setAccessKey(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isVerifying}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="auth-gate-toggle-visibility"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-auth-gate-submit"
            data-testid="btn-auth-gate-submit"
            disabled={isVerifying || !accessKey.trim()}
          >
            {isVerifying ? (
              <>
                <Loader2 size={16} className="spin mr-2" />
                <span>Verificando acceso...</span>
              </>
            ) : (
              <span>ENTRAR A GHOSTAI</span>
            )}
          </button>

          <p className="auth-gate-secondary-text">
            Usa la clave de acceso proporcionada para tu cuenta.
          </p>

          {errorMessage && (
            <div className="auth-gate-error-banner" role="alert" data-testid="auth-gate-error">
              <AlertCircle size={15} className="mr-1.5 flex-shrink-0 text-rose" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>

        <div className="auth-gate-footer">
          <div className="auth-gate-footer-hint">
            <ShieldCheck size={14} className="text-cyan-400 mr-1" />
            <span>Acceso seguro protegido por sesión de navegador</span>
          </div>
        </div>
      </div>
    </div>
  );
};
