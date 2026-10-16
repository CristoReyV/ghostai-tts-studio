/**
 * @file src/components/Admin/AdminActivationScreen.tsx
 * Secure Administrator Activation View.
 * Allows an invited administrator to establish their personal password and enter Studio Admin.
 */

import React, { useState } from "react";
import { Shield, Lock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { activateAdminAccount, type AdminUserIdentity } from "../../services/adminService";

interface AdminActivationScreenProps {
  token: string;
  onActivationSuccess: (admin: AdminUserIdentity) => void;
}

export const AdminActivationScreen: React.FC<AdminActivationScreenProps> = ({
  token,
  onActivationSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const result = await activateAdminAccount(token, password);
      onActivationSuccess(result.admin);
    } catch (err: any) {
      setError(err.message || "Error activando cuenta de administrador.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0b] text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121417] border border-zinc-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
        {/* Accent top stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold tracking-widest uppercase mb-2">
            Invitación de Administrador
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Activa tu cuenta de Administrador
          </h1>
          <p className="text-xs text-zinc-400 mt-2">
            Establece tu contraseña para acceder al panel de control de GhostAI TTS Studio.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-800/50 flex items-start gap-3 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-[#181b1f] border border-zinc-700/80 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pl-10"
              />
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                minLength={8}
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-[#181b1f] border border-zinc-700/80 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pl-10"
              />
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || password.length < 8 || password !== confirmPassword}
            className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Activando cuenta...</span>
              </>
            ) : (
              <>
                <span>Activar Cuenta y Entrar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
          <p className="text-[11px] text-zinc-500">
            GhostAI TTS Platform · Control Plane Seguro
          </p>
        </div>
      </div>
    </div>
  );
};
