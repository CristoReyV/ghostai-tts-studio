/**
 * @file src/components/ActivationScreen.tsx
 * Activation screen for invited members accessing via ?activate=<token>.
 * Consumes single-use activationToken, retrieves member credentials,
 * sets sessionStorage auth, and transitions directly into the authenticated Studio.
 */

import React, { useState, useEffect } from "react";
import { Layers, CheckCircle2, AlertCircle, Loader2, ArrowRight, Calendar, ShieldCheck, Sparkles } from "lucide-react";
import { type ActivationResponse } from "../services/adminService";
import { activateOnce, persistActivationCredential } from "../services/activationRecovery";

interface ActivationScreenProps {
  token: string;
  onActivationSuccess: (clientName: string) => void;
  onCancel: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({
  token,
  onActivationSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActivationResponse | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [consumed, setConsumed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function performActivation() {
      setLoading(true);
      setError(null);
      try {
        const res = await activateOnce(token);
        if (!isMounted) return;
        const saved = persistActivationCredential(res);
        setPersisted(saved);
        if (saved) {
          const url = new URL(window.location.href);
          url.searchParams.delete("activate"); url.searchParams.delete("token");
          window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        }
        setResult(res);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setConsumed((err as Error & { code?: string }).code === "TOKEN_ALREADY_USED");
        setError((err as Error).message || "No se pudo validar el enlace de activación.");
        setLoading(false);
      }
    }

    performActivation();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleEnterStudio = () => {
    if (result) {
      onActivationSuccess(result.clientName);
    }
  };

  const planLabel = result?.accessPlan === "annual" ? "Anual" : "Mensual";
  const formattedExpires = result?.expiresAt
    ? new Date(result.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#080c14",
        padding: "1.5rem",
        color: "#f8fafc",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", marginBottom: "1.25rem" }}>
          <Layers size={40} />
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: "800", letterSpacing: "0.02em", margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
          GHOSTAI TTS STUDIO
        </h1>

        {loading && (
          <div style={{ padding: "2rem 0" }}>
            <Loader2 className="animate-spin text-cyan-400" size={36} style={{ margin: "0 auto 1rem auto" }} />
            <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#e2e8f0", margin: "0 0 0.5rem 0" }}>
              Activando tu acceso personal...
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
              Validando credenciales criptográficas y configurando tu espacio de trabajo.
            </p>
          </div>
        )}

        {error && (
          <div style={{ padding: "1rem 0" }}>
            <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e", marginBottom: "1rem" }}>
              <AlertCircle size={32} />
            </div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#fda4af", margin: "0 0 0.5rem 0" }}>
              {consumed ? "Este enlace ya fue utilizado." : "No se pudo activar el acceso"}
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 1.5rem 0", lineHeight: "1.5" }}>
              {consumed ? "Si ya activaste tu acceso, entra usando tu GhostAI Key." : error}
            </p>
            <button
              onClick={onCancel}
              style={{
                width: "100%",
                padding: "0.75rem 1.25rem",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                fontWeight: "600",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              ENTRAR CON KEY
            </button>
          </div>
        )}

        {result && !loading && !error && (
          <div style={{ padding: "0.5rem 0" }}>
            {!persisted && <div role="alert" style={{ background: "#312315", border: "1px solid #f59e0b", padding: "1rem", marginBottom: "1rem", overflowWrap: "anywhere" }}><p>Tu acceso fue activado. Guarda esta key para entrar manualmente.</p><code style={{ userSelect: "text" }}>{result.accessKey}</code><p>Tu navegador no pudo guardar la credencial. También puedes recuperarla desde tu correo.</p></div>}
            <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", marginBottom: "1rem" }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#f8fafc", margin: "0 0 0.35rem 0" }}>
              ¡Acceso Activado con Éxito!
            </h2>

            <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: "0 0 1.5rem 0" }}>
              Bienvenido, <strong style={{ color: "#f8fafc" }}>{result.clientName}</strong>. Tu suscripción ya está en vigor.
            </p>

            {/* Plan Card */}
            <div
              style={{
                background: "#080c14",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "1.25rem",
                marginBottom: "1.5rem",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>
                  PLAN ACTIVO
                </span>
                <span
                  style={{
                    padding: "0.25rem 0.6rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    background: result.accessPlan === "annual" ? "rgba(168, 85, 247, 0.2)" : "rgba(56, 189, 248, 0.2)",
                    color: result.accessPlan === "annual" ? "#c084fc" : "#38bdf8",
                  }}
                >
                  {planLabel}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#cbd5e1", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                <Calendar size={15} className="text-cyan-400" />
                <span>Vigente hasta: <strong style={{ color: "#f8fafc" }}>{formattedExpires}</strong></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", fontSize: "0.75rem" }}>
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>GhostAI Key individual vinculada a tu cuenta</span>
              </div>
            </div>

            <button
              onClick={handleEnterStudio}
              style={{
                width: "100%",
                padding: "0.85rem 1.25rem",
                background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                border: "none",
                borderRadius: "10px",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "0.95rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)",
              }}
            >
              <Sparkles size={18} />
              <span>ENTRAR AL STUDIO</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
