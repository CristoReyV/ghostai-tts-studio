/**
 * @file src/components/ProjectOverview.tsx
 * Project status summary cards displaying progress, counts and duration metrics.
 */

import React from "react";
import { CheckCircle2, Clock, AlertTriangle, Volume2, Hash } from "lucide-react";
import type { StudioNarrationItem } from "../types/tts";

interface ProjectOverviewProps {
  items: StudioNarrationItem[];
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({ items }) => {
  const total = items.length;
  const ready = items.filter((i) => i.status === "READY").length;
  const error = items.filter((i) => i.status === "ERROR").length;
  const generating = items.filter((i) => i.status === "GENERATING").length;
  const pending = items.filter((i) => i.status === "PENDING" || i.status === "CANCELLED").length;

  const totalChars = items.reduce((acc, i) => acc + (i.text?.length || 0), 0);
  const totalDurationSecs = items.reduce((acc, i) => acc + (i.duration || 0), 0);

  const formatTotalTime = (secs: number) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const percentage = total > 0 ? Math.round((ready / total) * 100) : 0;

  return (
    <div className="overview-container">
      <div className="stat-card">
        <div className="stat-icon-wrapper bg-blue-subtle">
          <Hash size={18} className="text-blue" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Total Narraciones</span>
          <span className="stat-value">{total}</span>
          <span className="stat-subtext">{totalChars.toLocaleString()} caracteres</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper bg-emerald-subtle">
          <CheckCircle2 size={18} className="text-emerald" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Completadas</span>
          <span className="stat-value text-emerald">{ready}</span>
          <span className="stat-subtext">{percentage}% generado</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper bg-slate-subtle">
          <Clock size={18} className="text-slate" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Pendientes</span>
          <span className="stat-value">{pending}</span>
          <span className="stat-subtext">{generating > 0 ? `${generating} en progreso` : "Esperando generación"}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper bg-rose-subtle">
          <AlertTriangle size={18} className="text-rose" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Errores</span>
          <span className={`stat-value ${error > 0 ? "text-rose" : ""}`}>{error}</span>
          <span className="stat-subtext">{error > 0 ? "Reintentos disponibles" : "Sin incidencias"}</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper bg-purple-subtle">
          <Volume2 size={18} className="text-purple" />
        </div>
        <div className="stat-content">
          <span className="stat-label">Duración Total</span>
          <span className="stat-value text-purple">{formatTotalTime(totalDurationSecs)}</span>
          <span className="stat-subtext">{ready} audios disponibles</span>
        </div>
      </div>
    </div>
  );
};
