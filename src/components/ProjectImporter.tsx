/**
 * @file src/components/ProjectImporter.tsx
 * Project file importer supporting drag-and-drop and instant sample loading.
 */

import React, { useRef, useState } from "react";
import { UploadCloud, FileCode2, AlertCircle, Sparkles, RefreshCcw } from "lucide-react";
import { parseGhostAiTtsJson } from "../services/parser";
import { SAMPLE_GHOSTAI_PROJECT } from "../sampleData";
import type { GhostAiTtsFile, StudioNarrationItem } from "../types/tts";

interface ProjectImporterProps {
  onProjectLoaded: (project: GhostAiTtsFile, items: StudioNarrationItem[]) => void;
  currentProject: GhostAiTtsFile | null;
  onResetProject: () => void;
}

export const ProjectImporter: React.FC<ProjectImporterProps> = ({
  onProjectLoaded,
  currentProject,
  onResetProject,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFileContent = (content: string) => {
    const result = parseGhostAiTtsJson(content);
    if (!result.success || !result.data || !result.studioItems) {
      setValidationErrors(result.errors);
      return;
    }

    setValidationErrors([]);
    onProjectLoaded(result.data, result.studioItems);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessFileContent(text);
    };
    reader.onerror = () => {
      setValidationErrors(["Error al leer el archivo desde el dispositivo."]);
    };
    reader.readAsText(file);
    // Reset file input so re-uploading the same file works
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setValidationErrors(["El archivo debe tener extensión .json o .ghostai-tts.json"]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessFileContent(text);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const jsonStr = JSON.stringify(SAMPLE_GHOSTAI_PROJECT, null, 2);
    handleProcessFileContent(jsonStr);
  };

  if (currentProject) {
    return (
      <div className="project-banner-active">
        <div className="banner-left">
          <div className="file-badge">
            <FileCode2 size={20} className="text-accent" />
          </div>
          <div>
            <div className="project-title-row">
              <h2 className="project-title">{currentProject.project.name}</h2>
              <span className="schema-badge">schema 1.0</span>
            </div>
            <p className="project-meta">
              Exportado: {new Date(currentProject.project.exportedAt).toLocaleString()} • {currentProject.items.length} escenas / narraciones
            </p>
          </div>
        </div>

        <div className="banner-actions">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            title="Importar otro archivo"
          >
            <UploadCloud size={14} className="mr-1.5" />
            Cambiar Proyecto
          </button>
          <button
            type="button"
            onClick={onResetProject}
            className="btn-ghost"
            title="Cerrar proyecto actual"
          >
            <RefreshCcw size={14} className="mr-1.5" />
            Reiniciar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.ghostai-tts.json"
            onChange={handleFileChange}
            className="hidden-file-input"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="importer-card">
      <div
        className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="dropzone-icon-ring">
          <UploadCloud size={32} className="dropzone-icon" />
        </div>

        <h3 className="dropzone-title">Importar Paquete de Narraciones</h3>
        <p className="dropzone-subtitle">
          Arrastra tu archivo <code>.ghostai-tts.json</code> aquí o haz clic para seleccionarlo
        </p>

        <div className="dropzone-footer">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadSample();
            }}
            className="btn-sample"
          >
            <Sparkles size={14} className="mr-1.5" />
            Cargar Proyecto Demo (Lía y el Faro)
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.ghostai-tts.json"
          onChange={handleFileChange}
          className="hidden-file-input"
        />
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-alert">
          <div className="alert-header">
            <AlertCircle size={18} className="text-danger" />
            <span className="alert-title">El archivo no cumple con el formato .ghostai-tts.json:</span>
          </div>
          <ul className="alert-list">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
