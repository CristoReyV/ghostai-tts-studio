/**
 * @file src/components/BatchControls.tsx
 * Modern Voice Library & Audio Studio Control Bar:
 * IDIOMA -> CATEGORÍA -> FILTROS SECUNDARIOS -> VOCES DISPONIBLES
 *
 * Fully dynamic ranking and filtering based exclusively on real API metadata.
 * ZERO hardcoded voice IDs.
 * Collapsible technical accordions for Model and Output Format.
 * Singleton audio preview player without memory leaks.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Globe,
  Filter,
  Layers,
} from "lucide-react";
import type { GatewayModel, GatewayVoice } from "../types/tts";
import {
  OFFICIAL_CATEGORIES,
  OFFICIAL_LANGUAGES,
  type OfficialCategory,
  type VoiceFilterCriteria,
  type VoiceAvailabilityMap,
  filterVoices,
  getRecommendedVoice,
  getAvailableAccents,
  getVoiceStyleTags,
  translateLanguage,
  translateAccent,
  translateGender,
  translateAge,
  getModelDescription,
} from "../services/voiceLibrary";

interface BatchControlsProps {
  voices: GatewayVoice[];
  models: GatewayModel[];
  selectedVoiceId: string;
  selectedModelId: string;
  selectedOutputFormat: string;
  selectedLanguage: string;
  selectedCategory: OfficialCategory | "all";
  availabilityMap?: VoiceAvailabilityMap;
  onSelectLanguage: (language: string) => void;
  onSelectCategory: (category: OfficialCategory | "all") => void;
  onSelectVoice: (voiceId: string) => void;
  onSelectModel: (modelId: string) => void;
  onSelectOutputFormat: (format: string) => void;
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
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  voices,
  models,
  selectedVoiceId,
  selectedModelId,
  selectedOutputFormat,
  selectedLanguage,
  selectedCategory,
  availabilityMap,
  onSelectLanguage,
  onSelectCategory,
  onSelectVoice,
  onSelectModel,
  onSelectOutputFormat,
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
}) => {
  // Global Audio Preview Singleton Player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Secondary Filters State
  const [selectedAccent, setSelectedAccent] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [isSecondaryFiltersOpen, setIsSecondaryFiltersOpen] = useState(false);

  // Popover menus state for Primary Filters
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isCatMenuOpen, setIsCatMenuOpen] = useState(false);

  // Refs for click outside to close dropdowns
  const langDropdownRef = useRef<HTMLDivElement | null>(null);
  const catDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isLangMenuOpen && langDropdownRef.current && !langDropdownRef.current.contains(target)) {
        setIsLangMenuOpen(false);
      }
      if (isCatMenuOpen && catDropdownRef.current && !catDropdownRef.current.contains(target)) {
        setIsCatMenuOpen(false);
      }
    };
    if (isLangMenuOpen || isCatMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isLangMenuOpen, isCatMenuOpen]);

  // UI state for modals & accordions
  const [appliedNotice, setAppliedNotice] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [isModelAdvancedOpen, setIsModelAdvancedOpen] = useState(false);
  const [isFormatAdvancedOpen, setIsFormatAdvancedOpen] = useState(false);

  // Available accents for the current language
  const availableAccents = useMemo(() => {
    return getAvailableAccents(voices, selectedLanguage);
  }, [voices, selectedLanguage]);

  // Current criteria
  const currentCriteria: VoiceFilterCriteria = useMemo(() => ({
    language: selectedLanguage,
    category: selectedCategory,
    accent: selectedAccent,
    gender: selectedGender,
    age: selectedAge,
  }), [selectedLanguage, selectedCategory, selectedAccent, selectedGender, selectedAge]);

  // Filtered voices according to current criteria
  const compatibleVoices = useMemo(() => {
    return filterVoices(voices, currentCriteria, availabilityMap);
  }, [voices, currentCriteria, availabilityMap]);

  // Recommended voice dynamically calculated
  const recommendedVoice = useMemo(() => {
    return getRecommendedVoice(voices, currentCriteria, availabilityMap);
  }, [voices, currentCriteria, availabilityMap]);

  // Currently selected voice object
  const activeSelectedVoice = useMemo(() => {
    return voices.find((v) => v.voiceId === selectedVoiceId) || recommendedVoice;
  }, [voices, selectedVoiceId, recommendedVoice]);

  // Other voices (up to 6) excluding the recommended voice if it is in the list
  const otherVoices = useMemo(() => {
    return compatibleVoices
      .filter((v) => v.voiceId !== recommendedVoice?.voiceId)
      .slice(0, 6);
  }, [compatibleVoices, recommendedVoice]);

  // Distinguish recommended vs manual override
  const isManualOverride = Boolean(
    recommendedVoice && selectedVoiceId && selectedVoiceId !== recommendedVoice.voiceId
  );

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

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Primary Filter Handlers: dynamically switch recommended voice
  const handleLanguageChange = (langCode: string) => {
    onSelectLanguage(langCode);
    setIsLangMenuOpen(false);
    // Reset accent filter if changing language
    setSelectedAccent("all");

    // Dynamic recommendation update:
    const newCriteria: VoiceFilterCriteria = {
      language: langCode,
      category: selectedCategory,
      accent: "all",
      gender: selectedGender,
      age: selectedAge,
    };
    const newRec = getRecommendedVoice(voices, newCriteria, availabilityMap);
    if (newRec) {
      onSelectVoice(newRec.voiceId);
    }
  };

  // Track previous category and language to sync recommendation when changed
  const prevCategoryRef = useRef<OfficialCategory | "all">(selectedCategory);
  const prevLangRef = useRef<string>(selectedLanguage);

  useEffect(() => {
    if (prevCategoryRef.current !== selectedCategory || prevLangRef.current !== selectedLanguage) {
      prevCategoryRef.current = selectedCategory;
      prevLangRef.current = selectedLanguage;

      const newCriteria: VoiceFilterCriteria = {
        language: selectedLanguage,
        category: selectedCategory,
        accent: selectedAccent,
        gender: selectedGender,
        age: selectedAge,
      };
      const newRec = getRecommendedVoice(voices, newCriteria, availabilityMap);
      if (newRec && newRec.voiceId !== selectedVoiceId) {
        onSelectVoice(newRec.voiceId);
      }
    }
  }, [selectedCategory, selectedLanguage, selectedAccent, selectedGender, selectedAge, voices, availabilityMap, onSelectVoice, selectedVoiceId]);

  const handleCategoryChange = (catCode: OfficialCategory | "all") => {
    onSelectCategory(catCode);
    setIsCatMenuOpen(false);

    // Dynamic recommendation update:
    const newCriteria: VoiceFilterCriteria = {
      language: selectedLanguage,
      category: catCode,
      accent: selectedAccent,
      gender: selectedGender,
      age: selectedAge,
    };
    const newRec = getRecommendedVoice(voices, newCriteria, availabilityMap);
    if (newRec) {
      onSelectVoice(newRec.voiceId);
    }
  };

  const handleSecondaryFilterChange = (
    type: "accent" | "gender" | "age",
    value: string
  ) => {
    let nextAccent = selectedAccent;
    let nextGender = selectedGender;
    let nextAge = selectedAge;

    if (type === "accent") {
      setSelectedAccent(value);
      nextAccent = value;
    }
    if (type === "gender") {
      setSelectedGender(value);
      nextGender = value;
    }
    if (type === "age") {
      setSelectedAge(value);
      nextAge = value;
    }

    const newCriteria: VoiceFilterCriteria = {
      language: selectedLanguage,
      category: selectedCategory,
      accent: nextAccent,
      gender: nextGender,
      age: nextAge,
    };
    const newRec = getRecommendedVoice(voices, newCriteria, availabilityMap);
    if (newRec) {
      onSelectVoice(newRec.voiceId);
    }
  };

  const activeCategoryDef = OFFICIAL_CATEGORIES.find((c) => c.id === selectedCategory);
  const activeLangOption = OFFICIAL_LANGUAGES.find((l) => l.code === selectedLanguage) || OFFICIAL_LANGUAGES[0];

  const hasActiveSecondaryFilters =
    selectedAccent !== "all" || selectedGender !== "all" || selectedAge !== "all";

  // Filtered for Explorer Modal
  const modalFilteredVoices = useMemo(() => {
    const q = explorerSearch.trim().toLowerCase();
    return compatibleVoices.filter((v) => {
      if (!q) return true;
      const nameMatch = v.name.toLowerCase().includes(q);
      const accentMatch = (v.labels?.accent || "").toLowerCase().includes(q);
      const descMatch = (v.labels?.descriptive || "").toLowerCase().includes(q);
      return nameMatch || accentMatch || descMatch;
    });
  }, [compatibleVoices, explorerSearch]);

  const handleApplyClick = () => {
    onApplyToPending();
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2400);
  };

  return (
    <div className="voice-studio-container">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. SECCIÓN PRINCIPAL: FILTROS DE IDIOMA Y CATEGORÍA       */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className={`studio-header-card ${isLangMenuOpen || isCatMenuOpen ? "has-open-dropdown" : ""}`}>
        <div className="studio-title-row">
          <div>
            <span className="section-eyebrow">BIBLIOTECA DE VOCES</span>
            <h2 className="studio-main-title">Configuración de Voz</h2>
          </div>
          <div className="selection-status-badge">
            <Layers size={14} className="mr-1 text-accent" />
            <span>{compatibleVoices.length} voces disponibles</span>
          </div>
        </div>

        {/* DOS FILTROS PRINCIPALES (GRANDES Y VISUALES) */}
        <div className="primary-filters-grid">
          {/* A) FILTRO IDIOMA */}
          <div
            ref={langDropdownRef}
            className={`filter-dropdown-container ${isLangMenuOpen ? "is-open" : ""}`}
          >
            <label className="filter-field-label">
              <Globe size={14} className="text-accent mr-1 inline" /> IDIOMA
            </label>
            <button
              type="button"
              className="primary-filter-trigger"
              onClick={() => {
                setIsLangMenuOpen(!isLangMenuOpen);
                setIsCatMenuOpen(false);
              }}
            >
              <span className="filter-trigger-icon">{activeLangOption.flag}</span>
              <div className="filter-trigger-info">
                <span className="filter-trigger-value">{activeLangOption.label}</span>
                <span className="filter-trigger-sub">
                  {selectedLanguage === "all" ? "Catálogo completo" : `Voces en ${activeLangOption.label}`}
                </span>
              </div>
              <ChevronDown size={18} className={`chevron-transition ${isLangMenuOpen ? "rotated" : ""}`} />
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
                    {selectedLanguage === lang.code && <Check size={16} className="text-accent ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* B) FILTRO CATEGORÍA */}
          <div
            ref={catDropdownRef}
            className={`filter-dropdown-container ${isCatMenuOpen ? "is-open" : ""}`}
          >
            <label className="filter-field-label">
              <Mic size={14} className="text-accent mr-1 inline" /> CATEGORÍA
            </label>
            <button
              type="button"
              className="primary-filter-trigger"
              onClick={() => {
                setIsCatMenuOpen(!isCatMenuOpen);
                setIsLangMenuOpen(false);
              }}
            >
              <span className="filter-trigger-icon">
                {activeCategoryDef ? activeCategoryDef.icon : "🌟"}
              </span>
              <div className="filter-trigger-info">
                <span className="filter-trigger-value">
                  {activeCategoryDef ? activeCategoryDef.label : "Todas las categorías"}
                </span>
                <span className="filter-trigger-sub">
                  {activeCategoryDef ? activeCategoryDef.description : "Sin filtro de uso"}
                </span>
              </div>
              <ChevronDown size={18} className={`chevron-transition ${isCatMenuOpen ? "rotated" : ""}`} />
            </button>

            {/* Popover de Categorías */}
            {isCatMenuOpen && (
              <div className="filter-popover-menu category-popover">
                <button
                  type="button"
                  className={`popover-option-item ${selectedCategory === "all" ? "active" : ""}`}
                  onClick={() => handleCategoryChange("all")}
                >
                  <span className="option-flag">🌟</span>
                  <div className="option-text-group">
                    <span className="option-name">Todas las categorías</span>
                    <span className="option-sub">Explorar todas las voces del idioma</span>
                  </div>
                  {selectedCategory === "all" && <Check size={16} className="text-accent ml-auto" />}
                </button>
                {OFFICIAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`popover-option-item ${selectedCategory === cat.id ? "active" : ""}`}
                    onClick={() => handleCategoryChange(cat.id)}
                  >
                    <span className="option-flag">{cat.icon}</span>
                    <div className="option-text-group">
                      <span className="option-name">{cat.label}</span>
                      <span className="option-sub">{cat.description}</span>
                    </div>
                    {selectedCategory === cat.id && <Check size={16} className="text-accent ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ⚙ MÁS FILTROS (ACORDEÓN COLAPSABLE) */}
        <div className="secondary-filters-section">
          <button
            type="button"
            className="secondary-toggle-btn"
            onClick={() => setIsSecondaryFiltersOpen(!isSecondaryFiltersOpen)}
          >
            <Filter size={14} className="mr-1 text-accent" />
            <span>⚙ Más Filtros</span>
            {hasActiveSecondaryFilters && <span className="active-dot-badge" />}
            {isSecondaryFiltersOpen ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
          </button>

          {isSecondaryFiltersOpen && (
            <div className="secondary-filters-panel">
              {/* Filtro Acento */}
              <div className="filter-pill-row">
                <span className="secondary-group-label">Acento:</span>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedAccent === "all" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("accent", "all")}
                >
                  Todos
                </button>
                {availableAccents.map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    className={`pill-filter-item ${selectedAccent === acc ? "active" : ""}`}
                    onClick={() => handleSecondaryFilterChange("accent", acc)}
                  >
                    {translateAccent(acc)}
                  </button>
                ))}
              </div>

              {/* Filtro Género */}
              <div className="filter-pill-row">
                <span className="secondary-group-label">Género:</span>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedGender === "all" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("gender", "all")}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedGender === "female" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("gender", "female")}
                >
                  Femenina
                </button>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedGender === "male" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("gender", "male")}
                >
                  Masculina
                </button>
              </div>

              {/* Filtro Edad */}
              <div className="filter-pill-row">
                <span className="secondary-group-label">Edad:</span>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedAge === "all" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("age", "all")}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedAge === "young" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("age", "young")}
                >
                  Joven
                </button>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedAge === "middle_aged" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("age", "middle_aged")}
                >
                  Adulta
                </button>
                <button
                  type="button"
                  className={`pill-filter-item ${selectedAge === "old" ? "active" : ""}`}
                  onClick={() => handleSecondaryFilterChange("age", "old")}
                >
                  Mayor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. VOZ RECOMENDADA (TARJETA GRANDE Y VISUAL)              */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="recommended-voice-showcase">
        <div className="section-eyebrow-row">
          <span className="section-eyebrow">
            <Sparkles size={14} className="text-accent inline mr-1" /> VOZ RECOMENDADA
          </span>
          {isManualOverride && (
            <span className="manual-override-tag">
              (Recomendada para {activeLangOption.label})
            </span>
          )}
        </div>

        {recommendedVoice ? (
          <div className={`hero-voice-card ${selectedVoiceId === recommendedVoice.voiceId ? "is-selected" : ""}`}>
            <div className="hero-voice-main">
              {/* Avatar Icon */}
              <div className="hero-voice-avatar">
                <Mic size={28} className="text-accent" />
                {playingVoiceId === recommendedVoice.voiceId && (
                  <span className="playing-pulse-indicator" />
                )}
              </div>

              {/* Voice Information */}
              <div className="hero-voice-details">
                <div className="hero-voice-header-line">
                  <h3 className="hero-voice-name">{recommendedVoice.name}</h3>
                  {selectedVoiceId === recommendedVoice.voiceId ? (
                    <span className="active-check-badge">
                      <Check size={14} className="mr-1" /> Seleccionada
                    </span>
                  ) : null}
                </div>

                {/* Metadata badges row */}
                <div className="hero-voice-tags-row">
                  <span className="voice-tag-item tag-lang">
                    {translateLanguage(recommendedVoice.labels?.language).flag}{" "}
                    {translateLanguage(recommendedVoice.labels?.language).label}
                  </span>
                  <span className="voice-tag-item tag-accent">
                    {translateAccent(recommendedVoice.labels?.accent)}
                  </span>
                  <span className="voice-tag-item tag-gender">
                    {translateGender(recommendedVoice.labels?.gender)}
                  </span>
                  <span className="voice-tag-item tag-age">
                    {translateAge(recommendedVoice.labels?.age)}
                  </span>
                  {getVoiceStyleTags(recommendedVoice).map((st) => (
                    <span key={st} className="voice-tag-item tag-style">
                      {st}
                    </span>
                  ))}
                </div>

                <p className="hero-voice-description">
                  {activeCategoryDef
                    ? `Recomendada para ${activeCategoryDef.label}: ${activeCategoryDef.description.toLowerCase()}.`
                    : recommendedVoice.labels?.descriptive
                    ? `Estilo ${recommendedVoice.labels.descriptive} optimizado para síntesis de alta calidad.`
                    : "Voz seleccionada por afinidad acústica y metadatos de categoría."}
                </p>
              </div>
            </div>

            {/* Actions: Play Preview & Select */}
            <div className="hero-voice-actions">
              {recommendedVoice.previewUrl ? (
                <button
                  type="button"
                  className={`btn-preview-listen ${playingVoiceId === recommendedVoice.voiceId ? "playing" : ""}`}
                  onClick={() => handlePlayVoicePreview(recommendedVoice.voiceId, recommendedVoice.previewUrl)}
                  title="Escuchar muestra oficial de ElevenLabs"
                >
                  {playingVoiceId === recommendedVoice.voiceId ? (
                    <>
                      <VolumeX size={16} className="mr-2" /> Detener muestra
                    </>
                  ) : (
                    <>
                      <Play size={16} className="mr-2" /> Escuchar muestra
                    </>
                  )}
                </button>
              ) : (
                <span className="preview-unavailable-note">Sin muestra</span>
              )}

              {selectedVoiceId !== recommendedVoice.voiceId ? (
                <button
                  type="button"
                  className="btn-select-voice"
                  onClick={() => onSelectVoice(recommendedVoice.voiceId)}
                >
                  <Check size={16} className="mr-1" /> Usar esta voz
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="hero-voice-card empty-card">
            <p>No se encontraron voces compatibles con los filtros seleccionados.</p>
          </div>
        )}

        {/* Si el usuario seleccionó manualmente otra voz, mostrar tarjeta de voz activa */}
        {isManualOverride && activeSelectedVoice && (
          <div className="manual-selected-override-card">
            <div className="override-card-header">
              <span className="badge-manual-selection">
                <Check size={14} className="mr-1" /> VOZ SELECCIONADA ACTUALMENTE (MANUAL)
              </span>
              <button
                type="button"
                className="btn-restore-recommendation"
                onClick={() => recommendedVoice && onSelectVoice(recommendedVoice.voiceId)}
                title="Volver a la recomendación automática"
              >
                <RotateCcw size={12} className="mr-1" /> Restaurar recomendada ({recommendedVoice?.name})
              </button>
            </div>
            <div className="override-card-body">
              <div className="override-info">
                <h4>{activeSelectedVoice.name}</h4>
                <div className="hero-voice-tags-row">
                  <span className="voice-tag-item tag-lang">
                    {translateLanguage(activeSelectedVoice.labels?.language).flag}{" "}
                    {translateLanguage(activeSelectedVoice.labels?.language).label}
                  </span>
                  <span className="voice-tag-item tag-accent">
                    {translateAccent(activeSelectedVoice.labels?.accent)}
                  </span>
                  <span className="voice-tag-item tag-gender">
                    {translateGender(activeSelectedVoice.labels?.gender)}
                  </span>
                </div>
              </div>
              {activeSelectedVoice.previewUrl && (
                <button
                  type="button"
                  className="btn-preview-mini"
                  onClick={() => handlePlayVoicePreview(activeSelectedVoice.voiceId, activeSelectedVoice.previewUrl)}
                >
                  {playingVoiceId === activeSelectedVoice.voiceId ? <VolumeX size={14} /> : <Play size={14} />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. OTRAS VOCES PARA ESTA SELECCIÓN                         */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="other-voices-section">
        <div className="other-voices-header">
          <h3 className="other-voices-title">
            Otras voces para{" "}
            <span className="category-highlight">
              {activeCategoryDef ? activeCategoryDef.label : activeLangOption.label}
            </span>
          </h3>
          <span className="other-count-note">
            {compatibleVoices.length} disponibles
          </span>
        </div>

        {otherVoices.length > 0 ? (
          <div className="other-voices-grid">
            {otherVoices.map((voice) => {
              const isVoiceActive = selectedVoiceId === voice.voiceId;
              const isPlaying = playingVoiceId === voice.voiceId;
              return (
                <div
                  key={voice.voiceId}
                  className={`other-voice-card ${isVoiceActive ? "active" : ""}`}
                >
                  <div className="other-card-top">
                    <button
                      type="button"
                      className={`btn-play-circle ${isPlaying ? "playing" : ""}`}
                      onClick={() => handlePlayVoicePreview(voice.voiceId, voice.previewUrl)}
                      disabled={!voice.previewUrl}
                      title={voice.previewUrl ? "Escuchar muestra" : "Sin muestra disponible"}
                    >
                      {isPlaying ? <VolumeX size={14} /> : <Play size={14} />}
                    </button>
                    <div className="other-card-titles">
                      <span className="other-voice-name">{voice.name}</span>
                      <span className="other-voice-sub">
                        {translateLanguage(voice.labels?.language).flag}{" "}
                        {translateAccent(voice.labels?.accent)} · {translateGender(voice.labels?.gender)}
                      </span>
                    </div>
                  </div>

                  <div className="other-card-bottom">
                    <div className="other-tags-wrap">
                      {getVoiceStyleTags(voice).slice(0, 2).map((tag) => (
                        <span key={tag} className="tag-micro">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={`btn-select-micro ${isVoiceActive ? "selected" : ""}`}
                      onClick={() => onSelectVoice(voice.voiceId)}
                    >
                      {isVoiceActive ? (
                        <>
                          <Check size={12} className="mr-1" /> Activa
                        </>
                      ) : (
                        "Seleccionar"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-extra-voices-box">
            <p>
              {compatibleVoices.length <= 1
                ? "No hay voces adicionales en esta categoría específica."
                : "Usa el catálogo completo para explorar más opciones."}
            </p>
          </div>
        )}

        {/* BOTÓN: VER TODAS LAS VOCES */}
        <div className="see-all-voices-row">
          <button
            type="button"
            className="btn-see-all-voices"
            onClick={() => {
              setExplorerSearch("");
              setIsExplorerOpen(true);
            }}
          >
            <Layers size={16} className="mr-2 text-accent" />
            VER TODAS LAS VOCES · {compatibleVoices.length}
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. MODELO Y FORMATO CON CONFIGURACIÓN AVANZADA             */}
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
              {models.find((m) => m.modelId === selectedModelId)?.name || "Eleven Multilingual v2"}
            </h4>
            <p className="tech-choice-desc">
              {getModelDescription(selectedModelId)}
            </p>
          </div>

          <button
            type="button"
            className="tech-advanced-toggle"
            onClick={() => setIsModelAdvancedOpen(!isModelAdvancedOpen)}
          >
            <Settings size={14} className="mr-1 text-accent" />
            <span>⚙ Configuración avanzada de modelo</span>
            {isModelAdvancedOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
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
                      <span className="item-btn-desc">{getModelDescription(m.modelId, m.description)}</span>
                    </div>
                    {selectedModelId === m.modelId && <Check size={16} className="text-accent" />}
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
            {isFormatAdvancedOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>

          {isFormatAdvancedOpen && (
            <div className="advanced-options-panel">
              <span className="advanced-sublabel">Formatos certificados por Gateway:</span>
              <div className="advanced-list">
                {[
                  { id: "mp3_44100_128", label: "MP3 · 44.1 kHz · 128 kbps (Recomendado)" },
                  { id: "mp3_44100_192", label: "MP3 · 44.1 kHz · 192 kbps (Alta fidelidad)" },
                  { id: "pcm_44100", label: "PCM WAV · 44.1 kHz (Sin compresión)" },
                  { id: "pcm_24000", label: "PCM WAV · 24.0 kHz (Baja latencia)" },
                  { id: "mp3_22050_32", label: "MP3 · 22.05 kHz · 32 kbps (Compacto)" },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    className={`advanced-item-btn ${selectedOutputFormat === fmt.id ? "active" : ""}`}
                    onClick={() => onSelectOutputFormat(fmt.id)}
                  >
                    <span className="item-btn-name">{fmt.label}</span>
                    {selectedOutputFormat === fmt.id && <Check size={16} className="text-accent" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 5. BARRA DE ACCIÓN Y GENERACIÓN BATCH                      */}
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
              className="btn-generate-main"
              onClick={onGenerateAll}
              disabled={totalCount === 0 || readyCount === totalCount}
            >
              <Volume2 size={18} className="mr-2" />
              <span>Generar Todas las Narraciones ({readyCount}/{totalCount})</span>
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

      {/* ────────────────────────────────────────────────────────── */}
      {/* 6. MODAL VISUAL: BIBLIOTECA COMPLETA DE VOCES              */}
      {/* ────────────────────────────────────────────────────────── */}
      {isExplorerOpen && (
        <div className="explorer-modal-backdrop" onClick={() => setIsExplorerOpen(false)}>
          <div
            className="explorer-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="explorer-modal-header">
              <div>
                <span className="section-eyebrow">BIBLIOTECA DE VOCES</span>
                <h3 className="explorer-modal-title">
                  Voces para {activeLangOption.label} · {activeCategoryDef ? activeCategoryDef.label : "Todas"}
                </h3>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setIsExplorerOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="explorer-search-row">
              <div className="search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar voz por nombre, estilo o acento..."
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  className="search-text-input"
                  autoFocus
                />
                {explorerSearch && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setExplorerSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span className="results-count-badge">
                {modalFilteredVoices.length} voces
              </span>
            </div>

            {/* Modal Voices Grid */}
            <div className="explorer-modal-body">
              {modalFilteredVoices.length > 0 ? (
                <div className="modal-cards-grid">
                  {modalFilteredVoices.map((voice) => {
                    const isSelected = selectedVoiceId === voice.voiceId;
                    const isPlaying = playingVoiceId === voice.voiceId;
                    return (
                      <div
                        key={voice.voiceId}
                        className={`modal-voice-card ${isSelected ? "selected" : ""}`}
                      >
                        <div className="modal-card-header">
                          <div className="modal-avatar">
                            <Mic size={18} className="text-accent" />
                          </div>
                          <div className="modal-name-group">
                            <h4 className="modal-voice-name">{voice.name}</h4>
                            <span className="modal-voice-sub">
                              {translateLanguage(voice.labels?.language).flag}{" "}
                              {translateAccent(voice.labels?.accent)} · {translateGender(voice.labels?.gender)}
                            </span>
                          </div>
                          {voice.previewUrl && (
                            <button
                              type="button"
                              className={`modal-play-btn ${isPlaying ? "playing" : ""}`}
                              onClick={() => handlePlayVoicePreview(voice.voiceId, voice.previewUrl)}
                            >
                              {isPlaying ? <VolumeX size={14} /> : <Play size={14} />}
                            </button>
                          )}
                        </div>

                        <div className="modal-card-tags">
                          <span className="tag-micro">{translateAge(voice.labels?.age)}</span>
                          {getVoiceStyleTags(voice).map((tag) => (
                            <span key={tag} className="tag-micro">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          className={`btn-modal-select ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            onSelectVoice(voice.voiceId);
                            setIsExplorerOpen(false);
                          }}
                        >
                          {isSelected ? (
                            <>
                              <Check size={14} className="mr-1" /> Seleccionada
                            </>
                          ) : (
                            "Seleccionar voz"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="modal-empty-state">
                  <p>No se encontraron voces que coincidan con la búsqueda.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
