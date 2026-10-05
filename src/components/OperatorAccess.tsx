/**
 * @file src/components/OperatorAccess.tsx
 * Professional session-only operator authentication widget for GhostAI TTS Gateway.
 */

import React, { useState } from "react";
import { KeyRound, ShieldCheck, Loader2, AlertCircle, LogOut } from "lucide-react";
import {
  setGatewayAuthToken,
  clearGatewayAuthToken,
  verifyGatewayAuthToken,
} from "../services/gateway";

export interface OperatorAccessProps {
  isAuthenticated: boolean;
  onAuthStateChange: (authenticated: boolean) => void;
}

export const OperatorAccess: React.FC<OperatorAccessProps> = ({
  isAuthenticated,
  onAuthStateChange,
}) => {
  const [tokenInput, setTokenInput] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setErrorMsg("Introduce la clave de acceso.");
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const result = await verifyGatewayAuthToken(trimmed);
      if (result.ok) {
        setGatewayAuthToken(trimmed);
        setTokenInput(""); // Immediately clear plain text password from component memory
        setErrorMsg(null);
        onAuthStateChange(true);
      } else {
        clearGatewayAuthToken();
        setErrorMsg(result.message || "Clave no autorizada.");
        onAuthStateChange(false);
      }
    } catch (err) {
      clearGatewayAuthToken();
      setErrorMsg(`Error de conexión: ${(err as Error).message}`);
      onAuthStateChange(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    clearGatewayAuthToken();
    setTokenInput("");
    setErrorMsg(null);
    onAuthStateChange(false);
  };

  if (isAuthenticated) {
    return (
      <div className="operator-access-card connected">
        <div className="operator-connected-info">
          <ShieldCheck size={16} className="text-emerald mr-1.5" />
          <span className="operator-status-text">Operador Conectado</span>
        </div>
        <button
          type="button"
          className="btn-operator-disconnect"
          onClick={handleDisconnect}
          title="Desconectar clave de acceso del operador (elimina de sesión)"
        >
          <LogOut size={12} className="mr-1" />
          <span>DESCONECTAR</span>
        </button>
      </div>
    );
  }

  return (
    <form className="operator-access-card" onSubmit={handleConnect}>
      <div className="operator-input-wrapper">
        <KeyRound size={14} className="operator-key-icon" />
        <input
          type="password"
          className="operator-key-input"
          placeholder="Clave de acceso de GhostAI"
          value={tokenInput}
          onChange={(e) => {
            setTokenInput(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          disabled={isVerifying}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn-operator-connect"
          disabled={isVerifying || !tokenInput.trim()}
          title="Verificar y conectar clave de acceso"
        >
          {isVerifying ? (
            <>
              <Loader2 size={12} className="spin mr-1" />
              <span>VERIFICANDO...</span>
            </>
          ) : (
            <span>CONECTAR</span>
          )}
        </button>
      </div>
      {errorMsg && (
        <div className="operator-error-banner" role="alert">
          <AlertCircle size={12} className="mr-1 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </form>
  );
};
