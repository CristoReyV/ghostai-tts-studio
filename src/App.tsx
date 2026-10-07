/**
 * @file src/App.tsx
 * Main application container for GhostAI TTS Studio.
 * Orchestrates sequential audio generation, project importing, audio previews,
 * and GhostAI package ZIP exporting.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type {
  GatewayHealth,
  GatewayModel,
  GatewayVoice,
  GhostAiTtsFile,
  StudioNarrationItem,
  ZipDownloadStatus,
} from "./types/tts";
import {
  checkGatewayHealth,
  fetchGatewayModels,
  fetchGatewayVoices,
  generateNarrationAudio,
  getGatewayAuthToken,
  clearGatewayAuthToken,
  connectElevenLabs,
  checkElevenLabsStatus,
  disconnectElevenLabs,
  verifyGatewayAuthToken,
  setOnAuthExpired,
} from "./services/gateway";
import { buildGhostAiTtsPackage, downloadBlob } from "./services/zipBuilder";
import {
  isEmbeddedFrame,
  isDownloadReceiverMode,
  isAdminMode,
  generateBridgeId,
  GHOSTAI_MESSAGE_TYPES,
  type GhostAiZipTransferPayload,
} from "./utils/environment";
import { saveActiveSession, loadActiveSession, clearActiveSession } from "./services/projectStorage";
import { DownloadReceiver } from "./components/DownloadReceiver";
import { AdminDashboard } from "./components/Admin/AdminDashboard";
import { RecoveryVaultSection } from "./components/RecoveryVaultSection";
import { ZipVerificationCard } from "./components/ZipVerificationCard";
import {
  type OfficialCategory,
  type VoiceAvailabilityMap,
  formatVoiceAvailabilityError,
  checkVoicePlanAvailability,
} from "./services/voiceLibrary";
import { Header } from "./components/Header";
import { ConnectionAlert } from "./components/ConnectionAlert";
import { VoiceProviderSection } from "./components/VoiceProviderSection";
import { ProjectImporter } from "./components/ProjectImporter";
import { ProjectOverview } from "./components/ProjectOverview";
import { BatchControls } from "./components/BatchControls";
import { NarrationTable } from "./components/NarrationTable";
import { AuthGate } from "./components/AuthGate";
import { AlertCircle, CheckCircle2, Info, Loader2, Layers } from "lucide-react";

export const App: React.FC = () => {
  const isReceiverMode = useMemo(() => isDownloadReceiverMode(), []);
  if (isReceiverMode) {
    return <DownloadReceiver />;
  }

  const [adminMode, setAdminMode] = useState<boolean>(() => isAdminMode());
  if (adminMode) {
    return (
      <AdminDashboard
        onBackToStudio={() => {
          setAdminMode(false);
          try {
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (_) {}
        }}
      />
    );
  }

  const isEmbedded = useMemo(() => isEmbeddedFrame(), []);

  // Operator authentication state (session-only)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getGatewayAuthToken()));
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(() => Boolean(getGatewayAuthToken()));
  const [clientName, setClientName] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // BYOK ElevenLabs connection state (session-only via HttpOnly cookie)
  const [isProviderConnected, setIsProviderConnected] = useState<boolean>(false);
  const [providerTier, setProviderTier] = useState<string | null>(null);

  // Gateway states
  const [gatewayHealth, setGatewayHealth] = useState<GatewayHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true);
  const [voices, setVoices] = useState<GatewayVoice[]>([]);
  const [models, setModels] = useState<GatewayModel[]>([]);

  // Voice Availability in-memory session registry (unknown | working | failed)
  const [voiceAvailability, setVoiceAvailability] = useState<VoiceAvailabilityMap>({});

  // Project state
  const [currentProject, setCurrentProject] = useState<GhostAiTtsFile | null>(null);
  const [items, setItems] = useState<StudioNarrationItem[]>([]);

  // Batch configuration states
  const [selectedLanguage, setSelectedLanguage] = useState<string>("es");
  const [selectedCategory, setSelectedCategory] = useState<OfficialCategory | "all">("narration");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("eleven_multilingual_v2");
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<string>("mp3_44100_128");

  // Execution states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [systemNotification, setSystemNotification] = useState<{
    type: "success" | "error" | "info" | "warning";
    title?: string;
    message: string;
    fileName?: string;
    meta?: string;
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Control Plane 01: Download State Machine & Recovery tracking
  const [zipStatus, setZipStatus] = useState<ZipDownloadStatus>("not_prepared");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [expectedHashes, setExpectedHashes] = useState<Array<{ narrationId: string; sha256?: string | null }>>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<StudioNarrationItem[]>([]);
  itemsRef.current = items;

  // Cross-window transfer refs for embedded -> top-level bridge
  const pendingTransferRef = useRef<GhostAiZipTransferPayload | null>(null);
  const receiverWindowRef = useRef<WindowProxy | null>(null);
  const activeBridgeIdRef = useRef<string | null>(null);
  const isReceiverReadyRef = useRef<boolean>(false);

  const showToast = useCallback((toast: {
    type: "success" | "error" | "info" | "warning";
    title?: string;
    message: string;
    fileName?: string;
    meta?: string;
  }, durationMs = 5000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setSystemNotification(toast);
    toastTimeoutRef.current = setTimeout(() => {
      setSystemNotification(null);
      toastTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setSystemNotification(null);
  }, []);

  const showNotification = useCallback(
    (type: "success" | "error" | "info" | "warning", message: string, durationMs = 5000) => {
      showToast({ type, message }, durationMs);
    },
    [showToast]
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

      // Pick default voice if not set based on active language (Spanish preferred)
      if (loadedVoices.length > 0 && !selectedVoiceId) {
        const langVoice = loadedVoices.find(
          (v) => (v.labels?.language || "").toLowerCase() === selectedLanguage.toLowerCase()
        );
        setSelectedVoiceId(langVoice ? langVoice.voiceId : loadedVoices[0].voiceId);
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
  }, [selectedVoiceId, selectedLanguage]);

  // When a shared voice is added from Voice Library, append to account collection
  const handleVoiceAdded = useCallback((newVoice: GatewayVoice) => {
    setVoices((prev) => {
      if (prev.some((v) => v.voiceId === newVoice.voiceId)) return prev;
      return [newVoice, ...prev];
    });
  }, []);

  useEffect(() => {
    loadGatewayData();
  }, [loadGatewayData]);

  // Verify token on mount to populate client.name and detect expired token
  useEffect(() => {
    const token = getGatewayAuthToken();
    if (token) {
      setIsCheckingAuth(true);
      verifyGatewayAuthToken(token).then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
          setClientName(res.clientName || null);
          setAuthErrorMessage(null);
        } else {
          clearGatewayAuthToken();
          setIsAuthenticated(false);
          setClientName(null);
          setIsProviderConnected(false);
          setAuthErrorMessage("Tu sesión de GhostAI terminó. Ingresa nuevamente.");
        }
        setIsCheckingAuth(false);
      }).catch(() => {
        clearGatewayAuthToken();
        setIsAuthenticated(false);
        setClientName(null);
        setIsProviderConnected(false);
        setAuthErrorMessage("Tu sesión de GhostAI terminó. Ingresa nuevamente.");
        setIsCheckingAuth(false);
      });
    } else {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    }
  }, []);

  // Listen for global 401 token expiration events
  useEffect(() => {
    setOnAuthExpired(() => {
      setIsAuthenticated(false);
      setClientName(null);
      setIsProviderConnected(false);
      setAuthErrorMessage("Tu sesión de GhostAI terminó. Ingresa nuevamente.");
    });
    return () => setOnAuthExpired(null);
  }, []);

  // Secure postMessage bridge listener for top-level receiver window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Validate window source: must originate from our opened receiver window
      if (receiverWindowRef.current && event.source && event.source !== receiverWindowRef.current) {
        return; // Ignore messages from foreign or unexpected windows
      }

      // 2. Validate bridge pairing ID (must match active operation)
      if (activeBridgeIdRef.current && event.data?.bridgeId !== activeBridgeIdRef.current) {
        return; // Ignore mismatched bridge IDs
      }

      // 3. Strict Origin Validation: accept same origin or opaque origin ("null") if source + bridgeId match
      if (event.origin !== window.location.origin && event.origin !== "null") {
        return; // Reject third-party origins
      }

      // 4. Respond to handshake from receiver window
      if (event.data?.type === GHOSTAI_MESSAGE_TYPES.RECEIVER_READY) {
        isReceiverReadyRef.current = true;
        if (pendingTransferRef.current && receiverWindowRef.current) {
          try {
            receiverWindowRef.current.postMessage(
              {
                type: GHOSTAI_MESSAGE_TYPES.ZIP_TRANSFER,
                bridgeId: activeBridgeIdRef.current,
                payload: pendingTransferRef.current,
              },
              window.location.origin !== "null" ? window.location.origin : "*"
            );
          } catch (err) {
            console.warn("[GhostAI Bridge] Error posting transfer to receiver:", err);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Restore active session from storage if entering top-level or reloading
  useEffect(() => {
    let mounted = true;
    async function restoreSessionIfNeeded() {
      try {
        const session = await loadActiveSession();
        if (mounted && session && session.items.length > 0) {
          setCurrentProject({
            format: "ghostai-tts",
            version: "1.0",
            project: session.project,
            items: session.items,
          });
          setItems(session.items);
          const readyCount = session.items.filter((i) => i.status === "READY").length;
          showNotification(
            "info",
            `Sesión activa restaurada: '${session.project.name}' (${readyCount} narraciones listas).`
          );
        }
      } catch (err) {
        console.warn("[GhostAI Session] Error restoring session:", err);
      }
    }
    restoreSessionIfNeeded();
    return () => {
      mounted = false;
    };
  }, []);

  // CTA navigation helpers for ConnectionAlert
  const handleFocusGhostAILogin = useCallback(() => {
    const input =
      (document.getElementById("ghostai-token-input") as HTMLInputElement | null) ||
      (document.querySelector(".operator-key-input") as HTMLInputElement | null);
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => input.focus(), 300);
    }
  }, []);

  const handleFocusElevenLabs = useCallback(() => {
    const input =
      (document.getElementById("elevenlabs-api-key-input") as HTMLInputElement | null) ||
      (document.querySelector(".provider-key-input") as HTMLInputElement | null);
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => input.focus(), 300);
    } else {
      const section =
        document.getElementById("voice-provider-section") ||
        document.querySelector(".voice-provider-card");
      section?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);


  // Check BYOK ElevenLabs connection status whenever authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      setIsProviderConnected(false);
      return;
    }

    let isMounted = true;
    checkElevenLabsStatus()
      .then((status) => {
        if (isMounted) {
          setIsProviderConnected(Boolean(status?.connected));
          setProviderTier(status?.tier || null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsProviderConnected(false);
          setProviderTier(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleConnectProvider = async (apiKey: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await connectElevenLabs(apiKey);
      if (res.ok) {
        setIsProviderConnected(true);
        showNotification("success", "ElevenLabs conectado correctamente.");
        return { ok: true };
      }
      return { ok: false, message: res.message || "Error al conectar ElevenLabs." };
    } catch (err) {
      const msg = (err as Error).message || "Error al conectar ElevenLabs.";
      return { ok: false, message: msg };
    }
  };

  const handleDisconnectProvider = async (): Promise<void> => {
    try {
      await disconnectElevenLabs();
    } finally {
      setIsProviderConnected(false);
      showNotification("info", "ElevenLabs desconectado.");
    }
  };

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
    setZipStatus("not_prepared");
    setCurrentSessionId(null);
    setExpectedHashes([]);
    clearActiveSession();
  };

  // 3. Unified Global Voice & Settings Selection (Usar voz)
  const handleSelectGlobalVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        voiceId,
      }))
    );
  };

  const handleSelectGlobalModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        modelId,
      }))
    );
  };

  const handleSelectGlobalOutputFormat = (outputFormat: string) => {
    setSelectedOutputFormat(outputFormat);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        outputFormat,
      }))
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

    if (!isAuthenticated) {
      showNotification("error", "Conecta tu acceso para usar esta acción.");
      return;
    }

    if (!isProviderConnected) {
      showNotification("error", "Conecta ElevenLabs para generar narraciones.");
      return;
    }

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

      const voiceToUse = currentItem.voiceId || selectedVoiceId || voices[0]?.voiceId;

      // UX 02: Prevent late error - verify availability against provider capabilities before dispatching synthesis request
      const voiceObj = voices.find((v) => v.voiceId === voiceToUse);
      if (voiceObj) {
        const planCheck = checkVoicePlanAvailability(voiceObj, providerTier);
        if (planCheck.availability === "restricted") {
          failCount++;
          const friendlyMsg =
            planCheck.reason ||
            "Esta voz requiere un plan de ElevenLabs compatible. Puedes elegir una voz disponible con tu cuenta o actualizar tu plan directamente en ElevenLabs.";
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId ? { ...it, status: "ERROR", error: friendlyMsg } : it
            )
          );
          showNotification("warning", friendlyMsg);
          continue; // ZERO calls to ElevenLabs!
        }
      }

      try {
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
          sessionId: currentSessionId || undefined,
          projectId: currentProject?.project.name,
          projectTitle: currentProject?.project.name,
          narrationId: currentItem.id,
          sceneId: currentItem.sceneId,
          sceneIndex: currentItem.sceneIndex,
        });

        if (genResult.sessionId && !currentSessionId) {
          setCurrentSessionId(genResult.sessionId);
        }
        if (genResult.sha256) {
          setExpectedHashes((prev) => [
            ...prev.filter((h) => h.narrationId !== currentItem.id),
            { narrationId: currentItem.id, sha256: genResult.sha256 },
          ]);
        }
        if (genResult.recoveryWarning === "RECOVERY_STORAGE_FAILED") {
          showNotification("warning", "Audio generado correctamente. No se pudo crear la copia temporal de recuperación.");
        }

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

        // Mark voice as working in current session
        setVoiceAvailability((prev) => ({
          ...prev,
          [voiceToUse]: {
            status: "working",
            lastStatus: 200,
            updatedAt: Date.now(),
          },
        }));

        successCount++;
      } catch (err: unknown) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") {
          // Mark this item as CANCELLED
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, status: "CANCELLED" } : it))
          );
          break;
        }

        const statusCode = (err as { statusCode?: number })?.statusCode || 500;
        const errCode = (err as { code?: string })?.code;

        if (statusCode === 401 && (errCode === "AUTH_REQUIRED" || errCode === "AUTH_INVALID")) {
          setIsAuthenticated(false);
          clearGatewayAuthToken();
          failCount++;
          const authMsg = "Conecta tu acceso para usar esta acción.";
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, status: "ERROR", error: authMsg } : it))
          );
          showNotification(
            "error",
            "La clave de acceso de operador no está autorizada o ha expirado. Por favor reconecta."
          );
          break; // Stop immediately - NO automatic retry
        }

        if (
          statusCode === 428 ||
          errCode === "ELEVENLABS_NOT_CONNECTED" ||
          errCode === "ELEVENLABS_INVALID_API_KEY"
        ) {
          setIsProviderConnected(false);
          failCount++;
          const byokMsg = "Conecta ElevenLabs para generar narraciones.";
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, status: "ERROR", error: byokMsg } : it))
          );
          showNotification(
            "error",
            "Se requiere conectar una API key de ElevenLabs válida."
          );
          break; // Stop immediately - NO automatic retry
        }

        const rawMsg = (err as Error).message || "Error al sintetizar voz en Gateway";
        const neutralMsg = formatVoiceAvailabilityError(statusCode, rawMsg);
        failCount++;

        // Mark voice as failed in current session without speculative assertions
        setVoiceAvailability((prev) => ({
          ...prev,
          [voiceToUse]: {
            status: "failed",
            lastStatus: statusCode,
            lastError: neutralMsg,
            updatedAt: Date.now(),
          },
        }));

        // Keep all previously completed items and record clean error on this item
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  status: "ERROR",
                  error: neutralMsg,
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
    if (!isAuthenticated) {
      showNotification("error", "Conecta tu acceso para usar esta acción.");
      return;
    }

    if (!isProviderConnected) {
      showNotification("error", "Conecta ElevenLabs para generar narraciones.");
      return;
    }

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
    if (!isAuthenticated) {
      showNotification("error", "Conecta tu acceso para usar esta acción.");
      return;
    }

    if (!isProviderConnected) {
      showNotification("error", "Conecta ElevenLabs para generar narraciones.");
      return;
    }

    const errorIds = items.filter((it) => it.status === "ERROR").map((it) => it.id);
    if (errorIds.length === 0) return;
    executeSequentialGeneration(errorIds);
  };

  // 8. Generate Single Item
  const handleGenerateSingle = (id: string) => {
    if (!isAuthenticated) {
      showNotification("error", "Conecta tu acceso para usar esta acción.");
      return;
    }

    if (!isProviderConnected) {
      showNotification("error", "Conecta ElevenLabs para generar narraciones.");
      return;
    }

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

  // Safe fallback to open Studio in top-level receiver tab for downloading without sandbox restrictions
  const handleOpenTopLevel = async () => {
    if (!currentProject) return;

    const readyItems = items.filter((it) => it.status === "READY" && it.audioBlob);
    if (readyItems.length === 0) {
      showNotification("error", "No hay audios listos para exportar.");
      return;
    }

    // 1. Generate ephemeral bridge pairing ID synchronously
    const bridgeId = generateBridgeId();
    activeBridgeIdRef.current = bridgeId;
    isReceiverReadyRef.current = false;

    // 2. Open receiver window SYNCHRONOUSLY before any async operations to preserve user activation
    const receiverUrl = `${window.location.origin}${window.location.pathname}?mode=receiver&bridge=${bridgeId}`;
    let popup: WindowProxy | null = null;
    try {
      popup = window.open(receiverUrl, "_blank");
    } catch (_err) {
      popup = null;
    }

    if (!popup) {
      showNotification(
        "error",
        "El navegador bloqueó la nueva pestaña. Permite abrirla o abre GhostAI TTS Studio directamente."
      );
      return;
    }

    receiverWindowRef.current = popup;
    showNotification("info", "Preparando paquete ZIP para la pestaña receptora...");

    // 3. Now build package in memory asynchronously
    try {
      const result = await buildGhostAiTtsPackage({
        project: currentProject.project,
        items,
        includeOnlyReady: true,
      });

      const transferPayload: GhostAiZipTransferPayload = {
        blob: result.blob,
        fileName: result.fileName,
        itemCount: result.itemCount,
        projectName: currentProject.project.name,
        bridgeId,
      };

      pendingTransferRef.current = transferPayload;

      // If receiver already sent handshake, transfer immediately!
      if (isReceiverReadyRef.current && receiverWindowRef.current) {
        try {
          receiverWindowRef.current.postMessage(
            {
              type: GHOSTAI_MESSAGE_TYPES.ZIP_TRANSFER,
              bridgeId,
              payload: transferPayload,
            },
            window.location.origin !== "null" ? window.location.origin : "*"
          );
        } catch (postErr) {
          console.warn("[GhostAI Bridge] Error transferring zip package:", postErr);
        }
      }

      // Persist to IndexedDB as secondary backup
      saveActiveSession(currentProject.project, items).catch(() => {});
    } catch (err) {
      showNotification("error", `Error al preparar archivo ZIP: ${(err as Error).message}`);
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

    // In embedded/sandboxed environments, direct downloads are blocked by Chrome sandbox policy.
    // We do NOT attempt the prohibited download and instead launch the safe postMessage receiver bridge.
    if (isEmbeddedFrame()) {
      showNotification(
        "warning",
        "Entorno embebido (sandbox) detectado: el navegador bloquea descargas directas en este marco. Abriendo receptor seguro en pestaña nueva..."
      );
      setZipStatus("download_triggered");
      setTimeout(() => setZipStatus("verification_pending"), 50);
      handleOpenTopLevel();
      return;
    }

    try {
      const result = await buildGhostAiTtsPackage({
        project: currentProject.project,
        items,
        includeOnlyReady: true,
      });

      setZipStatus("prepared");
      downloadBlob(result.blob, result.fileName);
      setZipStatus("download_triggered");
      setTimeout(() => setZipStatus("verification_pending"), 50);

      showToast({
        type: "success",
        title: "ZIP exportado correctamente",
        message: result.fileName,
        fileName: result.fileName,
        meta: `${result.itemCount} audio${result.itemCount === 1 ? "" : "s"} · Listo para verificar`,
      }, 5000);
    } catch (err) {
      setZipStatus("failed");
      showNotification("error", `Error al crear archivo ZIP: ${(err as Error).message}`);
    }
  };

  const hasErrors = items.some((it) => it.status === "ERROR");
  const readyItemsCount = items.filter((it) => it.status === "READY").length;

  if (isCheckingAuth) {
    return (
      <div className="auth-gate-splash" data-testid="auth-splash">
        <div className="auth-gate-splash-inner">
          <div className="auth-gate-logo-badge animate-pulse">
            <Layers size={32} className="auth-gate-logo-icon" />
          </div>
          <h2 className="brand-title" style={{ marginTop: "1rem", fontSize: "1.2rem" }}>GHOSTAI TTS STUDIO</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            <Loader2 size={16} className="spin text-cyan-400" />
            <span>Verificando sesión GhostAI...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGate
        onLoginSuccess={(newClientName) => {
          setIsAuthenticated(true);
          setClientName(newClientName);
          setAuthErrorMessage(null);
          checkElevenLabsStatus().then((s) => setIsProviderConnected(Boolean(s.connected))).catch(() => {});
        }}
        initialError={authErrorMessage}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Compact Toast Notification */}
      {systemNotification && (
        <div
          className={`compact-toast compact-toast-${systemNotification.type}`}
          role="status"
          aria-live="polite"
          data-testid="compact-toast"
        >
          <div className="compact-toast-header">
            <div className="compact-toast-title-row">
              {systemNotification.type === "success" && (
                <CheckCircle2 size={16} className="compact-toast-icon text-emerald" />
              )}
              {systemNotification.type === "error" && (
                <AlertCircle size={16} className="compact-toast-icon text-rose" />
              )}
              {systemNotification.type === "info" && (
                <Info size={16} className="compact-toast-icon text-blue" />
              )}
              {systemNotification.type === "warning" && (
                <AlertCircle size={16} className="compact-toast-icon text-amber" />
              )}
              <span className="compact-toast-title">
                {systemNotification.title || (systemNotification.type === "success" ? "Operación exitosa" : "Notificación")}
              </span>
            </div>
            <button
              type="button"
              className="compact-toast-close"
              onClick={closeToast}
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>

          {systemNotification.fileName && (
            <div className="compact-toast-filename" title={systemNotification.fileName}>
              {systemNotification.fileName}
            </div>
          )}

          <div className="compact-toast-meta">
            {systemNotification.meta || systemNotification.message}
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        health={gatewayHealth}
        checkingHealth={checkingHealth}
        onRefreshHealth={loadGatewayData}
        isAuthenticated={isAuthenticated}
        onAuthStateChange={(auth) => {
          setIsAuthenticated(auth);
          if (!auth) {
            setClientName(null);
            setIsProviderConnected(false);
          } else {
            setAuthErrorMessage(null);
          }
        }}
        isProviderConnected={isProviderConnected}
        clientName={clientName}
        onClientNameChange={setClientName}
      />

      {/* Connection Alert Banner — immediately beneath Header */}
      <ConnectionAlert
        isAuthenticated={isAuthenticated}
        isProviderConnected={isProviderConnected}
        clientName={clientName}
        authErrorMessage={authErrorMessage}
        onConnectGhostAIClick={handleFocusGhostAILogin}
        onConnectElevenLabsClick={handleFocusElevenLabs}
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

        {/* Standalone Voice Provider Section if GhostAI is connected but no project loaded yet */}
        {!currentProject && isAuthenticated && (
          <section className="section-standalone-provider" id="voice-provider-section">
            <VoiceProviderSection
              isProviderConnected={isProviderConnected}
              onConnect={handleConnectProvider}
              onDisconnect={handleDisconnectProvider}
              isAuthenticated={isAuthenticated}
              providerTier={providerTier}
            />
          </section>
        )}

        {/* Standalone Temporary Recovery Vault when no project loaded */}
        {!currentProject && isAuthenticated && (
          <section className="section-standalone-recovery" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
            <RecoveryVaultSection
              isAuthenticated={isAuthenticated}
              hasActiveProject={false}
              onRestoreProject={(restoredProject, restoredItems) => {
                setCurrentProject(restoredProject);
                setItems(restoredItems);
                setZipStatus("not_prepared");
              }}
              onNotification={showNotification}
            />
          </section>
        )}

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
                selectedLanguage={selectedLanguage}
                selectedCategory={selectedCategory}
                availabilityMap={voiceAvailability}
                onSelectLanguage={setSelectedLanguage}
                onSelectCategory={setSelectedCategory}
                onSelectVoice={handleSelectGlobalVoice}
                onSelectModel={handleSelectGlobalModel}
                onSelectOutputFormat={handleSelectGlobalOutputFormat}
                onVoiceAdded={handleVoiceAdded}
                isGenerating={isGenerating}
                onGenerateAll={handleGenerateAll}
                onCancelGeneration={handleCancelGeneration}
                onRetryFailed={handleRetryFailed}
                onExportZip={handleExportZip}
                hasErrors={hasErrors}
                hasReadyItems={readyItemsCount > 0}
                readyCount={readyItemsCount}
                totalCount={items.length}
                isAuthenticated={isAuthenticated}
                isProviderConnected={isProviderConnected}
                onConnectProvider={handleConnectProvider}
                onDisconnectProvider={handleDisconnectProvider}
                isEmbedded={isEmbedded}
                onOpenTopLevel={handleOpenTopLevel}
              />

              {/* ZIP Verification CTA & Feedback Card */}
              <ZipVerificationCard
                status={zipStatus}
                currentSessionId={currentSessionId}
                expectedItemCount={readyItemsCount}
                expectedItems={expectedHashes}
                onStatusChange={setZipStatus}
                onRetryDownload={handleExportZip}
                onNotification={showNotification}
              />
            </section>

            {/* Temporary Recovery Vault Section */}
            <section className="section-project-recovery" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
              <RecoveryVaultSection
                isAuthenticated={isAuthenticated}
                hasActiveProject={true}
                onRestoreProject={(restoredProject, restoredItems) => {
                  setCurrentProject(restoredProject);
                  setItems(restoredItems);
                  setZipStatus("not_prepared");
                }}
                onNotification={showNotification}
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
          GhostAI TTS Studio • <span className="powered-by-brand">Powered by SmartBrain</span>
        </p>
      </footer>
    </div>
  );
};

export default App;
