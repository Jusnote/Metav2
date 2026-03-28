"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useQuestoesContext } from "@/contexts/QuestoesContext";
import type { QuestoesFilters } from "@/contexts/QuestoesContext";
import { useIsSmall } from "@/hooks/use-small";
import { FILTER_CATEGORIES, type FilterCategoryConfig } from "./filter-config";
import { QuestoesFilterSheet } from "./QuestoesFilterSheet";

// ---------------------------------------------------------------------------
// QuestoesSearchBar
// ---------------------------------------------------------------------------
// Native <input> search bar replacing SmartSearchBarPlate.
// Features: debounced search, IA toggle, filter badge, Cmd+K shortcut,
// slash command for category filter dropdown.
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 500;

interface SlashMode {
  active: boolean;
  category: FilterCategoryConfig | null;
  query: string;
}

const SLASH_MODE_INITIAL: SlashMode = {
  active: false,
  category: null,
  query: "",
};

interface QuestoesSearchBarProps {
  /** Auto-focus the input on mount (used by Ctrl+K overlay) */
  autoFocus?: boolean;
  /** Called continuously while in slash mode — opens popover and streams search query */
  onSlashFilter?: (categoryKey: string, valueQuery: string) => void;
  /** Called when user confirms a value (space/enter/comma) — select first match */
  onSlashSelect?: () => void;
  /** Called when slash mode ends (escape, no match, etc.) */
  onSlashClose?: () => void;
}

/** Fuzzy match a typed string against category labels. Returns best match or null. */
function matchCategory(text: string): FilterCategoryConfig | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  // Exact prefix match first
  for (const cat of FILTER_CATEGORIES) {
    if (cat.label.toLowerCase().startsWith(lower)) return cat;
  }
  // Also match the key (e.g. "bancas" -> Banca)
  for (const cat of FILTER_CATEGORIES) {
    if (cat.key.toLowerCase().startsWith(lower)) return cat;
  }
  return null;
}

