/**
 * @file src/components/BatchControls.tsx
 * GhostAI TTS Studio — UX 03.3:
 * SEPARATE "VOICES I CAN USE" (SECTION A) FROM "VOICE LIBRARY" (SECTION B)
 *
 * Information Architecture:
 * SECTION A (PRIMARY): VOCES DISPONIBLES CON TU PLAN (Account voices evaluated for positive API usability)
 * SECTION B (SECONDARY): VOICE LIBRARY DE ELEVENLABS (Community exploration, plan-restricted on Free)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  RotateCcw,
  Square,
  PackageCheck,
  Volume2,
  VolumeX,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
  Mic,
  Search,
  X,
  Filter,
  Loader2,
  AlertCircle,
  BookmarkCheck,
  Tag,
  Info,
  Lock,
} from "lucide-react";
import type {
  GatewayModel,
  GatewayVoice,
  VoiceLibraryVoice,
  VoiceLibraryQueryParams,
  VoiceOrigin,
} from "../types/tts";
import {
  fetchVoiceLibrary,
  addSharedVoiceToAccount,
} from "../services/gateway";
import { VoiceProviderSection } from "./VoiceProviderSection";
import {
  OFFICIAL_LANGUAGES,
  USE_CASE_OPTIONS,
  COMMON_LANGUAGE_ACCENTS,
  type OfficialCategory,
  type VoiceAvailabilityMap,
  translateLanguage,
  translateAccent,
  translateGender,
  translateAge,
  translateUseCase,
  translateDescriptiveTag,
  getModelDescription,
  checkVoicePlanAvailability,
  type VoiceCatalogFilter,
  computeVoiceCatalogCounts,
  filterAndSortVoiceCatalog,
  getVoicePlanHelperText,
  getVoicePlanBadgeLabel,
  mergeVoiceProvenance,
} from "../services/voiceLibrary";

export const CATALOG_PAGE_SIZE = 12;

export interface BatchControlsProps {
  voices: GatewayVoice[];
  models: GatewayModel[];
  selectedVoiceId: string;
  selectedModelId: string;
  selectedOutputFormat: string;
  selectedLanguage: string;
  selectedCategory?: OfficialCategory | "all";
  availabilityMap?: VoiceAvailabilityMap;
  initialLibraryVoices?: VoiceLibraryVoice[];
  onSelectLanguage: (language: string) => void;
  onSelectCategory?: (category: OfficialCategory | "all") => void;
  onSelectVoice: (voiceId: string) => void;
  onSelectModel: (modelId: string) => void;
  onSelectOutputFormat: (format: string) => void;
  onVoiceAdded?: (voice: GatewayVoice) => void;
  isGenerating: boolean;
  onGenerateAll: () => void;
  onCancelGeneration: () => void;
  onRetryFailed: () => void;
  onExportZip: () => void;
  hasErrors: boolean;
  hasReadyItems: boolean;
  readyCount: number;
  totalCount: number;
  isAuthenticated?: boolean;
  isProviderConnected?: boolean;
  providerTier?: string | null;
  isLoadingVoices?: boolean;
  voicesError?: string | null;
  onRetryVoices?: () => void;
  onConnectProvider?: (apiKey: string) => Promise<{ ok: boolean; message?: string }>;
  onDisconnectProvider?: () => Promise<void>;
  isEmbedded?: boolean;
  onOpenTopLevel?: () => void;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  voices,
  models,
  selectedVoiceId,
  selectedModelId,
  selectedOutputFormat,
  selectedLanguage,
  onSelectLanguage,
  onSelectVoice,
  onSelectModel,
  onSelectOutputFormat,
  onVoiceAdded,
  isGenerating,
  onGenerateAll,
  onCancelGeneration,
  onRetryFailed,
  onExportZip,
  hasErrors,
  hasReadyItems,
  readyCount,
  totalCount,
  isAuthenticated = false,
  isProviderConnected = false,
  providerTier,
  isLoadingVoices = false,
  voicesError = null,
  onRetryVoices,
  onConnectProvider,
  onDisconnectProvider,
  initialLibraryVoices,
}) => {
  // Global Audio Preview Singleton Player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Normalized tier
  const normTier = (providerTier || "").trim().toLowerCase();
  const isFree = normTier === "free";
  const isPaid = normTier.length > 0 && normTier !== "free" && normTier !== "unknown";

  // Account plan status label
  const displayTierName = useMemo(() => {
    if (!providerTier || isFree || normTier === "unknown") return "Free";
    return providerTier.charAt(0).toUpperCase() + providerTier.slice(1);
  }, [providerTier, isFree, normTier]);

  // Account collection Set for fast lookup
  const accountVoiceIds = useMemo(() => {
    return new Set(voices.map((v) => v.voiceId));
  }, [voices]);

  // =========================================================================
  // SECTION A: USABLE ACCOUNT VOICES (POSITIVE API USABILITY EVIDENCE)
  // =========================================================================
  const usableAccountVoices = useMemo(() => {
    return voices.filter((v) => {
      // For Free accounts, explicitly exclude shared/library/community copies (UX 03.3 Section 4)
      if (isFree) {
        if (
          v.sharedLibraryOrigin === true ||
          v.voiceOrigin === "shared_library" ||
          v.voiceOrigin === "library_copy" ||
          v.category === "shared" ||
          v.category === "community"
        ) {
          return false;
        }
      }
      const planCheck = checkVoicePlanAvailability(v, providerTier);
      return planCheck.availability === "available";
    });
  }, [voices, providerTier, isFree]);

  // Scoped Search for Section A
  const [accountSearchInput, setAccountSearchInput] = useState<string>("");
  const filteredUsableVoices = useMemo(() => {
    if (!accountSearchInput.trim()) return usableAccountVoices;
    const q = accountSearchInput.toLowerCase().trim();
    return usableAccountVoices.filter((v) => {
      const nameMatch = (v.name || "").toLowerCase().includes(q);
      const descMatch = (v.description || "").toLowerCase().includes(q);
      const categoryMatch = (v.category || "").toLowerCase().includes(q);
      const useCaseMatch = (v.labels?.use_case || "").toLowerCase().includes(q);
      return nameMatch || descMatch || categoryMatch || useCaseMatch;
    });
  }, [usableAccountVoices, accountSearchInput]);

  // Selected Voice Plan Check
  const selectedVoiceObj = useMemo(() => {
    if (!selectedVoiceId) return null;
    return (
      voices.find((v) => v.voiceId === selectedVoiceId) ||
      null
    );
  }, [selectedVoiceId, voices]);

  const selectedVoicePlanCheck = useMemo(() => {
    if (!selectedVoiceObj) return null;
    return checkVoicePlanAvailability(selectedVoiceObj, providerTier);
  }, [selectedVoiceObj, providerTier]);

  const isSelectedVoiceRestricted = selectedVoicePlanCheck?.availability === "restricted";

  // =========================================================================
  // SECTION B: VOICE LIBRARY CATALOG STATE
  // =========================================================================
  const [libraryVoices, setLibraryVoices] = useState<VoiceLibraryVoice[]>(() => initialLibraryVoices || []);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCountCatalog, setTotalCountCatalog] = useState<number>(0);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Section B Collapsible State: On Free accounts, default to collapsed or compact view (UX 03.3 Section 30)
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(true);

  // Section B Filter Tab: default is "all" on Free (UX 03.3 Section 12)
  const [libraryFilter, setLibraryFilter] = useState<VoiceCatalogFilter>(() => (isFree ? "all" : "available"));

  useEffect(() => {
    if (isFree && libraryFilter === "available") {
      setLibraryFilter("all");
    }
  }, [isFree]);

  // Voice Library counts
  const libraryCounts = useMemo(() => {
    return computeVoiceCatalogCounts(libraryVoices, providerTier, accountVoiceIds);
  }, [libraryVoices, providerTier, accountVoiceIds]);

  // Scoped Search for Section B
  const [librarySearchInput, setLibrarySearchInput] = useState<string>("");
  const [debouncedLibrarySearch, setDebouncedLibrarySearch] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLibrarySearch(librarySearchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [librarySearchInput]);

  // Section B Secondary Filters State
  const [selectedAccent, setSelectedAccent] = useState<string>("all");
  const [selectedUseCase, setSelectedUseCase] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  // Adding state and feedback
  const [addingVoiceId, setAddingVoiceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Dropdown state
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isModelAdvancedOpen, setIsModelAdvancedOpen] = useState(false);
  const [isFormatAdvancedOpen, setIsFormatAdvancedOpen] = useState(false);

  const langDropdownRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const librarySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isLangMenuOpen && langDropdownRef.current && !langDropdownRef.current.contains(target)) {
        setIsLangMenuOpen(false);
      }
    };
    if (isLangMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isLangMenuOpen]);

  // Active language option
  const activeLangOption = useMemo(() => {
    return (
      OFFICIAL_LANGUAGES.find((l) => l.code === selectedLanguage) || {
        code: selectedLanguage,
        label: selectedLanguage.toUpperCase(),
        flag: "🌐",
      }
    );
  }, [selectedLanguage]);

  // Compute available accents dynamically
  const availableAccents = useMemo(() => {
    const base = COMMON_LANGUAGE_ACCENTS[selectedLanguage] ?? [];
    const set = new Set<string>(base);
    libraryVoices.forEach((v) => {
      if (v.accent) set.add(v.accent.toLowerCase().trim());
    });
    return Array.from(set).sort();
  }, [libraryVoices, selectedLanguage]);

  const hasActiveLibraryFilters =
    selectedAccent !== "all" ||
    selectedUseCase !== "all" ||
    selectedGender !== "all" ||
    selectedAge !== "all" ||
    debouncedLibrarySearch.length > 0;

  // Clean audio singleton on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Fetch Voice Library Catalog from Gateway
  const loadCatalog = useCallback(
    async (reset = true) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (reset) {
        setIsLoadingCatalog(true);
        setPage(0);
      }

      setCatalogError(null);

      const queryParams: VoiceLibraryQueryParams = {
        language: selectedLanguage,
        page: 0,
        pageSize: CATALOG_PAGE_SIZE,
        sort: "usage_character_count_1y",
      };

      if (debouncedLibrarySearch) queryParams.search = debouncedLibrarySearch;
      if (selectedAccent !== "all") queryParams.accent = selectedAccent;
      if (selectedUseCase !== "all") queryParams.useCases = selectedUseCase;
      if (selectedGender !== "all") queryParams.gender = selectedGender;
      if (selectedAge !== "all") queryParams.age = selectedAge;

      try {
        const res = await fetchVoiceLibrary(queryParams, controller.signal);
        const mappedVoices = res.voices.map((v) => {
          const inColl = accountVoiceIds.has(v.voiceId);
          return {
            ...v,
            sharedLibraryOrigin: true,
            voiceOrigin: (inColl ? "library_copy" : "shared_library") as VoiceOrigin,
          };
        });
        setLibraryVoices(mappedVoices);
        setHasMore(res.hasMore);
        setTotalCountCatalog(res.totalCount);
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setCatalogError((err as Error).message || "Error al cargar catálogo de voces");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCatalog(false);
        }
      }
    },
    [
      selectedLanguage,
      debouncedLibrarySearch,
      selectedAccent,
      selectedUseCase,
      selectedGender,
      selectedAge,
      accountVoiceIds,
    ]
  );

  useEffect(() => {
    loadCatalog(true);
  }, [loadCatalog]);

  // Load More (Pagination)
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;

    const queryParams: VoiceLibraryQueryParams = {
      language: selectedLanguage,
      page: nextPage,
      pageSize: CATALOG_PAGE_SIZE,
      sort: "usage_character_count_1y",
    };

    if (debouncedLibrarySearch) queryParams.search = debouncedLibrarySearch;
    if (selectedAccent !== "all") queryParams.accent = selectedAccent;
    if (selectedUseCase !== "all") queryParams.useCases = selectedUseCase;
    if (selectedGender !== "all") queryParams.gender = selectedGender;
    if (selectedAge !== "all") queryParams.age = selectedAge;

    try {
      const res = await fetchVoiceLibrary(queryParams);
      setLibraryVoices((prev) => {
        const existingMap = new Map(prev.map((v) => [v.voiceId, v]));
        for (const raw of res.voices) {
          const inColl = accountVoiceIds.has(raw.voiceId);
          const incoming: VoiceLibraryVoice = {
            ...raw,
            sharedLibraryOrigin: true,
            voiceOrigin: (inColl ? "library_copy" : "shared_library") as VoiceOrigin,
          };
          if (existingMap.has(raw.voiceId)) {
            existingMap.set(raw.voiceId, mergeVoiceProvenance(existingMap.get(raw.voiceId)!, incoming));
          } else {
            existingMap.set(raw.voiceId, incoming);
          }
        }
        return Array.from(existingMap.values());
      });
      setPage(nextPage);
      setHasMore(res.hasMore);
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        message: `Error al cargar más voces: ${(err as Error).message}`,
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Switch Language
  const handleLanguageChange = (langCode: string) => {
    onSelectLanguage(langCode);
    setIsLangMenuOpen(false);
    setSelectedAccent("all");
    setSelectedUseCase("all");
    setSelectedGender("all");
    setSelectedAge("all");
    setLibrarySearchInput("");
  };

  // Singleton Audio Player
  const handlePlayVoicePreview = (voiceId: string, previewUrl: string | null) => {
    if (!previewUrl) return;

    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      setPlayingVoiceId(voiceId);

      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      audio.play().catch(() => setPlayingVoiceId(null));
    } catch {
      setPlayingVoiceId(null);
    }
  };

  // Select Usable Voice in Section A
  const handleSelectUsableVoice = (voice: GatewayVoice) => {
    setActionFeedback(null);
    onSelectVoice(voice.voiceId);
    setActionFeedback({
      type: "success",
      message: `Voz '${voice.name}' seleccionada para el proyecto.`,
    });
  };

  // Add & Use Voice in Section B (Paid users only or add to collection)
  const handleUseVoiceLibrary = async (voice: VoiceLibraryVoice) => {
    setActionFeedback(null);

    // Free account guard (UX 03.3 Section 15)
    if (isFree) {
      setActionFeedback({
        type: "error",
        message: "Las voces de Voice Library requieren un plan compatible de ElevenLabs para usarse mediante API.",
      });
      return;
    }

    // If already in collection, select directly
    if (accountVoiceIds.has(voice.voiceId)) {
      onSelectVoice(voice.voiceId);
      setActionFeedback({
        type: "success",
        message: `Voz '${voice.name}' seleccionada para el proyecto.`,
      });
      return;
    }

    if (!isAuthenticated) {
      setActionFeedback({
        type: "error",
        message: "Conecta tu acceso para usar esta acción.",
      });
      return;
    }

    if (!voice.publicOwnerId) {
      setActionFeedback({
        type: "error",
        message: `La voz '${voice.name}' no tiene publicOwnerId válido y no está disponible para añadir.`,
      });
      return;
    }

    const planCheck = checkVoicePlanAvailability(voice, providerTier);
    if (planCheck.availability === "restricted") {
      setActionFeedback({
        type: "error",
        message: planCheck.reason || "Esta voz requiere un plan de ElevenLabs superior.",
      });
      return;
    }

    setAddingVoiceId(voice.voiceId);
    try {
      await addSharedVoiceToAccount({
        voiceId: voice.voiceId,
        publicOwnerId: voice.publicOwnerId,
        name: voice.name,
      });

      const newGatewayVoice: GatewayVoice = {
        voiceId: voice.voiceId,
        name: voice.name,
        category: voice.category || "shared",
        voiceOrigin: "library_copy",
        publicOwnerId: voice.publicOwnerId,
        libraryAllowsFreeUsers: voice.libraryAllowsFreeUsers ?? voice.freeUsersAllowed,
        availableForTiers: voice.availableForTiers,
        labels: {
          language: voice.language || selectedLanguage,
          accent: voice.accent || "",
          use_case: voice.useCase || "",
          descriptive: voice.descriptive || "",
          gender: voice.gender || "",
          age: voice.age || "",
        },
        previewUrl: voice.previewUrl,
      };

      onVoiceAdded?.(newGatewayVoice);
      onSelectVoice(voice.voiceId);

      setActionFeedback({
        type: "success",
        message: `¡Voz '${voice.name}' añadida a tu colección y seleccionada!`,
      });
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        message: `No se pudo añadir la voz '${voice.name}': ${(err as Error).message}`,
      });
    } finally {
      setAddingVoiceId(null);
    }
  };

  // Filtered and sorted voices for Section B
  const displayedLibraryVoices = useMemo(() => {
    return filterAndSortVoiceCatalog(
      libraryVoices,
      libraryFilter,
      providerTier,
      debouncedLibrarySearch,
      accountVoiceIds
    );
  }, [libraryVoices, libraryFilter, providerTier, debouncedLibrarySearch, accountVoiceIds]);

  const handleResetLibraryFilters = () => {
    setSelectedAccent("all");
    setSelectedUseCase("all");
    setSelectedGender("all");
    setSelectedAge("all");
    setLibrarySearchInput("");
  };

  const handleScrollToLibrary = () => {
    setIsLibraryOpen(true);
    setTimeout(() => {
      librarySectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="batch-controls-card">
      {/* ────────────────────────────────────────────────────────── */}
      {/* ALERTA DE ACCIÓN / ERROR / SUCCESS GLOBAL                  */}
      {/* ────────────────────────────────────────────────────────── */}
      {actionFeedback && (
        <div
          className={`action-feedback-banner ${
            actionFeedback.type === "success" ? "feedback-success" : "feedback-error"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <BookmarkCheck size={16} className="feedback-icon" />
          ) : (
            <AlertCircle size={16} className="feedback-icon" />
          )}
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            className="feedback-close-btn"
            onClick={() => setActionFeedback(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION A (PRIMARY): VOCES DISPONIBLES CON TU PLAN         */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="section-usable-voices" data-testid="section-usable-voices">
        <div className="usable-voices-header-row">
          <div>
            <div className="section-eyebrow-row">
              <span className="section-eyebrow">
                <Sparkles size={14} className="text-accent inline mr-1" />
                VOCES LISTAS PARA GENERAR
              </span>
            </div>
            <h3 className="usable-voices-title">
              VOCES DISPONIBLES CON TU PLAN
              {!isLoadingVoices && usableAccountVoices.length > 0 && (
                <span className="usable-count-badge" data-testid="usable-voices-count-badge">
                  {usableAccountVoices.length}{" "}
                  {usableAccountVoices.length === 1 ? "VOZ DISPONIBLE" : "VOCES DISPONIBLES"}
                </span>
              )}
            </h3>
            <p className="usable-voices-subtitle">
              {isPaid
                ? "Estas voces están disponibles con tu plan actual para generar narraciones en GhostAI."
                : "Estas voces pueden usarse ahora mismo para generar narraciones en GhostAI."}
            </p>
          </div>

          <div className="usable-header-right">
            <div
              className="plan-badge-wrapper"
              title="Tu plan permite usar la API de ElevenLabs. La disponibilidad de cada voz depende del tipo de voz y de las capacidades de tu cuenta."
            >
              <span className="catalog-plan-status" data-testid="catalog-plan-status">
                ElevenLabs {displayTierName}
              </span>
              <button
                type="button"
                className="btn-plan-info-icon"
                aria-label="Información del plan"
                title="Tu plan permite usar la API de ElevenLabs. La disponibilidad de cada voz depende del tipo de voz y de las capacidades de tu cuenta."
              >
                <Info size={14} />
              </button>
            </div>
            {isLoadingVoices && (
              <span className="account-voices-loading-badge" data-testid="usable-voices-loading">
                <Loader2 size={14} className="animate-spin mr-1" /> Comprobando voces disponibles...
              </span>
            )}
          </div>
        </div>

        {/* Selected voice restricted warning banner (UX 03.3 Section 16) */}
        {isSelectedVoiceRestricted && (
          <div className="selected-voice-restricted-banner" data-testid="selected-voice-restricted-banner">
            <AlertCircle size={16} className="text-amber flex-shrink-0 mr-2" />
            <div className="restricted-banner-content">
              <strong>VOZ REQUIERE PLAN</strong>
              <span>
                La voz actualmente seleccionada no está disponible para generar narraciones mediante API con tu plan.
                Por favor selecciona una de las voces disponibles abajo antes de generar.
              </span>
            </div>
          </div>
        )}

        {/* Scoped Search Input for Section A */}
        {usableAccountVoices.length > 4 && (
          <div className="usable-search-row">
            <div className="voice-search-input-box usable-search-box">
              <Search size={14} className="search-icon-inside" />
              <input
                type="text"
                className="voice-search-input"
                placeholder="Buscar entre tus voces disponibles..."
                value={accountSearchInput}
                onChange={(e) => setAccountSearchInput(e.target.value)}
                aria-label="Buscar voz disponible"
              />
              {accountSearchInput && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setAccountSearchInput("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error State for Section A (UX 03.3 Section 22) */}
        {voicesError ? (
          <div className="usable-error-card" data-testid="usable-voices-error">
            <AlertCircle size={22} className="text-rose mr-3 flex-shrink-0" />
            <div>
              <h4>NO PUDIMOS COMPROBAR TUS VOCES</h4>
              <p>Tu conexión con ElevenLabs sigue activa. Intenta actualizar el catálogo.</p>
            </div>
            {onRetryVoices && (
              <button
                type="button"
                className="btn-retry-catalog"
                onClick={onRetryVoices}
              >
                <RotateCcw size={14} className="mr-1" /> Reintentar
              </button>
            )}
          </div>
        ) : isLoadingVoices && usableAccountVoices.length === 0 ? (
          /* Loading State for Section A (UX 03.3 Section 21: Never show 0 while loading) */
          <div className="usable-loading-state" data-testid="usable-voices-loading-state">
            <Loader2 size={24} className="animate-spin text-accent mb-2" />
            <p>Comprobando voces disponibles para tu plan...</p>
          </div>
        ) : usableAccountVoices.length === 0 ? (
          /* Explanatory Empty State for Section A (UX 03.3 Section 9) */
          <div className="usable-empty-state" data-testid="usable-voices-empty-state">
            <AlertCircle size={32} className="text-amber mb-2" />
            <h4>NO ENCONTRAMOS VOCES CONFIRMADAS PARA TU PLAN ACTUAL</h4>
            <p>
              Tu cuenta de ElevenLabs está conectada, pero no pudimos confirmar voces utilizables mediante API con este plan.
            </p>
            <button
              type="button"
              className="btn-view-voice-library"
              onClick={handleScrollToLibrary}
            >
              VER VOICE LIBRARY
            </button>
          </div>
        ) : (
          /* Cards Grid for Section A (UX 03.3 Section 7) */
          <div className="usable-voices-grid" data-testid="usable-voices-grid">
            {filteredUsableVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.voiceId;
              const isPlaying = playingVoiceId === voice.voiceId;
              const badgeLabel = isFree ? "✓ DISPONIBLE EN FREE" : "✓ DISPONIBLE CON TU PLAN";

              return (
                <div
                  key={voice.voiceId}
                  className={`usable-voice-card ${isSelected ? "is-selected" : ""}`}
                  data-testid={`usable-voice-card-${voice.voiceId}`}
                >
                  <div className="usable-card-header">
                    <div className="usable-avatar-wrap">
                      <div className={`usable-avatar ${isPlaying ? "playing" : ""}`}>
                        <Mic size={18} className="text-accent" />
                        {isPlaying && <span className="avatar-pulse" />}
                      </div>
                      <div className="usable-name-group">
                        <h4 className="usable-card-name" title={voice.name}>
                          {voice.name}
                        </h4>
                        <span className="usable-card-desc">
                          {voice.labels?.use_case
                            ? translateUseCase(voice.labels.use_case)
                            : voice.category || "Narración · Natural"}
                        </span>
                      </div>
                    </div>

                    <div className="usable-badges">
                      <span className="badge-usable-plan">{badgeLabel}</span>
                      {isSelected && (
                        <span className="badge-in-use" data-testid="badge-in-use">
                          <Check size={12} className="mr-1" /> EN USO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Escuchar & Usar Voz */}
                  <div className="usable-actions-row">
                    {voice.previewUrl ? (
                      <button
                        type="button"
                        className={`btn-usable-preview ${isPlaying ? "playing" : ""}`}
                        onClick={() => handlePlayVoicePreview(voice.voiceId, voice.previewUrl)}
                        title="Escuchar muestra de voz"
                      >
                        {isPlaying ? (
                          <>
                            <VolumeX size={14} className="mr-1" /> Detener
                          </>
                        ) : (
                          <>
                            <Play size={14} className="mr-1" /> Escuchar
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="preview-absent-text">Sin muestra</span>
                    )}

                    {isSelected ? (
                      <button
                        type="button"
                        className="btn-usable-select in-use"
                        disabled
                      >
                        <Check size={14} className="mr-1" /> En uso
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-usable-select"
                        onClick={() => handleSelectUsableVoice(voice)}
                      >
                        Usar voz
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECCIÓN PROVEEDOR DE VOZ (BYOK ELEVENLABS)                 */}
      {/* ────────────────────────────────────────────────────────── */}
      {onConnectProvider && onDisconnectProvider && (
        <VoiceProviderSection
          isProviderConnected={isProviderConnected}
          onConnect={onConnectProvider}
          onDisconnect={onDisconnectProvider}
          isAuthenticated={isAuthenticated}
          providerTier={providerTier}
        />
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODELO Y FORMATO CON CONFIGURACIÓN AVANZADA                */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="tech-config-row">
        {/* MODELO MAESTRO */}
        <div className="tech-box">
          <div className="tech-box-header">
            <span className="section-eyebrow">MODELO MAESTRO</span>
            <span className="tech-badge-rec">RECOMENDADO</span>
          </div>
          <div className="tech-main-choice">
            <h4 className="tech-choice-title">
              {models.find((m) => m.modelId === selectedModelId)?.name ||
                "Eleven Multilingual v2"}
            </h4>
            <p className="tech-choice-desc">
              {getModelDescription(
                selectedModelId,
                models.find((m) => m.modelId === selectedModelId)?.description
              )}
            </p>
          </div>

          <button
            type="button"
            className="tech-advanced-toggle"
            onClick={() => setIsModelAdvancedOpen(!isModelAdvancedOpen)}
          >
            <Settings size={14} className="mr-1 text-accent" />
            <span>⚙ Configuración avanzada de modelo</span>
            {isModelAdvancedOpen ? (
              <ChevronUp size={14} className="ml-auto" />
            ) : (
              <ChevronDown size={14} className="ml-auto" />
            )}
          </button>

          {isModelAdvancedOpen && (
            <div className="advanced-options-panel">
              <span className="advanced-sublabel">Modelos alternativos disponibles:</span>
              <div className="advanced-list">
                {models.map((m) => (
                  <button
                    key={m.modelId}
                    type="button"
                    className={`advanced-item-btn ${selectedModelId === m.modelId ? "active" : ""}`}
                    onClick={() => onSelectModel(m.modelId)}
                  >
                    <div>
                      <span className="item-btn-name">{m.name}</span>
                      <span className="item-btn-desc">
                        {getModelDescription(m.modelId, m.description)}
                      </span>
                    </div>
                    {selectedModelId === m.modelId && (
                      <Check size={16} className="text-accent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FORMATO DE SALIDA */}
        <div className="tech-box">
          <div className="tech-box-header">
            <span className="section-eyebrow">FORMATO DE SALIDA</span>
            <span className="tech-badge-rec">RECOMENDADO</span>
          </div>
          <div className="tech-main-choice">
            <h4 className="tech-choice-title">
              {selectedOutputFormat === "mp3_44100_128"
                ? "MP3 · 44.1 kHz · 128 kbps"
                : selectedOutputFormat}
            </h4>
            <p className="tech-choice-desc">
              Balance óptimo de compresión y fidelidad sonora certificado para GhostAI.
            </p>
          </div>

          <button
            type="button"
            className="tech-advanced-toggle"
            onClick={() => setIsFormatAdvancedOpen(!isFormatAdvancedOpen)}
          >
            <Settings size={14} className="mr-1 text-accent" />
            <span>⚙ Configuración avanzada de audio</span>
            {isFormatAdvancedOpen ? (
              <ChevronUp size={14} className="ml-auto" />
            ) : (
              <ChevronDown size={14} className="ml-auto" />
            )}
          </button>

          {isFormatAdvancedOpen && (
            <div className="advanced-options-panel">
              <span className="advanced-sublabel">Formatos certificados:</span>
              <div className="advanced-list">
                {[
                  {
                    id: "mp3_44100_128",
                    label: "MP3 · 44.1 kHz · 128 kbps (Recomendado)",
                  },
                  {
                    id: "mp3_44100_192",
                    label: "MP3 · 44.1 kHz · 192 kbps (Alta fidelidad)",
                  },
                  {
                    id: "pcm_44100",
                    label: "PCM WAV · 44.1 kHz (Sin compresión)",
                  },
                  {
                    id: "pcm_24000",
                    label: "PCM WAV · 24.0 kHz (Baja latencia)",
                  },
                  {
                    id: "mp3_22050_32",
                    label: "MP3 · 22.05 kHz · 32 kbps (Compacto)",
                  },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    className={`advanced-item-btn ${selectedOutputFormat === fmt.id ? "active" : ""}`}
                    onClick={() => onSelectOutputFormat(fmt.id)}
                  >
                    <span className="item-btn-name">{fmt.label}</span>
                    {selectedOutputFormat === fmt.id && (
                      <Check size={16} className="text-accent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION B: VOICE LIBRARY DE ELEVENLABS (CATÁLOGO EXPLORACIÓN)*/}
      {/* ────────────────────────────────────────────────────────── */}
      <section
        ref={librarySectionRef}
        className="voice-library-catalog-section"
        data-testid="section-voice-library"
      >
        <div className="catalog-header-row">
          <div>
            <span className="section-eyebrow">
              <Sparkles size={14} className="text-accent inline mr-1" />
              EXPLORAR CATÁLOGO GLOBAL
            </span>
            <h3 className="catalog-title">
              VOICE LIBRARY DE ELEVENLABS
              {totalCountCatalog > 0 && (
                <span className="catalog-total-badge" data-testid="catalog-total-badge">
                  {totalCountCatalog.toLocaleString()} voces en Voice Library
                </span>
              )}
            </h3>
            <p className="catalog-subtitle-text">
              {isFree
                ? "Explora voces adicionales. En el plan Free, las voces de Voice Library requieren un plan compatible para usarse mediante API en GhostAI."
                : "Explora el catálogo global de voces comunitarias y profesionales de ElevenLabs."}
            </p>
          </div>

          <div className="catalog-status-info flex items-center gap-2">
            <button
              type="button"
              className="btn-toggle-library"
              onClick={() => setIsLibraryOpen(!isLibraryOpen)}
              data-testid="toggle-voice-library"
            >
              {isLibraryOpen ? (
                <>
                  <ChevronUp size={14} className="mr-1" /> OCULTAR VOICE LIBRARY
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-1" /> EXPLORAR VOICE LIBRARY
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isLibraryOpen && (
          <div className="voice-library-expanded-panel animate-fade-in">
            {/* Top Toolbar: Language Selector + Scoped Search + Refinements */}
            <div className="voice-library-top-bar">
              {/* Language Selector */}
              <div ref={langDropdownRef} className="language-selector-wrap">
                <label className="filter-field-label">
                  <Mic size={14} className="text-accent mr-1 inline" /> IDIOMA
                </label>
                <button
                  type="button"
                  className="primary-filter-trigger"
                  onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                  aria-label="Seleccionar idioma"
                >
                  <span className="filter-trigger-icon">{activeLangOption.flag}</span>
                  <div className="filter-trigger-info">
                    <span className="filter-trigger-value">{activeLangOption.label}</span>
                    <span className="filter-trigger-sub">Catálogo oficial</span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`chevron-transition ${isLangMenuOpen ? "rotated" : ""}`}
                  />
                </button>

                {isLangMenuOpen && (
                  <div className="filter-popover-menu">
                    {OFFICIAL_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        className={`popover-option-item ${selectedLanguage === lang.code ? "active" : ""}`}
                        onClick={() => handleLanguageChange(lang.code)}
                      >
                        <span className="option-flag">{lang.flag}</span>
                        <span className="option-name">{lang.label}</span>
                        {selectedLanguage === lang.code && (
                          <Check size={16} className="text-accent ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Scoped Search Input for Voice Library */}
              <div className="search-bar-wrap">
                <label className="filter-field-label">
                  <Search size={14} className="text-accent mr-1 inline" /> BUSCAR EN VOICE LIBRARY
                </label>
                <div className="voice-search-input-box">
                  <Search size={16} className="search-icon-inside" />
                  <input
                    type="text"
                    className="voice-search-input"
                    placeholder="Buscar por nombre, estilo o creador..."
                    value={librarySearchInput}
                    onChange={(e) => setLibrarySearchInput(e.target.value)}
                    aria-label="Buscar en Voice Library"
                  />
                  {librarySearchInput && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setLibrarySearchInput("")}
                      aria-label="Limpiar búsqueda"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Secondary Filters Toggle */}
              <div className="filter-toggle-wrap">
                <label className="filter-field-label">REFINAMIENTOS</label>
                <button
                  type="button"
                  className={`btn-toggle-filters ${isFiltersOpen ? "open" : ""} ${
                    hasActiveLibraryFilters ? "has-active" : ""
                  }`}
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  aria-expanded={isFiltersOpen}
                >
                  <Filter size={15} className="mr-1.5" />
                  <span>⚙ Más Filtros</span>
                  {hasActiveLibraryFilters && <span className="active-dot-badge" />}
                  {isFiltersOpen ? (
                    <ChevronUp size={14} className="ml-1.5" />
                  ) : (
                    <ChevronDown size={14} className="ml-1.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Secondary Filters Panel */}
            {isFiltersOpen && (
              <div className="secondary-filters-panel animate-fade-in">
                <div className="filter-pill-row">
                  <span className="secondary-group-label">Caso de uso:</span>
                  {USE_CASE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pill-filter-item ${selectedUseCase === opt.id ? "active" : ""}`}
                      onClick={() => setSelectedUseCase(opt.id)}
                    >
                      <span className="mr-1">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="filter-pill-row">
                  <span className="secondary-group-label">Acento:</span>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedAccent === "all" ? "active" : ""}`}
                    onClick={() => setSelectedAccent("all")}
                  >
                    Todos ({availableAccents.length})
                  </button>
                  {availableAccents.map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      className={`pill-filter-item ${selectedAccent === acc ? "active" : ""}`}
                      onClick={() => setSelectedAccent(acc)}
                    >
                      {translateAccent(acc)}
                    </button>
                  ))}
                </div>

                <div className="filter-pill-row">
                  <span className="secondary-group-label">Género:</span>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedGender === "all" ? "active" : ""}`}
                    onClick={() => setSelectedGender("all")}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedGender === "female" ? "active" : ""}`}
                    onClick={() => setSelectedGender("female")}
                  >
                    Femenino
                  </button>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedGender === "male" ? "active" : ""}`}
                    onClick={() => setSelectedGender("male")}
                  >
                    Masculino
                  </button>
                </div>

                <div className="filter-pill-row">
                  <span className="secondary-group-label">Edad:</span>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedAge === "all" ? "active" : ""}`}
                    onClick={() => setSelectedAge("all")}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedAge === "young" ? "active" : ""}`}
                    onClick={() => setSelectedAge("young")}
                  >
                    Joven
                  </button>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedAge === "middle_aged" ? "active" : ""}`}
                    onClick={() => setSelectedAge("middle_aged")}
                  >
                    Adulta
                  </button>
                  <button
                    type="button"
                    className={`pill-filter-item ${selectedAge === "old" ? "active" : ""}`}
                    onClick={() => setSelectedAge("old")}
                  >
                    Mayor
                  </button>
                </div>

                {hasActiveLibraryFilters && (
                  <button
                    type="button"
                    className="btn-clear-all-filters ml-auto"
                    onClick={handleResetLibraryFilters}
                  >
                    <RotateCcw size={12} className="mr-1" /> Limpiar filtros
                  </button>
                )}
              </div>
            )}

            {/* Pestañas de Filtro de Voice Library (UX 03.3 Section 12) */}
            <div className="availability-filter-tabs" data-testid="voice-plan-tabs">
              {/* On Free: NO "DISPONIBLES (0)" tab. TODAS is default */}
              <button
                type="button"
                className={`tab-availability-btn ${libraryFilter === "all" ? "active" : ""}`}
                onClick={() => setLibraryFilter("all")}
                data-testid="tab-all-voices"
              >
                TODAS ({libraryCounts.total})
              </button>

              {/* On Paid accounts: show available tab */}
              {isPaid && (
                <button
                  type="button"
                  className={`tab-availability-btn ${libraryFilter === "available" ? "active" : ""}`}
                  onClick={() => setLibraryFilter("available")}
                  data-testid="tab-available-voices"
                >
                  DISPONIBLES CON TU PLAN ({libraryCounts.available})
                </button>
              )}

              <button
                type="button"
                className={`tab-availability-btn ${libraryFilter === "restricted" ? "active" : ""}`}
                onClick={() => setLibraryFilter("restricted")}
                data-testid="tab-restricted-voices"
              >
                {isPaid
                  ? `REQUIEREN PLAN SUPERIOR (${libraryCounts.restricted})`
                  : `REQUIEREN PLAN (${libraryCounts.restricted})`}
              </button>

              <button
                type="button"
                className={`tab-availability-btn ${libraryFilter === "in_collection" ? "active" : ""}`}
                onClick={() => setLibraryFilter("in_collection")}
                data-testid="tab-in-collection-voices"
              >
                EN TU COLECCIÓN ({libraryCounts.inCollection})
              </button>

              <button
                type="button"
                className={`tab-availability-btn ${libraryFilter === "unknown" ? "active" : ""}`}
                onClick={() => setLibraryFilter("unknown")}
                data-testid="tab-unknown-voices"
              >
                POR VERIFICAR ({libraryCounts.unknown})
              </button>
            </div>

            {/* Error de Carga de Voice Library */}
            {catalogError && (
              <div className="catalog-error-card">
                <AlertCircle size={22} className="text-rose mr-3 flex-shrink-0" />
                <div>
                  <h4>Error al conectar con la Voice Library</h4>
                  <p>{catalogError}</p>
                </div>
                <button
                  type="button"
                  className="btn-retry-catalog"
                  onClick={() => loadCatalog(true)}
                >
                  <RotateCcw size={14} className="mr-1" /> Reintentar
                </button>
              </div>
            )}

            {/* Skeletons al cargar inicialmente */}
            {isLoadingCatalog && libraryVoices.length === 0 && !catalogError && (
              <div className="voice-library-grid">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="voice-library-card skeleton-card">
                    <div className="skeleton-avatar" />
                    <div className="skeleton-line title" />
                    <div className="skeleton-line sub" />
                    <div className="skeleton-tags" />
                    <div className="skeleton-actions" />
                  </div>
                ))}
              </div>
            )}

            {/* Catálogo Vacío */}
            {!isLoadingCatalog && libraryVoices.length === 0 && !catalogError && (
              <div className="catalog-empty-state">
                <Mic size={36} className="empty-state-icon" />
                <h4>No se encontraron voces</h4>
                <p>
                  No hay voces que coincidan con los filtros seleccionados para {activeLangOption.label}.
                </p>
                {hasActiveLibraryFilters && (
                  <button
                    type="button"
                    className="btn-empty-reset"
                    onClick={handleResetLibraryFilters}
                  >
                    Restablecer filtros de búsqueda
                  </button>
                )}
              </div>
            )}

            {/* Grid de Voces de Voice Library */}
            {displayedLibraryVoices.length > 0 && (
              <div className="voice-library-grid">
                {displayedLibraryVoices.map((voice) => {
                  const isInCollection = accountVoiceIds.has(voice.voiceId);
                  const isSelected = selectedVoiceId === voice.voiceId;
                  const isPlaying = playingVoiceId === voice.voiceId;
                  const isAdding = addingVoiceId === voice.voiceId;
                  const evaluatedVoice: VoiceLibraryVoice = isInCollection
                    ? { ...voice, voiceOrigin: "library_copy", sharedLibraryOrigin: true }
                    : { ...voice, sharedLibraryOrigin: true };
                  const voicePlan = checkVoicePlanAvailability(evaluatedVoice, providerTier);
                  const isRestricted = voicePlan.availability === "restricted";

                  return (
                    <div
                      key={voice.voiceId}
                      className={`voice-library-card ${isSelected ? "is-selected" : ""} ${
                        isInCollection ? "in-collection" : ""
                      } ${isRestricted ? "is-restricted" : ""}`}
                    >
                      {/* Card Header: Avatar, Name & Badges */}
                      <div className="card-top-header">
                        <div className="card-avatar-wrap">
                          <div className={`card-avatar ${isPlaying ? "playing" : ""}`}>
                            <Mic size={20} className="text-accent" />
                            {isPlaying && <span className="avatar-pulse" />}
                          </div>
                          <div className="card-name-group">
                            <h4 className="voice-card-name" title={voice.name}>
                              {voice.name}
                            </h4>
                            <span className="voice-card-creator">
                              {voice.useCase ? translateUseCase(voice.useCase) : "Voz comunitaria"}
                            </span>
                          </div>
                        </div>

                        <div className="card-status-badges">
                          <span
                            className={`badge-plan-availability badge-plan-${voicePlan.availability}`}
                            data-testid={`badge-plan-${voice.voiceId}`}
                            title={voicePlan.reason || getVoicePlanBadgeLabel(evaluatedVoice, providerTier)}
                          >
                            {isRestricted ? "🔒 REQUIERE PLAN" : getVoicePlanBadgeLabel(evaluatedVoice, providerTier)}
                          </span>

                          {/* Edge Case: if selected voice is restricted on Free, do NOT show EN USO (UX 03.3 Section 16) */}
                          {isSelected && !isRestricted && (
                            <span className="badge-selected">
                              <Check size={12} className="mr-1" /> SELECCIONADA
                            </span>
                          )}

                          {isSelected && isRestricted && (
                            <span className="badge-selected-restricted" title="Esta voz requiere un plan compatible para generar">
                              <AlertCircle size={12} className="mr-1" /> VOZ REQUIERE PLAN
                            </span>
                          )}

                          {/* Collection badge with explicit tooltip (UX 03.3 Section 14, 19) */}
                          {isInCollection && !isSelected && (
                            <span
                              className="badge-in-collection"
                              title="Guardada en tu cuenta de ElevenLabs. Esto no garantiza disponibilidad mediante API con tu plan actual."
                            >
                              <BookmarkCheck size={12} className="mr-1" /> EN TU COLECCIÓN
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Helper text */}
                      <div className="voice-card-plan-helper" data-testid={`helper-plan-${voice.voiceId}`}>
                        {isFree
                          ? "No disponible mediante la API con tu plan Free."
                          : getVoicePlanHelperText(evaluatedVoice, providerTier)}
                      </div>

                      {/* Metadata Tags */}
                      <div className="card-meta-tags">
                        <span className="card-tag tag-lang">
                          {translateLanguage(voice.language || selectedLanguage).flag}{" "}
                          {translateAccent(voice.accent || undefined)}
                        </span>
                        {voice.gender && (
                          <span className="card-tag tag-gender">
                            {translateGender(voice.gender)}
                          </span>
                        )}
                        {voice.age && (
                          <span className="card-tag tag-age">
                            {translateAge(voice.age)}
                          </span>
                        )}
                        {voice.descriptive && (
                          <span className="card-tag tag-style">
                            <Tag size={10} className="mr-1 inline" />
                            {translateDescriptiveTag(voice.descriptive)}
                          </span>
                        )}
                      </div>

                      {/* Technical metadata */}
                      {((typeof voice.rate === "number" && voice.rate > 0) ||
                        (typeof voice.noticePeriod === "number" && voice.noticePeriod > 0)) && (
                        <div className="card-technical-info">
                          {typeof voice.rate === "number" && voice.rate > 0 && (
                            <span className="tech-meta-item">Rate {voice.rate}</span>
                          )}
                          {typeof voice.rate === "number" &&
                            voice.rate > 0 &&
                            typeof voice.noticePeriod === "number" &&
                            voice.noticePeriod > 0 && <span className="tech-meta-sep">·</span>}
                          {typeof voice.noticePeriod === "number" && voice.noticePeriod > 0 && (
                            <span className="tech-meta-item">Aviso {voice.noticePeriod}d</span>
                          )}
                        </div>
                      )}

                      {/* Actions: Escuchar & Usar Voz (Locked on Free, UX 03.3 Section 14 & 15) */}
                      <div className="card-actions-row">
                        {voice.previewUrl ? (
                          <button
                            type="button"
                            className={`btn-card-preview ${isPlaying ? "playing" : ""}`}
                            onClick={() => handlePlayVoicePreview(voice.voiceId, voice.previewUrl)}
                            title="Escuchar muestra oficial"
                          >
                            {isPlaying ? (
                              <>
                                <VolumeX size={15} className="mr-1.5" /> Detener
                              </>
                            ) : (
                              <>
                                <Play size={15} className="mr-1.5" /> Escuchar
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="preview-absent-text">Sin muestra</span>
                        )}

                        {/* On Free tier or restricted voice: action button is locked (UX 03.3 Section 15) */}
                        {isFree || isRestricted ? (
                          <button
                            type="button"
                            className="btn-card-use-voice btn-plan-restricted"
                            disabled
                            title="Las voces de Voice Library requieren un plan compatible de ElevenLabs para usarse mediante API."
                          >
                            <Lock size={13} className="mr-1.5" /> PLAN REQUERIDO
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`btn-card-use-voice ${isSelected ? "selected" : ""}`}
                            onClick={() => handleUseVoiceLibrary(voice)}
                            disabled={isAdding}
                          >
                            {isAdding ? (
                              <>
                                <Loader2 size={14} className="animate-spin mr-1.5" /> Añadiendo...
                              </>
                            ) : isSelected ? (
                              <>
                                <Check size={14} className="mr-1.5" /> En uso
                              </>
                            ) : isInCollection ? (
                              <>
                                <Check size={14} className="mr-1.5" /> Usar voz
                              </>
                            ) : (
                              "Usar voz"
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Button: CARGAR MÁS DE VOICE LIBRARY (UX 03.3 Section 28) */}
            {hasMore && !isLoadingCatalog && (
              <div className="catalog-pagination-row">
                <button
                  type="button"
                  className="btn-load-more-catalog"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" /> Cargando más voces...
                    </>
                  ) : (
                    <>
                      <span>CARGAR MÁS DE VOICE LIBRARY ({CATALOG_PAGE_SIZE} más)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {!hasMore && libraryVoices.length > 0 && !isLoadingCatalog && (
              <div className="catalog-end-note">
                <span>Has visto todas las {libraryVoices.length} voces cargadas para esta selección de Voice Library.</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* BARRA DE ACCIÓN Y GENERACIÓN BATCH                         */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="studio-bottom-action-bar">
        <div className="action-bar-left" />

        <div className="action-bar-right">
          {/* Warning if selected voice requires another plan (UX 03.3 Section 16) */}
          {isSelectedVoiceRestricted && (
            <div className="selected-voice-plan-warning" data-testid="selected-voice-plan-warning">
              <AlertCircle size={15} className="mr-1.5 flex-shrink-0 text-amber" />
              <span>
                La voz seleccionada no está disponible con tu plan actual. Elige una voz disponible para continuar.
              </span>
            </div>
          )}

          {isGenerating ? (
            <button
              type="button"
              className="btn-cancel-generation"
              onClick={onCancelGeneration}
            >
              <Square size={16} className="mr-2 fill-current" />
              <span>Detener Generación</span>
            </button>
          ) : (
            <button
              type="button"
              className={`btn-generate-main ${
                !isAuthenticated || !isProviderConnected || isSelectedVoiceRestricted
                  ? "btn-auth-locked"
                  : ""
              }`}
              onClick={onGenerateAll}
              disabled={
                totalCount === 0 ||
                readyCount === totalCount ||
                !isAuthenticated ||
                !isProviderConnected ||
                isSelectedVoiceRestricted
              }
              title={
                isSelectedVoiceRestricted
                  ? "Selecciona una voz disponible con tu plan para habilitar la generación."
                  : !isAuthenticated
                  ? "Conecta tu acceso para usar esta acción"
                  : !isProviderConnected
                  ? "Conecta ElevenLabs para generar narraciones."
                  : undefined
              }
            >
              <Volume2 size={18} className="mr-2" />
              <span>
                {isSelectedVoiceRestricted
                  ? "SELECCIONA UNA VOZ DISPONIBLE"
                  : !isAuthenticated
                  ? "Conecta tu acceso para usar esta acción"
                  : !isProviderConnected
                  ? "Conecta ElevenLabs para generar narraciones."
                  : `Generar Todas las Narraciones (${readyCount}/${totalCount})`}
              </span>
            </button>
          )}

          {hasErrors && !isGenerating && (
            <button
              type="button"
              className="btn-retry-failed"
              onClick={onRetryFailed}
              title="Reintentar solo las escenas con error"
            >
              <RotateCcw size={16} className="mr-2" />
              <span>Reintentar Fallidas</span>
            </button>
          )}

          {hasReadyItems && (
            <div className="zip-download-actions flex items-center gap-2">
              <button
                type="button"
                className="btn-export-zip-main"
                onClick={onExportZip}
                disabled={isGenerating}
                data-testid="btn-export-zip"
                title="Descargar paquete ZIP en ventana segura sin restricciones de sandbox"
              >
                <PackageCheck size={18} className="mr-2 text-emerald" />
                <span>Descargar ZIP ({readyCount})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
