/**
 * @file src/App.tsx
 * Main application container for GhostAI TTS Studio.
 * Orchestrates sequential audio generation, project importing, audio previews,
 * and GhostAI package ZIP exporting.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import type {
  GatewayHealth,
  GatewayModel,
  GatewayVoice,
  GhostAiTtsFile,
  StudioNarrationItem,
} from "./types/tts";
import {
  checkGatewayHealth,
  fetchGatewayModels,
  fetchGatewayVoices,
  generateNarrationAudio,
} from "./services/gateway";
import { buildGhostAiTtsPackage, triggerBlobDownload } from "./services/zipBuilder";
import { Header } from "./components/Header";
import { ProjectImporter } from "./components/ProjectImporter";
import { ProjectOverview } from "./components/ProjectOverview";
import { BatchControls } from "./components/BatchControls";
import { NarrationTable } from "./components/NarrationTable";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export const App: React.FC = () => {
  // Gateway states
  const [gatewayHealth, setGatewayHealth] = useState<GatewayHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true);
  const [voices, setVoices] = useState<GatewayVoice[]>([]);
  const [models, setModels] = useState<GatewayModel[]>([]);

  // Project state
  const [currentProject, setCurrentProject] = useState<GhostAiTtsFile | null>(null);
  const [items, setItems] = useState<StudioNarrationItem[]>([]);

  // Batch configuration states
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("eleven_multilingual_v2");
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<string>("mp3_44100_128");

  // Execution states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [systemNotification, setSystemNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<StudioNarrationItem[]>([]);
  itemsRef.current = items;

  const showNotification = useCallback(
    (type: "success" | "error" | "info", message: string, durationMs = 4500) => {
      setSystemNotification({ type, message });
      setTimeout(() => setSystemNotification(null), durationMs);
    },
    []
  );

  // 1. Initialise Gateway Connection and fetch available voices & models
  const loadGatewayData = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const health = await checkGatewayHealth();
      setGatewayHealth(health);

      const [loadedVoices, loadedModels] = await Promise.all([
        fetchGatewayVoices().catch(() => []),
        fetchGatewayModels().catch(() => []),
      ]);

      setVoices(loadedVoices);
      setModels(loadedModels);

      // Pick default voice if not set
      if (loadedVoices.length > 0 && !selectedVoiceId) {
        // Prefer Roger or the first voice
        const preferred = loadedVoices.find((v) => v.name.toLowerCase().includes("roger")) || loadedVoices[0];
        setSelectedVoiceId(preferred.voiceId);
      }
    } catch (err) {
      console.warn("Error conectando al Gateway:", err);
      setGatewayHealth({
        ok: false,
        service: "ghostai-tts-gateway",
        version: "unknown",
        provider: "elevenlabs",
        configured: false,
      });
    } finally {
      setCheckingHealth(false);
    }
  }, [selectedVoiceId]);

  useEffect(() => {
    loadGatewayData();
  }, [loadGatewayData]);

  // Clean up object URLs when unmounting or resetting
  const cleanupAudioUrls = (itemsList: StudioNarrationItem[]) => {
    itemsList.forEach((it) => {
      if (it.audioUrl) {
        URL.revokeObjectURL(it.audioUrl);
      }
    });
  };

  // 2. Handle Project Loading
  const handleProjectLoaded = (project: GhostAiTtsFile, initialItems: StudioNarrationItem[]) => {
    cleanupAudioUrls(items);

    // Apply default voice/model if item didn't have one specified
    const preppedItems = initialItems.map((item) => ({
      ...item,
      voiceId: item.voiceId || selectedVoiceId || (voices[0]?.voiceId ?? ""),
      modelId: item.modelId || selectedModelId || "eleven_multilingual_v2",
      outputFormat: item.outputFormat || selectedOutputFormat || "mp3_44100_128",
    }));

    setCurrentProject(project);
    setItems(preppedItems);
    showNotification("success", `Proyecto '${project.project.name}' importado con ${preppedItems.length} narraciones.`);
  };

  const handleResetProject = () => {
    if (isGenerating) {
      handleCancelGeneration();
    }
    cleanupAudioUrls(items);
    setCurrentProject(null);
    setItems([]);
  };

  // 3. Batch Apply Voice & Model to Pending Items
  const handleApplyToPending = () => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.status === "PENDING" || item.status === "CANCELLED" || item.status === "ERROR") {
          return {
            ...item,
            voiceId: selectedVoiceId || item.voiceId,
            modelId: selectedModelId || item.modelId,
            outputFormat: selectedOutputFormat || item.outputFormat,
          };
        }
        return item;
      })
    );
  };

  // 4. Update Single Item Voice/Model
  const handleUpdateItemVoice = (id: string, voiceId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, voiceId } : item))
    );
  };

  const handleUpdateItemModel = (id: string, modelId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, modelId } : item))
    );
  };

  const handleUpdateDuration = (id: string, durationSecs: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, duration: durationSecs } : item))
    );
  };

  // 5. Sequential Audio Generator Core Engine
  const executeSequentialGeneration = async (targetItemIds: string[]) => {
    if (targetItemIds.length === 0) return;

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetItemIds.length; i++) {
      if (controller.signal.aborted) {
        break;
      }

      const itemId = targetItemIds[i];
      const currentItem = itemsRef.current.find((it) => it.id === itemId);
      if (!currentItem) continue;

      // Mark this specific item as GENERATING
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: "GENERATING", error: undefined } : it))
      );

      try {
        const voiceToUse = currentItem.voiceId || selectedVoiceId || voices[0]?.voiceId;
        if (!voiceToUse) {
          throw new Error("No hay una voz de ElevenLabs seleccionada para esta narración.");
        }

        const genResult = await generateNarrationAudio({
          voiceId: voiceToUse,
          text: currentItem.text,
          modelId: currentItem.modelId || selectedModelId,
          outputFormat: currentItem.outputFormat || selectedOutputFormat,
          voiceSettings: currentItem.voiceSettings,
          languageCode: currentItem.language,
          signal: controller.signal,
        });

        // Revoke previous audioUrl if re-generating
        if (currentItem.audioUrl) {
          URL.revokeObjectURL(currentItem.audioUrl);
        }

        const newAudioUrl = URL.createObjectURL(genResult.blob);

        // Mark item as READY with binary blob preserved
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  status: "READY",
                  audioBlob: genResult.blob,
                  audioUrl: newAudioUrl,
                  requestId: genResult.requestId,
                  responseBytes: genResult.blob.size,
                  error: undefined,
                }
              : it
          )
        );

        successCount++;
      } catch (err: unknown) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") {
          // Mark this item as CANCELLED
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, status: "CANCELLED" } : it))
          );
          break;
        }

        const errMsg = (err as Error).message || "Error al sintetizar voz en Gateway";
        failCount++;

        // Keep all previously completed items and record error on this item
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  status: "ERROR",
                  error: errMsg,
                }
              : it
          )
        );
      }
    }

    setIsGenerating(false);
    abortControllerRef.current = null;

    if (failCount > 0) {
      showNotification(
        "error",
        `Generación completada: ${successCount} exitosos, ${failCount} con error. Puedes reintentar los fallidos.`
      );
    } else if (successCount > 0) {
      showNotification("success", `¡Todas las ${successCount} narraciones se generaron exitosamente!`);
    }
  };

  // 6. Generate All (Pending / Cancelled / Error)
  const handleGenerateAll = () => {
    const pendingIds = items
      .filter((it) => it.status !== "READY")
      .map((it) => it.id);

    if (pendingIds.length === 0) {
      showNotification("info", "Todas las narraciones ya están completadas.");
      return;
    }

    executeSequentialGeneration(pendingIds);
  };

  // 7. Retry Failed Only
  const handleRetryFailed = () => {
    const errorIds = items.filter((it) => it.status === "ERROR").map((it) => it.id);
    if (errorIds.length === 0) return;
    executeSequentialGeneration(errorIds);
  };

  // 8. Generate Single Item
  const handleGenerateSingle = (id: string) => {
    executeSequentialGeneration([id]);
  };

  // 9. Cancel Running Generation
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      showNotification("info", "Secuencia de generación cancelada.");
    }
  };

  // 10. Export .ghostai-tts-package.zip
  const handleExportZip = async () => {
    if (!currentProject) return;

    const readyItems = items.filter((it) => it.status === "READY" && it.audioBlob);
    if (readyItems.length === 0) {
      showNotification("error", "No hay audios listos para exportar.");
      return;
    }

    try {
      const result = await buildGhostAiTtsPackage({
        project: currentProject.project,
        items,
        includeOnlyReady: true,
      });

      triggerBlobDownload(result.blob, result.fileName);
      showNotification(
        "success",
        `Paquete '${result.fileName}' exportado correctamente (${result.itemCount} audios).`
      );
    } catch (err) {
      showNotification("error", `Error al crear archivo ZIP: ${(err as Error).message}`);
    }
  };

  const hasErrors = items.some((it) => it.status === "ERROR");
  const readyItemsCount = items.filter((it) => it.status === "READY").length;

  return (
    <div className="app-layout">
      {/* Notifications Toast */}
      {systemNotification && (
        <div className={`toast-notification toast-${systemNotification.type}`}>
          {systemNotification.type === "success" && <CheckCircle size={16} className="mr-2 text-emerald" />}
          {systemNotification.type === "error" && <AlertCircle size={16} className="mr-2 text-rose" />}
          {systemNotification.type === "info" && <Info size={16} className="mr-2 text-blue" />}
          <span>{systemNotification.message}</span>
        </div>
      )}

      {/* Header */}
      <Header
        health={gatewayHealth}
        checkingHealth={checkingHealth}
        onRefreshHealth={loadGatewayData}
      />

      {/* Main Content Area */}
      <main className="app-main">
        {/* Importer Section */}
        <section className="section-importer">
          <ProjectImporter
            onProjectLoaded={handleProjectLoaded}
            currentProject={currentProject}
            onResetProject={handleResetProject}
          />
        </section>

        {currentProject && (
          <>
            {/* Overview Stats */}
            <section className="section-overview">
              <ProjectOverview items={items} />
            </section>

            {/* Batch Action Controls */}
            <section className="section-controls">
              <BatchControls
                voices={voices}
                models={models}
                selectedVoiceId={selectedVoiceId}
                selectedModelId={selectedModelId}
                selectedOutputFormat={selectedOutputFormat}
                onSelectVoice={setSelectedVoiceId}
                onSelectModel={setSelectedModelId}
                onSelectOutputFormat={setSelectedOutputFormat}
                onApplyToPending={handleApplyToPending}
                isGenerating={isGenerating}
                onGenerateAll={handleGenerateAll}
                onCancelGeneration={handleCancelGeneration}
                onRetryFailed={handleRetryFailed}
                onExportZip={handleExportZip}
                hasErrors={hasErrors}
                hasReadyItems={readyItemsCount > 0}
                readyCount={readyItemsCount}
                totalCount={items.length}
              />
            </section>

            {/* Narration Table */}
            <section className="section-table">
              <NarrationTable
                items={items}
                voices={voices}
                models={models}
                isGeneratingAny={isGenerating}
                onGenerateSingle={handleGenerateSingle}
                onUpdateItemVoice={handleUpdateItemVoice}
                onUpdateItemModel={handleUpdateItemModel}
                onUpdateDuration={handleUpdateDuration}
              />
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          GhostAI TTS Studio • Conectado a{" "}
          <span className="footer-code">https://tts-test.smartbrain.lat</span> • Compatible con exportación GhostAI
        </p>
      </footer>
    </div>
  );
};

export default App;
