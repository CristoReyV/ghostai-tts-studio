/**
 * @file src/components/BatchControls.tsx
 * GhostAI Voice Library MVP:
 * IDIOMA -> VOICE LIBRARY -> BUSCAR / EXPLORAR -> FILTROS OPCIONALES -> PREVIEW -> USAR VOZ
 *
 * Full integration with the real ElevenLabs Voice Library catalog via TTS Gateway.
 * Supports on-demand shared voice addition without generating TTS or consuming credits.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  RotateCcw,
  Square,
  PackageCheck,
  Volume2,
  VolumeX,
  Sliders,
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
} from "lucide-react";
import type {
  GatewayModel,
  GatewayVoice,
  VoiceLibraryVoice,
  VoiceLibraryQueryParams,
} from "../types/tts";
import {
  fetchVoiceLibrary,
  addSharedVoiceToAccount,
} from "../services/gateway";
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
  onSelectLanguage: (language: string) => void;
  onSelectCategory?: (category: OfficialCategory | "all") => void;
  onSelectVoice: (voiceId: string) => void;
  onSelectModel: (modelId: string) => void;
  onSelectOutputFormat: (format: string) => void;
  onVoiceAdded?: (voice: GatewayVoice) => void;
  onApplyToPending: () => void;
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
  onApplyToPending,
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
}) => {
  // Global Audio Preview Singleton Player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Voice Library Catalog State
  const [libraryVoices, setLibraryVoices] = useState<VoiceLibraryVoice[]>([]);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCountCatalog, setTotalCountCatalog] = useState<number>(0);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Search State with Debounce
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Optional Secondary Filters State
  const [selectedAccent, setSelectedAccent] = useState<string>("all");
  const [selectedUseCase, setSelectedUseCase] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  // Shared Voice Adding State
  const [addingVoiceId, setAddingVoiceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // UI state for dropdowns & accordions
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(false);
  const [isModelAdvancedOpen, setIsModelAdvancedOpen] = useState(false);
  const [isFormatAdvancedOpen, setIsFormatAdvancedOpen] = useState(false);

  // Refs for click outside
  const langDropdownRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Account collection Set for fast lookup
  const accountVoiceIds = useMemo(() => {
    return new Set(voices.map((v) => v.voiceId));
  }, [voices]);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  // Compute available accents dynamically from known language presets + dynamic catalog
  const availableAccents = useMemo(() => {
    const base = COMMON_LANGUAGE_ACCENTS[selectedLanguage] ?? [];
    const set = new Set<string>(base);
    libraryVoices.forEach((v) => {
      if (v.accent) set.add(v.accent.toLowerCase().trim());
    });
    return Array.from(set).sort();
  }, [libraryVoices, selectedLanguage]);

  // Check if any optional filter is active
  const hasActiveFilters =
    selectedAccent !== "all" ||
    selectedUseCase !== "all" ||
    selectedGender !== "all" ||
    selectedAge !== "all" ||
    debouncedSearch.length > 0;

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

      if (debouncedSearch) queryParams.search = debouncedSearch;
      if (selectedAccent !== "all") queryParams.accent = selectedAccent;
      if (selectedUseCase !== "all") queryParams.useCases = selectedUseCase;
      if (selectedGender !== "all") queryParams.gender = selectedGender;
      if (selectedAge !== "all") queryParams.age = selectedAge;

      try {
        const res = await fetchVoiceLibrary(queryParams, controller.signal);
        setLibraryVoices(res.voices);
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
      debouncedSearch,
      selectedAccent,
      selectedUseCase,
      selectedGender,
      selectedAge,
    ]
  );

  // Trigger catalog fetch when language, search, or filters change
  useEffect(() => {
    loadCatalog(true);
  }, [loadCatalog]);

  // Load More (Pagination: page + 1)
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

    if (debouncedSearch) queryParams.search = debouncedSearch;
    if (selectedAccent !== "all") queryParams.accent = selectedAccent;
    if (selectedUseCase !== "all") queryParams.useCases = selectedUseCase;
    if (selectedGender !== "all") queryParams.gender = selectedGender;
    if (selectedAge !== "all") queryParams.age = selectedAge;

    try {
      const res = await fetchVoiceLibrary(queryParams);
      setLibraryVoices((prev) => {
        const existingIds = new Set(prev.map((v) => v.voiceId));
        const newUnique = res.voices.filter((v) => !existingIds.has(v.voiceId));
        return [...prev, ...newUnique];
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

  // Switch Language: resets filters, queries new language catalog, retains selectedVoiceId
  const handleLanguageChange = (langCode: string) => {
    onSelectLanguage(langCode);
    setIsLangMenuOpen(false);
    setSelectedAccent("all");
    setSelectedUseCase("all");
    setSelectedGender("all");
    setSelectedAge("all");
    setSearchInput("");
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

  // USAR VOZ: if in collection -> immediately select; if shared voice -> POST Add
  const handleUseVoice = async (voice: VoiceLibraryVoice) => {
    setActionFeedback(null);

    // If already in collection, select directly
    if (accountVoiceIds.has(voice.voiceId)) {
      onSelectVoice(voice.voiceId);
      setActionFeedback({
        type: "success",
        message: `Voz '${voice.name}' seleccionada para el proyecto.`,
      });
      return;
    }

    // Guard: require operator auth for adding shared voices to account
    if (!isAuthenticated) {
      setActionFeedback({
        type: "error",
        message: "Conecta tu acceso para usar esta acción.",
      });
      return;
    }

    // Guard: require valid publicOwnerId for shared voice addition
    if (!voice.publicOwnerId) {
      setActionFeedback({
        type: "error",
        message: `La voz '${voice.name}' no tiene publicOwnerId válido y no está disponible para añadir.`,
      });
      return;
    }

    // Shared voice not yet in collection -> call Gateway to add it
    setAddingVoiceId(voice.voiceId);
    try {
      await addSharedVoiceToAccount({
        voiceId: voice.voiceId,
        publicOwnerId: voice.publicOwnerId,
        name: voice.name,
      });

      // Construct clean GatewayVoice and notify parent
      const newGatewayVoice: GatewayVoice = {
        voiceId: voice.voiceId,
        name: voice.name,
        category: voice.category || "shared",
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

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedAccent("all");
    setSelectedUseCase("all");
    setSelectedGender("all");
    setSelectedAge("all");
    setSearchInput("");
  };

  // Apply batch configuration to pending items
  const handleApplyClick = () => {
    onApplyToPending();
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2600);
  };

  return (
    <div className="batch-controls-card">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. MASTER SELECTOR & SEARCH BAR                            */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="voice-library-top-bar">
        {/* A) SELECTOR MAESTRO: IDIOMA */}
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

          {/* Popover de Idiomas */}
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

        {/* B) BÚSQUEDA DE VOZ */}
        <div className="search-bar-wrap">
          <label className="filter-field-label">
            <Search size={14} className="text-accent mr-1 inline" /> BUSCAR VOZ
          </label>
          <div className="voice-search-input-box">
            <Search size={16} className="search-icon-inside" />
            <input
              type="text"
              className="voice-search-input"
              placeholder="Buscar por nombre, estilo o creador..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar voz"
            />
            {searchInput && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchInput("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* C) TOGGLE FILTROS OPCIONALES */}
        <div className="filter-toggle-wrap">
          <label className="filter-field-label">REFINAMIENTOS</label>
          <button
            type="button"
            className={`btn-toggle-filters ${isFiltersOpen ? "open" : ""} ${hasActiveFilters ? "has-active" : ""}`}
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            aria-expanded={isFiltersOpen}
          >
            <Filter size={15} className="mr-1.5" />
            <span>⚙ Más Filtros</span>
            {hasActiveFilters && <span className="active-dot-badge" />}
            {isFiltersOpen ? (
              <ChevronUp size={14} className="ml-1.5" />
            ) : (
              <ChevronDown size={14} className="ml-1.5" />
            )}
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. PANEL DE FILTROS OPCIONALES (ACORDEÓN)                  */}
      {/* ────────────────────────────────────────────────────────── */}
      {isFiltersOpen && (
        <div className="secondary-filters-panel animate-fade-in">
          {/* Fila: Caso de Uso */}
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

          {/* Fila: Acento / Región */}
          <div className="filter-pill-row">
            <span className="secondary-group-label">Acento:</span>
            <button
              type="button"
              className={`pill-filter-item ${selectedAccent === "all" ? "active" : ""}`}
              onClick={() => setSelectedAccent("all")}
            >
              Todos
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

          {/* Fila: Género y Edad */}
          <div className="filter-dual-row">
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
                Femenina
              </button>
              <button
                type="button"
                className={`pill-filter-item ${selectedGender === "male" ? "active" : ""}`}
                onClick={() => setSelectedGender("male")}
              >
                Masculina
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

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-all-filters ml-auto"
                onClick={handleResetFilters}
              >
                <RotateCcw size={12} className="mr-1" /> Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. ALERTA DE ACCIÓN / ERROR / SUCCESS                      */}
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
      {/* 4. CATÁLOGO DE VOCES DE ELEVENLABS                         */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="voice-library-catalog-section">
        <div className="catalog-header-row">
          <div>
            <span className="section-eyebrow">
              <Sparkles size={14} className="text-accent inline mr-1" />
              VOCES PARA {activeLangOption.label.toUpperCase()}
            </span>
            <h3 className="catalog-title">
              Catálogo Voice Library
              {totalCountCatalog > 0 && (
                <span className="catalog-total-badge">
                  {totalCountCatalog.toLocaleString()} disponibles
                </span>
              )}
            </h3>
          </div>

          <div className="catalog-status-info">
            {isLoadingCatalog && (
              <span className="catalog-loading-badge">
                <Loader2 size={14} className="animate-spin mr-1" /> Cargando catálogo...
              </span>
            )}
          </div>
        </div>

        {/* ERROR DE CARGA DE CATÁLOGO */}
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

        {/* SKELETONS AL CARGAR INICIALMENTE */}
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

        {/* CATÁLOGO VACÍO */}
        {!isLoadingCatalog && libraryVoices.length === 0 && !catalogError && (
          <div className="catalog-empty-state">
            <Mic size={36} className="empty-state-icon" />
            <h4>No se encontraron voces</h4>
            <p>
              No hay voces que coincidan con los filtros seleccionados para{" "}
              {activeLangOption.label}.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-empty-reset"
                onClick={handleResetFilters}
              >
                Restablecer filtros de búsqueda
              </button>
            )}
          </div>
        )}

        {/* GRID DE VOCES DE VOICE LIBRARY */}
        {libraryVoices.length > 0 && (
          <div className="voice-library-grid">
            {libraryVoices.map((voice) => {
              const isInCollection = accountVoiceIds.has(voice.voiceId);
              const isSelected = selectedVoiceId === voice.voiceId;
              const isPlaying = playingVoiceId === voice.voiceId;
              const isAdding = addingVoiceId === voice.voiceId;

              return (
                <div
                  key={voice.voiceId}
                  className={`voice-library-card ${isSelected ? "is-selected" : ""} ${
                    isInCollection ? "in-collection" : ""
                  }`}
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
                      {isSelected && (
                        <span className="badge-selected">
                          <Check size={12} className="mr-1" /> SELECCIONADA
                        </span>
                      )}
                      {isInCollection && !isSelected && (
                        <span className="badge-in-collection">
                          <BookmarkCheck size={12} className="mr-1" /> EN TU COLECCIÓN
                        </span>
                      )}
                    </div>
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

                  {/* Secondary Technical Metadata: Rate & Notice Period */}
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

                  {/* Actions: Preview & Usar Voz */}
                  <div className="card-actions-row">
                    {voice.previewUrl ? (
                      <button
                        type="button"
                        className={`btn-card-preview ${isPlaying ? "playing" : ""}`}
                        onClick={() =>
                          handlePlayVoicePreview(voice.voiceId, voice.previewUrl)
                        }
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

                    {(() => {
                      const isUnavailableToAdd = !isInCollection && !voice.publicOwnerId;
                      const requiresAuth = !isInCollection && !isAuthenticated;
                      return (
                        <button
                          type="button"
                          className={`btn-card-use-voice ${isSelected ? "selected" : ""} ${requiresAuth ? "btn-auth-locked" : ""}`}
                          onClick={() => handleUseVoice(voice)}
                          disabled={isAdding || isUnavailableToAdd}
                          title={requiresAuth ? "Conecta tu acceso para usar esta acción" : undefined}
                        >
                          {isAdding ? (
                            <>
                              <Loader2 size={14} className="animate-spin mr-1.5" /> Añadiendo voz...
                            </>
                          ) : isSelected ? (
                            <>
                              <Check size={14} className="mr-1.5" /> En uso
                            </>
                          ) : isInCollection ? (
                            <>
                              <Check size={14} className="mr-1.5" /> Usar voz
                            </>
                          ) : isUnavailableToAdd ? (
                            "No disponible para añadir"
                          ) : requiresAuth ? (
                            "Conecta tu acceso para usar esta acción"
                          ) : (
                            "Usar voz"
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOTÓN CARGAR MÁS */}
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
                  <span>CARGAR MÁS VOCES ({CATALOG_PAGE_SIZE} más)</span>
                </>
              )}
            </button>
          </div>
        )}

        {!hasMore && libraryVoices.length > 0 && !isLoadingCatalog && (
          <div className="catalog-end-note">
            <span>Has visto todas las {libraryVoices.length} voces cargadas para esta selección.</span>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 5. MODELO Y FORMATO CON CONFIGURACIÓN AVANZADA             */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="technical-controls-grid">
        {/* MODELO TTS */}
        <div className="tech-box">
          <div className="tech-box-header">
            <span className="section-eyebrow">MODELO TTS</span>
            <span className="tech-badge-rec">RECOMENDADO</span>
          </div>
          <div className="tech-main-choice">
            <h4 className="tech-choice-title">
              {models.find((m) => m.modelId === selectedModelId)?.name ||
                "Eleven Multilingual v2"}
            </h4>
            <p className="tech-choice-desc">{getModelDescription(selectedModelId)}</p>
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
              <span className="advanced-sublabel">Formatos certificados por Gateway:</span>
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
      {/* 6. BARRA DE ACCIÓN Y GENERACIÓN BATCH                      */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="studio-bottom-action-bar">
        <div className="action-bar-left">
          <button
            type="button"
            className="btn-apply-batch"
            onClick={handleApplyClick}
            disabled={isGenerating || totalCount === 0}
            title="Aplica la voz, modelo y formato seleccionados a las escenas pendientes"
          >
            <Sliders size={16} className="mr-2" />
            <span>Aplicar Configuración a Escenas</span>
          </button>
          {appliedNotice && (
            <span className="applied-pill-notice animate-fade-in">
              <Check size={14} className="mr-1 text-emerald" /> ¡Configuración aplicada!
            </span>
          )}
        </div>

        <div className="action-bar-right">
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
              className={`btn-generate-main ${!isAuthenticated ? "btn-auth-locked" : ""}`}
              onClick={onGenerateAll}
              disabled={totalCount === 0 || readyCount === totalCount || !isAuthenticated}
              title={!isAuthenticated ? "Conecta tu acceso para usar esta acción" : undefined}
            >
              <Volume2 size={18} className="mr-2" />
              <span>
                {!isAuthenticated
                  ? "Conecta tu acceso para usar esta acción"
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
            <button
              type="button"
              className="btn-export-zip-main"
              onClick={onExportZip}
              disabled={isGenerating}
            >
              <PackageCheck size={18} className="mr-2 text-emerald" />
              <span>Descargar ZIP ({readyCount})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
