/**
 * @file src/components/Header.tsx
 * Top navigation and live Gateway status indicator.
 */

import React from "react";
import { ExternalLink, RefreshCw, Layers } from "lucide-react";
import type { GatewayHealth } from "../types/tts";
import { getGatewayBaseUrl } from "../services/gateway";

interface HeaderProps {
  health: GatewayHealth | null;
  checkingHealth: boolean;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, checkingHealth, onRefreshHealth }) => {
  const gatewayUrl = getGatewayBaseUrl();

  const isHealthy = health?.ok && health.configured;

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-badge">
          <Layers className="logo-icon" size={22} />
        </div>
        <div>
          <div className="brand-row">
            <h1 className="brand-title">GHOSTAI TTS STUDIO</h1>
            <span className="version-tag">v1.0 Bidireccional</span>
          </div>
          <p className="brand-subtitle">
            Generador secuencial de paquetes de voz para GhostAI &amp; ElevenLabs
          </p>
        </div>
      </div>

      <div className="header-right">
        <div className={`gateway-status-card ${isHealthy ? "status-online" : "status-warning"}`}>
          <div className="status-indicator-dot">
            <span className={`pulse-dot ${isHealthy ? "bg-emerald" : "bg-amber"}`}></span>
          </div>

          <div className="status-info">
            <div className="status-label-row">
              <span className="status-text">
                {checkingHealth
                  ? "Verificando Gateway..."
                  : isHealthy
                  ? "Gateway Conectado"
                  : health?.ok
                  ? "Gateway Sin Configurar"
                  : "Gateway Desconectado"}
              </span>
              <span className="provider-tag">{health?.provider || "elevenlabs"}</span>
            </div>

            <div className="gateway-meta-row">
              <a
                href={gatewayUrl}
                target="_blank"
                rel="noreferrer"
                className="gateway-link"
                title="Abrir URL del Gateway"
              >
                <span>{gatewayUrl.replace(/^https?:\/\//, "")}</span>
                <ExternalLink size={10} className="ml-1" />
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefreshHealth}
            disabled={checkingHealth}
            className={`btn-icon-subtle ${checkingHealth ? "spin" : ""}`}
            title="Actualizar estado del Gateway"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};
