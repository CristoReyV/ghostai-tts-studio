/**
 * @file src/components/ConnectionAlert.tsx
 * Centro de Alertas de Conexión GhostAI + ElevenLabs.
 * Ubicado inmediatamente debajo del Header.
 *
 * Estados:
 *  - Estado 1: GhostAI desconectado -> ACCESO GHOSTAI REQUERIDO + CTA CONECTAR GHOSTAI + ElevenLabs pendiente.
 *  - Estado 2: GhostAI conectado, ElevenLabs no -> CONECTA ELEVENLABS + GhostAI ✓ + ElevenLabs ○ Sin conectar + CTA CONECTAR ELEVENLABS.
 *  - Estado 3: Ambos conectados -> Banner grande oculto (null).
 */

import React from "react";
import { AlertTriangle, KeyRound, Zap, CheckCircle2, Clock, ShieldCheck, ArrowRight } from "lucide-react";

export interface ConnectionAlertProps {
  isAuthenticated: boolean;
  isProviderConnected: boolean;
  clientName?: string | null;
  authErrorMessage?: string | null;
  onConnectGhostAIClick: () => void;
  onConnectElevenLabsClick: () => void;
}

export const ConnectionAlert: React.FC<ConnectionAlertProps> = ({
  isAuthenticated,
  isProviderConnected,
  clientName,
  authErrorMessage,
  onConnectGhostAIClick,
  onConnectElevenLabsClick,
}) => {
  // Estado 3: Ambos conectados -> Ocultar banner grande
  if (isAuthenticated && isProviderConnected) {
    return null;
  }

  // Estado 1: GhostAI desconectado (o token expirado/revocado)
  if (!isAuthenticated) {
    return (
      <div className="connection-alert-container state-ghostai-missing" data-testid="connection-alert">
        <div className="connection-alert-card">
          <div className="connection-alert-header">
            <div className="alert-title-group">
              <span className="alert-icon-badge badge-warning">
                <AlertTriangle size={16} />
              </span>
              <div>
                <h3 className="alert-title" data-testid="alert-title">ACCESO GHOSTAI REQUERIDO</h3>
                <p className="alert-subtitle">
                  {authErrorMessage ? (
                    <span className="text-rose font-medium">{authErrorMessage}</span>
                  ) : (
                    "Conecta tu acceso de GhostAI para utilizar el generador de voz."
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="connection-checklist-grid">
            {/* Fila 1: GhostAI Access (Sin conectar) */}
            <div className="connection-check-row active-required">
              <div className="check-row-left">
                <div className="check-status-indicator status-offline">
                  <span className="status-dot"></span>
                </div>
                <div className="check-text-block">
                  <span className="check-service-name">
                    <KeyRound size={14} className="inline mr-1 text-accent" />
                    GhostAI
                  </span>
                  <span className="check-status-label text-warning">○ Sin conectar</span>
                </div>
              </div>
              <div className="check-row-right">
                <button
                  type="button"
                  className="btn-alert-cta btn-cta-primary"
                  onClick={onConnectGhostAIClick}
                  data-testid="btn-connect-ghostai"
                >
                  <span>CONECTAR GHOSTAI</span>
                  <ArrowRight size={13} className="ml-1" />
                </button>
              </div>
            </div>

            {/* Fila 2: ElevenLabs BYOK (Pendiente - conecta GhostAI primero) */}
            <div className="connection-check-row row-disabled">
              <div className="check-row-left">
                <div className="check-status-indicator status-pending">
                  <Clock size={12} className="text-dim" />
                </div>
                <div className="check-text-block">
                  <span className="check-service-name">
                    <Zap size={14} className="inline mr-1 text-dim" />
                    ElevenLabs
                  </span>
                  <span className="check-status-label text-dim">Pendiente</span>
                </div>
              </div>
              <div className="check-row-right">
                <span className="check-lock-hint">Pendiente — conecta GhostAI primero</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Estado 2: GhostAI conectado, ElevenLabs no conectado
  return (
    <div className="connection-alert-container state-elevenlabs-missing" data-testid="connection-alert">
      <div className="connection-alert-card card-amber">
        <div className="connection-alert-header">
          <div className="alert-title-group">
            <span className="alert-icon-badge badge-amber">
              <Zap size={16} />
            </span>
            <div>
              <h3 className="alert-title" data-testid="alert-title">CONECTA ELEVENLABS</h3>
              <p className="alert-subtitle">
                Conecta tu propia API key de ElevenLabs para generar narraciones. Las generaciones utilizarán los créditos de tu cuenta.
              </p>
            </div>
          </div>
        </div>

        <div className="connection-checklist-grid">
          {/* Fila 1: GhostAI (Conectado) */}
          <div className="connection-check-row row-completed">
            <div className="check-row-left">
              <div className="check-status-indicator status-online">
                <CheckCircle2 size={14} className="text-emerald" />
              </div>
              <div className="check-text-block">
                <span className="check-service-name">GhostAI</span>
                <span className="check-status-label text-emerald">
                  ✓ Conectado {clientName ? `(${clientName})` : ""}
                </span>
              </div>
            </div>
            <div className="check-row-right">
              <span className="badge-identity-verified" data-testid="ghostai-client-badge">
                <ShieldCheck size={12} className="inline mr-1 text-emerald" />
                {clientName || "Operador GhostAI"}
              </span>
            </div>
          </div>

          {/* Fila 2: ElevenLabs (Sin conectar - accionable) */}
          <div className="connection-check-row active-required">
            <div className="check-row-left">
              <div className="check-status-indicator status-offline">
                <span className="status-dot dot-amber"></span>
              </div>
              <div className="check-text-block">
                <span className="check-service-name">ElevenLabs</span>
                <span className="check-status-label text-amber">○ Sin conectar</span>
              </div>
            </div>
            <div className="check-row-right">
              <button
                type="button"
                className="btn-alert-cta btn-cta-amber"
                onClick={onConnectElevenLabsClick}
                data-testid="btn-connect-elevenlabs"
              >
                <span>CONECTAR ELEVENLABS</span>
                <ArrowRight size={13} className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
