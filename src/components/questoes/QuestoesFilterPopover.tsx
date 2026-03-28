"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Search, Clock } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import type { QuestoesFilters } from "@/contexts/QuestoesContext";
import { useFiltrosDicionario } from "@/hooks/useFiltrosDicionario";
import {
  getCategoryItems,
  type FilterCategoryConfig,
  type FilterItem,
} from "./filter-config";
import { useFilterKeyboardNav } from "./use-filter-keyboard-nav";
import { useRecentFilters } from "./use-recent-filters";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestoesFilterPopoverProps {
  category: FilterCategoryConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Pre-fill / live-update the search input (from slash command) */
  initialSearch?: string;
  /** Incrementing number — each bump selects the first filtered item */
  selectFirstSignal?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 32;
const VIRTUAL_THRESHOLD = 100;
const DEBOUNCE_MS = 200;

/**
 * Coerce a FilterItem value to the type expected by the context for a given key.
 * `anos` expects numbers; everything else expects strings.
 */
function coerceValue(
  categoryKey: string,
  value: string,
): string | number {
  return categoryKey === "anos" ? Number(value) : value;
}

/**
 * Get the currently selected values for a category from the filters object.
 */
function getSelectedValues(
  categoryKey: string,
  filters: QuestoesFilters,
): (string | number)[] {
  const raw = filters[categoryKey as keyof QuestoesFilters];
  if (Array.isArray(raw)) return raw as (string | number)[];
  return [];
}

// ---------------------------------------------------------------------------
// Sub-component: Virtualized checkbox list
// ---------------------------------------------------------------------------

interface CheckboxListProps {
  items: FilterItem[];
  categoryKey: string;
  selectedSet: Set<string>;
  highlightedIndex: number;
  maxCount: number;
  onToggle: (item: FilterItem) => void;
  onHover: (index: number) => void;
}

function CheckboxList({
  items,
  categoryKey,
  selectedSet,
  highlightedIndex,
  maxCount,
  onToggle,
  onHover,
}: CheckboxListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = items.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  // Scroll highlighted row into view
  useEffect(() => {
    if (useVirtual && highlightedIndex >= 0) {
      virtualizer.scrollToIndex(highlightedIndex, { align: "auto" });
    }
  }, [highlightedIndex, useVirtual, virtualizer]);

  // For non-virtual lists, scroll the highlighted row into view
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (!useVirtual && highlightedIndex >= 0) {
      const el = rowRefs.current.get(highlightedIndex);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, useVirtual]);

  const renderRow = (item: FilterItem, index: number, style?: React.CSSProperties) => {
    const checked = selectedSet.has(String(item.value));
    const isHighlighted = index === highlightedIndex;
    // Count placeholder (real counts would come from API stats; use 0 for now)
    const count = 0;
    const barWidth = maxCount > 0 ? Math.max((count / maxCount) * 100, 0) : 0;

    return (
      <div
        key={`${categoryKey}-${item.value}`}
        ref={(el) => {
          if (el && !useVirtual) rowRefs.current.set(index, el);
        }}
        role="option"
        aria-selected={checked}
        style={{
          height: ROW_HEIGHT,
          background: isHighlighted
            ? checked
              ? "#FEF3C7"
              : "#F9FAFB"
            : checked
              ? "#FFFBEB"
              : "transparent",
          ...style,
        }}
        className="flex items-center gap-2 px-3 cursor-pointer select-none transition-colors duration-75"
        onClick={() => onToggle(item)}
        onMouseEnter={() => onHover(index)}
      >
        {/* Checkbox */}
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            border: checked ? "1.5px solid #E8930C" : "1.5px solid #d0d3d9",
            background: checked ? "#E8930C" : "#fff",
            flexShrink: 0,
          }}
          className="inline-flex items-center justify-center transition-colors duration-100"
        >
          {checked && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
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
          className="flex-1 truncate text-[12px] text-gray-700"
          title={item.label}
        >
          {item.label}
        </span>

        {/* Count + progress bar */}
        {maxCount > 0 && (
          <>
            <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
              {count}
            </span>
            <div
              style={{ width: 40, height: 5, borderRadius: 3, background: "#eef0f3" }}
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
  };

  if (useVirtual) {
    return (
      <div
        ref={parentRef}
        style={{ maxHeight: 220, overflowY: "auto" }}
        className="scrollbar-thin"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const item = items[vRow.index];
            return renderRow(item, vRow.index, {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vRow.start}px)`,
            });
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{ maxHeight: 220, overflowY: "auto" }}
      className="scrollbar-thin"
    >
      {items.map((item, i) => renderRow(item, i))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuestoesFilterPopover({
  category,
  open,
  onOpenChange,
  children,
  initialSearch,
  selectFirstSignal,
}: QuestoesFilterPopoverProps) {
  const { filters, toggleFilter, setFilter } = useQuestoesContext();
  const { dicionario } = useFiltrosDicionario();
  const { recents, addRecent } = useRecentFilters(category.key);

  // --- All items for this category ---
  const allItems = useMemo(
    () => getCategoryItems(category.key, dicionario),
    [category.key, dicionario],
  );

  // --- Search state with debounce ---
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(val);
    }, DEBOUNCE_MS);
  }, []);

  // --- Live-update search from slash command ---
  useEffect(() => {
    if (open && initialSearch !== undefined) {
      setRawQuery(initialSearch);
      setDebouncedQuery(initialSearch);
    }
  }, [open, initialSearch]);

  // --- Reset search on close ---
  useEffect(() => {
    if (!open) {
      setRawQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  // --- Filtered items ---
  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return allItems;
    const q = debouncedQuery.trim().toLowerCase();
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(q),
    );
  }, [allItems, debouncedQuery]);

  // --- Select first filtered item when signaled (space/enter/comma in slash mode) ---
  const prevSignalRef = useRef(selectFirstSignal);
  useEffect(() => {
    if (selectFirstSignal !== undefined && selectFirstSignal !== prevSignalRef.current) {
      prevSignalRef.current = selectFirstSignal;
      if (filteredItems.length > 0) {
        const item = filteredItems[0];
        const val = category.key === "anos" ? Number(item.value) : item.value;
        toggleFilter(category.key as keyof QuestoesFilters, val as string | number);
      }
    }
  }, [selectFirstSignal, filteredItems, category.key, toggleFilter]);

  // --- Selection set (as strings for uniform comparison) ---
  const selectedValues = getSelectedValues(category.key, filters);
  const selectedSet = useMemo(
    () => new Set(selectedValues.map(String)),
    [selectedValues],
  );

  // Track selections at open time to detect changes on close
  const openSelectionsRef = useRef<Set<string>>(new Set());

  // --- On open/close ---
  useEffect(() => {
    if (open) {
      // Reset search
      setRawQuery("");
      setDebouncedQuery("");
      // Snapshot current selections
      openSelectionsRef.current = new Set(selectedValues.map(String));
      // Focus search input after Radix renders
      requestAnimationFrame(() => {
        searchRef.current?.focus();
      });
    } else {
      // On close, save to recents if selections changed
      const current = new Set(selectedValues.map(String));
      const prev = openSelectionsRef.current;
      const changed =
        current.size !== prev.size ||
        [...current].some((v) => !prev.has(v));
      if (changed && current.size > 0) {
        addRecent([...current]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // --- Toggle handler ---
  const handleToggle = useCallback(
    (item: FilterItem) => {
      toggleFilter(
        category.key as keyof QuestoesFilters,
        coerceValue(category.key, String(item.value)),
      );
    },
    [category.key, toggleFilter],
  );

  // --- Keyboard nav ---
  const {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
  } = useFilterKeyboardNav({
    itemCount: filteredItems.length,
    onSelect: (index) => {
      const item = filteredItems[index];
      if (item) handleToggle(item);
    },
    onClose: () => onOpenChange(false),
    enabled: open,
  });

  // --- Footer actions ---
  const handleSelectAll = useCallback(() => {
    const values = filteredItems.map((item) =>
      coerceValue(category.key, String(item.value)),
    );
    if (category.key === "anos") {
      setFilter("anos", values as number[]);
    } else {
      setFilter(
        category.key as keyof QuestoesFilters,
        values as string[],
      );
    }
  }, [filteredItems, category.key, setFilter]);

  const handleInvert = useCallback(() => {
    for (const item of filteredItems) {
      toggleFilter(
        category.key as keyof QuestoesFilters,
        coerceValue(category.key, String(item.value)),
      );
    }
  }, [filteredItems, category.key, toggleFilter]);

  // --- Selected count text ---
  const selectedCount = selectedSet.size;
  const selectedLabel =
    selectedCount === 1 ? "1 selecionada" : `${selectedCount} selecionada(s)`;

  // Max count for progress bars (placeholder - would be filled by real data)
  const maxCount = 0;

  // Is this popover driven by slash command? (initialSearch is defined)
  const isSlashMode = initialSearch !== undefined;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        sideOffset={6}
        align="start"
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => {
          // When opened via slash, keep focus on the main search input
          if (isSlashMode) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          // In slash mode, don't close when clicking the main search input
          if (isSlashMode) e.preventDefault();
        }}
        className="p-0 outline-none"
        style={{
          width: 400,
          borderRadius: 14,
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #e0e3e8",
          background: "#fff",
        }}
      >
        {/* ---- Search input (disabled in slash mode — main input controls text) ---- */}
        <div className="px-3 pt-3 pb-1.5">
          <div
            className="flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 transition-colors"
            style={{
              borderColor: isSlashMode ? "#E8930C" : "#e0e3e8",
            }}
          >
            <Search size={14} className="text-gray-400 shrink-0" />
            {isSlashMode ? (
              <span className="flex-1 text-[12px] text-gray-700" style={{ lineHeight: "20px" }}>
                {rawQuery || <span className="text-gray-400">digitando no input...</span>}
              </span>
            ) : (
              <input
                ref={searchRef}
                type="text"
                value={rawQuery}
                onChange={handleSearchChange}
                placeholder={`Buscar ${category.label.toLowerCase()}...`}
                className="flex-1 bg-transparent text-[12px] text-gray-700 placeholder:text-gray-400 outline-none"
                style={{ lineHeight: "20px" }}
                onFocus={(e) => {
                  const parent = e.currentTarget.parentElement;
                  if (parent) parent.style.borderColor = "#E8930C";
                }}
                onBlur={(e) => {
                  const parent = e.currentTarget.parentElement;
                  if (parent) parent.style.borderColor = "#e0e3e8";
                }}
              />
            )}
          </div>
        </div>

        {/* ---- Keyboard hints ---- */}
        <div className="px-3 pb-1.5">
          <span className="text-[10px] text-gray-400">
            {"\u2191\u2193 navegar \u00B7 Enter selecionar \u00B7 Esc fechar"}
          </span>
        </div>

        {/* ---- Recentes section ---- */}
        {recents.length > 0 && !debouncedQuery && (
          <div className="px-3 pb-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Recentes
            </div>
            {recents.slice(0, 3).map((entry, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (category.key === "anos") {
                    setFilter("anos", entry.values.map(Number));
                  } else {
                    setFilter(
                      category.key as keyof QuestoesFilters,
                      entry.values as string[],
                    );
                  }
                }}
                className="flex items-center gap-1.5 w-full text-left text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded px-1.5 py-1 transition-colors"
              >
                <Clock size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">{entry.values.join(", ")}</span>
              </button>
            ))}
          </div>
        )}

        {/* ---- Column header ---- */}
        <div
          className="flex items-center justify-between px-3 py-1 border-t border-b"
          style={{ borderColor: "#f0f1f3" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
            {category.label}
          </span>
          {maxCount > 0 && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              Total
            </span>
          )}
        </div>

        {/* ---- Checkbox list ---- */}
        {filteredItems.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-gray-400">
            Nenhum resultado encontrado
          </div>
        ) : (
          <CheckboxList
            items={filteredItems}
            categoryKey={category.key}
            selectedSet={selectedSet}
            highlightedIndex={highlightedIndex}
            maxCount={maxCount}
            onToggle={handleToggle}
            onHover={setHighlightedIndex}
          />
        )}

        {/* ---- Footer ---- */}
        <div
          className="flex items-center justify-between px-3 py-2 border-t"
          style={{ borderColor: "#f0f1f3" }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-medium text-[#E8930C] hover:text-[#B45309] transition-colors cursor-pointer"
            >
              Selecionar todos
            </button>
            <button
              type="button"
              onClick={handleInvert}
              className="text-[11px] font-medium text-[#E8930C] hover:text-[#B45309] transition-colors cursor-pointer"
            >
              Inverter
            </button>
          </div>
          {selectedCount > 0 && (
            <span className="text-[11px] font-medium text-gray-500">
              {selectedLabel} &#10003;
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
