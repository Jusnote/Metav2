"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, Search } from "lucide-react";
import {
  FILTER_CATEGORIES,
  type FilterCategoryConfig,
  getCategoryItems,
  type FilterItem,
} from "./filter-config";
import { useFiltrosDicionario } from "@/hooks/useFiltrosDicionario";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import type { QuestoesFilters } from "@/contexts/QuestoesContext";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestoesFilterSheetProps {
  open: boolean;
  onClose: () => void;
  /** When true, uses "Adicionar filtro" title and auto-closes after one selection. */
  slashMode?: boolean;
  /** If provided in slash mode, skip category list and drill directly into this category. */
  slashInitialCategory?: FilterCategoryConfig | null;
}

// ---------------------------------------------------------------------------
// Toggle config (same as QuestoesAdvancedPopover)
// ---------------------------------------------------------------------------

interface ToggleConfig {
  key: "excluirAnuladas" | "excluirDesatualizadas" | "excluirResolvidas";
  label: string;
  description: string;
}

const TOGGLES: ToggleConfig[] = [
  {
    key: "excluirAnuladas",
    label: "Excluir anuladas",
    description: "Remove questoes anuladas pela banca",
  },
  {
    key: "excluirDesatualizadas",
    label: "Excluir desatualizadas",
    description: "Legislacao desatualizada",
  },
  {
    key: "excluirResolvidas",
    label: "Excluir resolvidas",
    description: "Somente nao respondidas",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSelectedValues(
  categoryKey: string,
  filters: QuestoesFilters,
): (string | number)[] {
  const raw = filters[categoryKey as keyof QuestoesFilters];
  if (Array.isArray(raw)) return raw as (string | number)[];
  return [];
}

function coerceValue(categoryKey: string, value: string): string | number {
  return categoryKey === "anos" ? Number(value) : value;
}

function countForCategory(key: string, filters: QuestoesFilters): number {
  switch (key) {
    case "bancas":
      return filters.bancas.length;
    case "materias":
      return filters.materias.length;
    case "anos":
      return filters.anos.length;
    case "orgaos":
      return filters.orgaos.length;
    case "cargos":
      return filters.cargos.length;
    case "assuntos":
      return filters.assuntos.length;
    default:
      return 0;
  }
}

function advancedCount(filters: QuestoesFilters): number {
  return (
    (filters.excluirAnuladas ? 1 : 0) +
    (filters.excluirDesatualizadas ? 1 : 0) +
    (filters.excluirResolvidas ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch (identical to QuestoesAdvancedPopover)
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: checked ? "#E8930C" : "#e0e3e8",
        border: "none",
        padding: 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "transform 0.2s",
          transform: checked ? "translateX(18px)" : "translateX(0px)",
          display: "block",
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inner list view (drill-down for a single category)
// ---------------------------------------------------------------------------

interface InnerListProps {
  category: FilterCategoryConfig;
  onBack: () => void;
  onClose: () => void;
  /** When true (slash mode), auto-close sheet after selecting one value. */
  autoCloseOnSelect?: boolean;
}

function InnerListView({ category, onBack, onClose, autoCloseOnSelect }: InnerListProps) {
  const { filters, toggleFilter } = useQuestoesContext();
  const { dicionario } = useFiltrosDicionario();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const allItems = useMemo(
    () => getCategoryItems(category.key, dicionario),
    [category.key, dicionario],
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [allItems, query]);

  const selectedValues = getSelectedValues(category.key, filters);
  const selectedSet = useMemo(
    () => new Set(selectedValues.map(String)),
    [selectedValues],
  );

  const handleToggle = useCallback(
    (item: FilterItem) => {
      toggleFilter(
        category.key as keyof QuestoesFilters,
        coerceValue(category.key, String(item.value)),
      );
      if (autoCloseOnSelect) {
        onClose();
      }
    },
    [category.key, toggleFilter, autoCloseOnSelect, onClose],
  );

  // Focus search on mount
  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  // Max count for progress bars (placeholder)
  const maxCount = 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        style={{ padding: "12px 16px 4px 16px" }}
        className="flex items-center justify-between"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 cursor-pointer"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <ChevronLeft size={18} style={{ color: "#E8930C" }} />
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            {category.label}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#E8930C",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          Pronto
        </button>
      </div>

      {/* Breadcrumb */}
      <div style={{ padding: "0 16px 8px 16px" }}>
        <span style={{ fontSize: 10, color: "#a0a4ac" }}>
          Filtros{" "}
          <span style={{ color: "#c0c4cc" }}>&gt;</span>{" "}
          <span style={{ color: "#E8930C" }}>{category.label}</span>
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: "0 16px 8px 16px" }}>
        <div
          className="flex items-center gap-2"
          style={{
            height: 36,
            borderRadius: 10,
            border: "1px solid #e0e3e8",
            padding: "0 10px",
            background: "#fff",
          }}
        >
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filtrar ${category.label.toLowerCase()}...`}
            className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#f0f1f3" }} />

      {/* List */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {filteredItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-gray-400">
            Nenhum resultado encontrado
          </div>
        ) : (
          filteredItems.map((item) => {
            const checked = selectedSet.has(String(item.value));
            const count = 0;
            const barWidth =
              maxCount > 0 ? Math.max((count / maxCount) * 100, 0) : 0;

            return (
              <div
                key={`${category.key}-${item.value}`}
                onClick={() => handleToggle(item)}
                className="flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
                style={{
                  padding: "11px 16px",
                  background: checked ? "#FFFBEB" : "transparent",
                }}
              >
                {/* Checkbox (larger for touch) */}
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: checked
                      ? "1.5px solid #E8930C"
                      : "1.5px solid #d0d3d9",
                    background: checked ? "#E8930C" : "#fff",
                    flexShrink: 0,
                  }}
                  className="inline-flex items-center justify-center"
                >
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5.5L4 7.5L8 3"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                {/* Label */}
                <span
                  className="flex-1 truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 450,
                    color: "#374151",
                  }}
                >
                  {item.label}
                </span>

                {/* Count + progress bar */}
                {maxCount > 0 && (
                  <>
                    <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                      {count.toLocaleString("pt-BR")}
                    </span>
                    <div
                      style={{
                        width: 48,
                        height: 6,
                        borderRadius: 3,
                        background: "#eef0f3",
                      }}
                      className="shrink-0 overflow-hidden"
                    >
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: "100%",
                          borderRadius: 3,
                          background: checked
                            ? "linear-gradient(90deg, #F59E0B, #E8930C)"
                            : "#d0d3d9",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "10px 16px",
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
          borderTop: "1px solid #f0f1f3",
          background: "#fafbfc",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: "#a0a4ac" }}>
          {allItems.length} {category.label.toLowerCase()}
        </span>
        {selectedSet.size > 0 && (
          <span
            style={{ fontSize: 11, fontWeight: 500, color: "#E8930C" }}
          >
            {selectedSet.size} selecionada{selectedSet.size !== 1 ? "s" : ""}{" "}
            &#10003;
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories view (main view)
// ---------------------------------------------------------------------------

interface CategoriesViewProps {
  onDrill: (cat: FilterCategoryConfig) => void;
  onClose: () => void;
  slashMode?: boolean;
}

function CategoriesView({ onDrill, onClose, slashMode: isSlashMode }: CategoriesViewProps) {
  const { filters, setFilter, clearFilters, activeFilterCount } =
    useQuestoesContext();
  const { dicionario } = useFiltrosDicionario();

  const advCount = advancedCount(filters);

  // Count of standard array filters
  const standardCount = useMemo(() => {
    return (
      filters.bancas.length +
      filters.materias.length +
      filters.anos.length +
      filters.orgaos.length +
      filters.cargos.length +
      filters.assuntos.length
    );
  }, [filters]);

  // Get first selected value text for subtitle
  const getSubtitle = useCallback(
    (cat: FilterCategoryConfig): string | null => {
      const selected = getSelectedValues(cat.key, filters);
      if (selected.length === 0) return null;
      if (selected.length === 1) return String(selected[0]);
      return `${selected.length} selecionados`;
    },
    [filters],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: "12px 16px 8px 16px" }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#1f2937",
          }}
        >
          {isSlashMode ? "Adicionar filtro" : "Filtros"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#E8930C",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          Pronto
        </button>
      </div>

      {/* Category rows */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {FILTER_CATEGORIES.map((cat) => {
          const count = countForCategory(cat.key, filters);
          const subtitle = getSubtitle(cat);
          const totalItems = getCategoryItems(cat.key, dicionario).length;
          const Icon = cat.icon;

          return (
            <div
              key={cat.key}
              onClick={() => onDrill(cat)}
              className="flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
              style={{ padding: "10px 16px" }}
            >
              {/* Icon square */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: cat.iconBg,
                }}
              >
                <Icon size={16} style={{ color: cat.iconStroke }} />
              </div>

              {/* Name + subtitle */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#374151",
                    }}
                  >
                    {cat.label}
                  </span>
                  {count > 0 && (
                    <>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#E8930C",
                          display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#E8930C",
                        }}
                      >
                        {subtitle}
                      </span>
                    </>
                  )}
                </div>
                {totalItems > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "#a0a4ac",
                    }}
                  >
                    {totalItems.toLocaleString("pt-BR")} opcoes
                  </span>
                )}
              </div>

              {/* Chevron */}
              <ChevronRight
                size={14}
                style={{ color: "#c0c4cc", flexShrink: 0 }}
              />
            </div>
          );
        })}

        {/* Advanced section divider */}
        <div
          className="relative flex items-center"
          style={{ padding: "16px 16px 8px 16px" }}
        >
          <div
            style={{ height: 1, background: "#e0e3e8" }}
            className="flex-1"
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#a0a4ac",
              background: "#fafbfc",
              padding: "0 8px",
            }}
          >
            Avancado
          </span>
          <div
            style={{ height: 1, background: "#e0e3e8" }}
            className="flex-1"
          />
        </div>

        {/* Toggle rows */}
        <div style={{ padding: "4px 16px 12px 16px" }} className="flex flex-col gap-4">
          {TOGGLES.map((toggle) => {
            const checked = filters[toggle.key] as boolean;
            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 450,
                      color: "#374151",
                    }}
                  >
                    {toggle.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#a0a4ac",
                    }}
                  >
                    {toggle.description}
                  </span>
                </div>
                <ToggleSwitch
                  checked={checked}
                  onChange={() => setFilter(toggle.key, !checked)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "10px 16px",
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
          borderTop: "1px solid #f0f1f3",
          background: "#fafbfc",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: activeFilterCount > 0 ? "#E8930C" : "#a0a4ac",
          }}
        >
          {standardCount > 0 && (
            <>{standardCount} filtro{standardCount !== 1 ? "s" : ""}</>
          )}
          {standardCount > 0 && advCount > 0 && " + "}
          {advCount > 0 && (
            <>{advCount} avanc.</>
          )}
          {activeFilterCount === 0 && "Nenhum filtro ativo"}
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#E8930C",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            Limpar tudo
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sheet component
// ---------------------------------------------------------------------------

export function QuestoesFilterSheet({ open, onClose, slashMode: isSlashMode, slashInitialCategory }: QuestoesFilterSheetProps) {
  const [drillCategory, setDrillCategory] =
    useState<FilterCategoryConfig | null>(null);

  // Slide direction: 'forward' when drilling in, 'backward' when going back
  const [slideDir, setSlideDir] = useState<"forward" | "backward">("forward");

  // Track whether we're actually rendered (for exit animation)
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  // When opening in slash mode with initial category, drill directly
  useEffect(() => {
    if (open && isSlashMode && slashInitialCategory) {
      setDrillCategory(slashInitialCategory);
    }
  }, [open, isSlashMode, slashInitialCategory]);

  // Open
  useEffect(() => {
    if (open) {
      setVisible(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    } else {
      setAnimating(false);
      // Wait for animation to finish before unmounting
      const timer = setTimeout(() => {
        setVisible(false);
        setDrillCategory(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleDrill = useCallback((cat: FilterCategoryConfig) => {
    setSlideDir("forward");
    setDrillCategory(cat);
  }, []);

  const handleBack = useCallback(() => {
    setSlideDir("backward");
    setDrillCategory(null);
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 30,
          opacity: animating ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "80vh",
          borderRadius: "20px 20px 0 0",
          background: "#fff",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.12)",
          zIndex: 40,
          transform: animating ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center shrink-0"
          style={{ padding: "10px 0 2px 0" }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "#d0d3d9",
            }}
          />
        </div>

        {/* Content area with slide transition */}
        <div
          style={{
            position: "relative",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* Categories view */}
          <div
            style={{
              position: drillCategory ? "absolute" : "relative",
              inset: 0,
              transform: drillCategory ? "translateX(-100%)" : "translateX(0)",
              transition: "transform 0.25s ease",
              display: "flex",
              flexDirection: "column",
              height: drillCategory ? "100%" : "auto",
              maxHeight: drillCategory ? undefined : "calc(80vh - 20px)",
              overflow: drillCategory ? "hidden" : "auto",
            }}
          >
            <CategoriesView onDrill={handleDrill} onClose={onClose} slashMode={isSlashMode} />
          </div>

          {/* Inner list view */}
          {drillCategory && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: "translateX(0)",
                transition: "transform 0.25s ease",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <InnerListView
                category={drillCategory}
                onBack={handleBack}
                onClose={onClose}
                autoCloseOnSelect={isSlashMode}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
