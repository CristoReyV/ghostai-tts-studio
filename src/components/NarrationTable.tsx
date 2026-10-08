/**
 * @file src/components/NarrationTable.tsx
 * Container table for narration items with search and status filtering.
 */

import React, { useState } from "react";
import { Search, Layers } from "lucide-react";
import type { GatewayModel, GatewayVoice, StudioNarrationItem } from "../types/tts";
import { NarrationRow } from "./NarrationRow";

interface NarrationTableProps {
  items: StudioNarrationItem[];
  voices: GatewayVoice[];
  models: GatewayModel[];
  isGeneratingAny: boolean;
  providerTier?: string | null;
  onGenerateSingle: (id: string) => void;
  onUpdateItemVoice: (id: string, voiceId: string) => void;
  onUpdateItemModel: (id: string, modelId: string) => void;
  onUpdateDuration: (id: string, durationSecs: number) => void;
}

type FilterStatus = "ALL" | "PENDING" | "READY" | "ERROR";

export const NarrationTable: React.FC<NarrationTableProps> = ({
  items,
  voices,
  models,
  isGeneratingAny,
  providerTier,
  onGenerateSingle,
  onUpdateItemVoice,
  onUpdateItemModel,
  onUpdateDuration,
}) => {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [search, setSearch] = useState<string>("");

  const filteredItems = items.filter((item) => {
    // Filter by status
    if (filter === "READY" && item.status !== "READY") return false;
    if (filter === "ERROR" && item.status !== "ERROR") return false;
    if (filter === "PENDING" && item.status !== "PENDING" && item.status !== "CANCELLED") return false;

    // Search by text, id, or sceneId
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchText = item.text.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      const matchScene = item.sceneId.toLowerCase().includes(q);
      return matchText || matchId || matchScene;
    }

    return true;
  });

  return (
    <div className="table-container-card">
      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-left">
          <div className="filter-pills">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`filter-pill ${filter === "ALL" ? "filter-pill-active" : ""}`}
            >
              Todos ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("PENDING")}
              className={`filter-pill ${filter === "PENDING" ? "filter-pill-active" : ""}`}
            >
              Pendientes ({items.filter((i) => i.status === "PENDING" || i.status === "CANCELLED").length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("READY")}
              className={`filter-pill ${filter === "READY" ? "filter-pill-active" : ""}`}
            >
              Completados ({items.filter((i) => i.status === "READY").length})
            </button>
            {items.some((i) => i.status === "ERROR") && (
              <button
                type="button"
                onClick={() => setFilter("ERROR")}
                className={`filter-pill filter-pill-error ${filter === "ERROR" ? "filter-pill-active" : ""}`}
              >
                Errores ({items.filter((i) => i.status === "ERROR").length})
              </button>
            )}
          </div>
        </div>

        <div className="toolbar-right">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por texto, ID o escena..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="narration-table">
          <thead>
            <tr>
              <th className="th-index-id"># / ID / Escena</th>
              <th className="th-text">Guión / Texto de Narración</th>
              <th className="th-voice-model">Voz &amp; Modelo</th>
              <th className="th-status">Estado</th>
              <th className="th-audio">Reproductor de Audio</th>
              <th className="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-table-cell">
                  <div className="empty-table-state">
                    <Layers size={28} className="text-muted mb-2" />
                    <p className="empty-title">No hay narraciones que coincidan con el filtro</p>
                    <p className="empty-subtitle">Intenta cambiar el filtro de búsqueda o estado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const originalIndex = items.findIndex((orig) => orig.id === item.id);
                return (
                  <NarrationRow
                    key={item.id}
                    item={item}
                    index={originalIndex >= 0 ? originalIndex : 0}
                    voices={voices}
                    models={models}
                    isGeneratingAny={isGeneratingAny}
                    providerTier={providerTier}
                    onGenerateSingle={onGenerateSingle}
                    onUpdateItemVoice={onUpdateItemVoice}
                    onUpdateItemModel={onUpdateItemModel}
                    onUpdateDuration={onUpdateDuration}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
