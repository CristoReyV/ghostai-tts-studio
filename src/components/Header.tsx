/**
 * @file src/components/Header.tsx
 * Top navigation and discrete session status.
 *
 * Public UI: Zero exposure of internal gateway URLs, domains, endpoints or infrastructure.
 */

import React from "react";
import { Layers } from "lucide-react";
import type { GatewayHealth } from "../types/tts";
import { OperatorAccess } from "./OperatorAccess";

interface HeaderProps {
  health?: GatewayHealth | null;
  checkingHealth?: boolean;
  onRefreshHealth?: () => void;
  isAuthenticated: boolean;
  onAuthStateChange: (authenticated: boolean) => void;
  isProviderConnected?: boolean;
  clientName?: string | null;
  onClientNameChange?: (name: string | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAuthenticated,
  onAuthStateChange,
  isProviderConnected = false,
  clientName,
  onClientNameChange,
}) => {
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
        {/* Compact Badges when connected */}
        <div className="header-connection-badges" data-testid="header-connection-badges">
          {isAuthenticated && (
            <span
              className="badge-compact-status badge-ghostai-status"
              data-testid="header-ghostai-badge"
              title={`GhostAI Conectado${clientName ? ` (${clientName})` : ""}`}
            >
              GhostAI ✓{clientName ? ` · ${clientName}` : ""}
            </span>
          )}
          {isProviderConnected && (
            <span
              className="badge-compact-status badge-elevenlabs-status"
              data-testid="header-elevenlabs-badge"
              title="ElevenLabs Conectado"
            >
              ElevenLabs ✓
            </span>
          )}
        </div>

        <OperatorAccess
          isAuthenticated={isAuthenticated}
          onAuthStateChange={onAuthStateChange}
          clientName={clientName}
          onClientNameChange={onClientNameChange}
        />
      </div>
    </header>
  );
};