export function QuestoesSearchBar({ autoFocus = false, onSlashFilter, onSlashSelect, onSlashClose }: QuestoesSearchBarProps) {
  const { searchQuery, setSearchQuery, activeFilterCount, toggleFilter } =
    useQuestoesContext();
  const isMobile = useIsSmall();

  // ---- local state ----
  const [inputValue, setInputValue] = useState(searchQuery);
  const [semanticMode, setSemanticMode] = useState(false);
  const [slashMode, setSlashMode] = useState<SlashMode>(SLASH_MODE_INITIAL);
  const [inputFocused, setInputFocused] = useState(false);

  // Mobile slash mode — keyboard accessory bar
  const [mobileSlashActive, setMobileSlashActive] = useState(false);
  const [mobileSlashCategory, setMobileSlashCategory] =
    useState<FilterCategoryConfig | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Suggestion categories for mobile keyboard bar
  const MOBILE_SUGGESTIONS = FILTER_CATEGORIES.slice(0, 3); // banca, materia, ano

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local input in sync when context searchQuery resets externally
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Auto-focus when mounted in Ctrl+K overlay
  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  // ---- debounced commit to context ----
  const commitSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
    },
    [setSearchQuery],
  );

  const scheduleCommit = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => commitSearch(value), DEBOUNCE_MS);
    },
    [commitSearch],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- slash helpers ----
  const resetSlashMode = useCallback(() => {
    setSlashMode(SLASH_MODE_INITIAL);
  }, []);

  /** Remove the `/...` portion from the input value and return the clean text. */
  const stripSlashText = useCallback((val: string): string => {
    // Remove everything from the last `/` onwards
    const slashIdx = val.lastIndexOf("/");
    if (slashIdx === -1) return val;
    return val.slice(0, slashIdx).trimEnd();
  }, []);

  // (slash category/value selection now handled via onSlashFilter callback → opens pill popover)

  // ---- parse slash text: returns { catText, valueQuery, matched } ----
  const parseSlash = useCallback((afterSlash: string) => {
    const firstSpace = afterSlash.indexOf(" ");
    if (firstSpace === -1) {
      // Still typing category name
      return { catText: afterSlash, valueQuery: "", matched: matchCategory(afterSlash) };
    }
    const catText = afterSlash.slice(0, firstSpace);
    const valueQuery = afterSlash.slice(firstSpace + 1);
    return { catText, valueQuery, matched: matchCategory(catText) };
  }, []);

  // ---- input handler ----
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      const slashIdx = val.lastIndexOf("/");

      if (slashIdx !== -1) {
        const afterSlash = val.slice(slashIdx + 1);
        const { catText, valueQuery, matched } = parseSlash(afterSlash);
        const hasSpace = afterSlash.includes(" ");

        if (hasSpace && !matched) {
          // Typed space but no category match → treat as normal search
          resetSlashMode();
          onSlashClose?.();
          scheduleCommit(val);
          return;
        }

        // Update slash mode
        setSlashMode({ active: true, category: matched, query: afterSlash });

        if (matched && hasSpace) {
          // Category confirmed + typing value → stream to popover
          onSlashFilter?.(matched.key, valueQuery);
        } else if (matched && !hasSpace) {
          // Category matched but no space yet → open popover with empty search
          onSlashFilter?.(matched.key, "");
        }

        // Don't commit text search while in slash mode
        return;
      }

      // No `/` → exit slash mode
      if (slashMode.active) {
        resetSlashMode();
        onSlashClose?.();
      }
      scheduleCommit(val);
    },
    [scheduleCommit, slashMode.active, resetSlashMode, onSlashFilter, onSlashClose, parseSlash],
  );

  // ---- key handler ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (slashMode.active && slashMode.category) {
        const afterSlash = inputValue.slice(inputValue.lastIndexOf("/") + 1);
        const hasSpace = afterSlash.includes(" ");
        const valueQuery = hasSpace ? afterSlash.slice(afterSlash.indexOf(" ") + 1) : "";

        if (e.key === "Escape") {
          e.preventDefault();
          const cleaned = stripSlashText(inputValue);
          setInputValue(cleaned);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          commitSearch(cleaned);
          resetSlashMode();
          onSlashClose?.();
          return;
        }

        // Enter or comma with a value typed → select first match
        if ((e.key === "Enter" || e.key === ",") && hasSpace && valueQuery.trim()) {
          e.preventDefault();
          // Tell parent to select first match in popover
          onSlashSelect?.();

          if (e.key === ",") {
            // Stay in slash mode for more selections — reset value portion
            const slashIdx = inputValue.lastIndexOf("/");
            const catText = afterSlash.slice(0, afterSlash.indexOf(" "));
            setInputValue(inputValue.slice(0, slashIdx) + "/" + catText + " ");
            onSlashFilter?.(slashMode.category.key, "");
          } else {
            // Enter → done, clean input
            const cleaned = stripSlashText(inputValue);
            setInputValue(cleaned);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            commitSearch(cleaned);
            resetSlashMode();
            onSlashClose?.();
          }
          return;
        }

        return;
      }

      // Not in slash mode — Enter submits search
      if (e.key === "Enter") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        commitSearch(inputValue);
      }
    },
    [commitSearch, inputValue, slashMode, stripSlashText, resetSlashMode, onSlashClose, onSlashSelect, onSlashFilter],
  );

  // ---- Forward keyboard events to dropdown ----
  // The dropdowns use useFilterKeyboardNav which expects onKeyDown on a wrapper.
  // We capture key events from the input and forward them by wrapping in a
  // container that the dropdowns can use.
  const wrapperKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // The keyboard events bubble from the input through the wrapper to the dropdowns.
      // No action needed here — handled by the dropdown containers.
    },
    [],
  );

  // Note: Ctrl+K is handled by QuestoesPage (opens overlay mode)

  // ---- Close slash mode on click outside ----
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!slashMode.active) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        resetSlashMode();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [slashMode.active, resetSlashMode]);

  // ---- mobile keyboard bar handlers ----
  const handleMobileSlashTap = useCallback(() => {
    if (mobileSlashActive) {
      // Already active — deactivate
      setMobileSlashActive(false);
      setMobileSlashCategory(null);
    } else {
      setMobileSlashActive(true);
    }
  }, [mobileSlashActive]);

  const handleMobileSuggestionTap = useCallback(
    (cat: FilterCategoryConfig) => {
      setMobileSlashCategory(cat);
      setMobileSheetOpen(true);
    },
    [],
  );

  const handleMobileSheetClose = useCallback(() => {
    setMobileSheetOpen(false);
    setMobileSlashActive(false);
    setMobileSlashCategory(null);
  }, []);

  // ---- placeholder ----
  const placeholder = isMobile
    ? "Buscar..."
    : "Buscar questoes ou digite / para filtros...";

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      onKeyDown={wrapperKeyDown}
    >
      <div
        style={{
          height: 44,
          background: "#fff",
          border: "1px solid #e2e5ea",
          borderBottom: "none",
          borderRadius: "14px 14px 0 0",
          padding: "0 16px",
          gap: 10,
          display: "flex",
          alignItems: "center",
        }}
        className="questoes-search-bar focus-within:border-[#E8930C] focus-within:shadow-[0_0_0_3px_rgba(232,147,12,0.06)]"
      >
        {/* Search icon */}
        <Search size={16} color="#888" style={{ flexShrink: 0 }} />

        {/* Native input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setInputFocused(true)}
          onBlur={() => {
            // Delay to allow tap events on the keyboard bar to fire first
            setTimeout(() => setInputFocused(false), 150);
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: "#1a1a1a",
            minWidth: 0,
          }}
        />

        {/* IA toggle */}
        <button
          type="button"
          onClick={() => setSemanticMode((prev) => !prev)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 150ms ease",
            whiteSpace: "nowrap",
            flexShrink: 0,
            border: semanticMode ? "1px solid #7C3AED" : "1px solid #e0e0e0",
            color: semanticMode ? "#7C3AED" : "#888",
            background: semanticMode ? "#F4F0FF" : "transparent",
          }}
        >
          <span style={{ fontSize: 13 }}>&#x2728;</span> IA
        </button>

        {/* Active filter count badge */}
        {activeFilterCount > 0 && (
          <span
            style={{
              fontSize: 8,
              color: "#E8930C",
              background: "#FEF3C7",
              borderRadius: 8,
              padding: "2px 7px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""}
          </span>
        )}

        {/* Cmd+K shortcut badge — desktop only */}
        {!isMobile && (
          <kbd
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              background: "#f5f6f8",
              border: "1px solid #e8eaed",
              borderRadius: 4,
              padding: "2px 6px",
              color: "#888",
              whiteSpace: "nowrap",
              flexShrink: 0,
              lineHeight: 1.4,
            }}
          >
            &#8984;K
          </kbd>
        )}
      </div>

      {/* ---- Slash hint: shows matched category as user types ---- */}
      {slashMode.active && slashMode.category && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: "white",
            border: "1px solid #e8eaed",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontSize: 12,
            color: "#555",
            zIndex: 10,
          }}
        >
          <span style={{ color: "#E8930C", fontWeight: 600 }}>/</span>
          <span style={{ fontWeight: 500 }}>{slashMode.category.label}</span>
          <span style={{ color: "#bbb", fontSize: 10 }}>espaco para filtrar</span>
        </div>
      )}

      {/* ---- Mobile keyboard accessory bar ---- */}
      {isMobile && inputFocused && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 44,
            background: "#d1d3d9",
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            gap: 6,
            zIndex: 45,
          }}
        >
          {/* Slash button */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent input blur
              handleMobileSlashTap();
            }}
            style={{
              fontSize: 16,
              padding: "4px 12px",
              borderRadius: 8,
              background: mobileSlashActive ? "#E8930C" : "#fff",
              color: mobileSlashActive ? "#fff" : "#E8930C",
              fontWeight: 700,
              border: "2px solid #E8930C",
              cursor: "pointer",
              lineHeight: 1.2,
              flexShrink: 0,
            }}
          >
            /
          </button>

          {/* Suggestion buttons — shown when slash is active */}
          {mobileSlashActive &&
            MOBILE_SUGGESTIONS.map((cat) => {
              const isActive = mobileSlashCategory?.key === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    handleMobileSuggestionTap(cat);
                  }}
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: isActive ? "#E8930C" : "#fff",
                    color: isActive ? "#fff" : "#374151",
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 1.2,
                    flexShrink: 0,
                  }}
                >
                  {cat.label.toLowerCase()}
                </button>
              );
            })}
        </div>
      )}

      {/* ---- Mobile slash filter sheet ---- */}
      {isMobile && (
        <QuestoesFilterSheet
          open={mobileSheetOpen}
          onClose={handleMobileSheetClose}
          slashMode
          slashInitialCategory={mobileSlashCategory}
        />
      )}
    </div>
  );
}

export default QuestoesSearchBar;
