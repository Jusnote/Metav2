"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useQuestoesContext } from "@/contexts/QuestoesContext";
import type { QuestoesFilters } from "@/contexts/QuestoesContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { FILTER_CATEGORIES, type FilterCategoryConfig } from "./filter-config";
import { QuestoesSlashDropdown } from "./QuestoesSlashDropdown";
import { QuestoesSlashFilterDropdown } from "./QuestoesSlashFilterDropdown";
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

export function QuestoesSearchBar() {
  const { searchQuery, setSearchQuery, activeFilterCount, toggleFilter } =
    useQuestoesContext();
  const isMobile = useIsMobile();

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

  // ---- slash category selected ----
  const handleSlashCategorySelect = useCallback(
    (category: FilterCategoryConfig) => {
      setSlashMode({ active: true, category, query: "" });
      // Focus back to input for typing the filter value query
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [],
  );

  // ---- slash value selected ----
  const handleSlashValueSelect = useCallback(
    (value: string | number) => {
      if (!slashMode.category) return;

      // Apply the filter
      toggleFilter(
        slashMode.category.key as keyof QuestoesFilters,
        value,
      );

      // Remove `/...` text from input
      const cleaned = stripSlashText(inputValue);
      setInputValue(cleaned);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      commitSearch(cleaned);

      // Reset slash mode
      resetSlashMode();

      // Re-focus input
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [slashMode.category, toggleFilter, stripSlashText, inputValue, commitSearch, resetSlashMode],
  );

  // ---- input handler ----
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      // Find last `/` position
      const slashIdx = val.lastIndexOf("/");

      if (slashIdx !== -1) {
        const afterSlash = val.slice(slashIdx + 1);

        if (slashMode.active && slashMode.category) {
          // Already have a category — update the query
          setSlashMode((prev) => ({ ...prev, query: afterSlash }));
        } else if (!slashMode.category) {
          // No category yet — show category picker
          setSlashMode({ active: true, category: null, query: afterSlash });
        }

        // Don't commit search while in slash mode
        return;
      } else {
        // No `/` in the input — exit slash mode
        if (slashMode.active) {
          resetSlashMode();
        }
      }

      scheduleCommit(val);
    },
    [scheduleCommit, slashMode.active, slashMode.category, resetSlashMode],
  );

  // ---- key handler ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // If in slash mode, let the dropdowns handle arrow/enter/escape via their own keydown
      if (slashMode.active) {
        if (e.key === "Escape") {
          e.preventDefault();
          const cleaned = stripSlashText(inputValue);
          setInputValue(cleaned);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          commitSearch(cleaned);
          resetSlashMode();
          return;
        }

        if (e.key === "Backspace") {
          // If slash is the only remaining char after the base text, cancel
          const slashIdx = inputValue.lastIndexOf("/");
          if (slashIdx !== -1 && inputValue.slice(slashIdx) === "/") {
            // The `/` will be removed by the native input; just reset
            resetSlashMode();
          } else if (slashMode.category && slashMode.query === "") {
            // Category selected but no query typed yet — go back to category picker
            e.preventDefault();
            setSlashMode({ active: true, category: null, query: "" });
          }
          return;
        }

        // For Enter and arrow keys, we don't prevent default here — the dropdown
        // components handle those via their own onKeyDown that propagates from the wrapper.
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        commitSearch(inputValue);
      }
    },
    [commitSearch, inputValue, slashMode, stripSlashText, resetSlashMode],
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

  // ---- Global Cmd+K / Ctrl+K shortcut ----
  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onGlobalKeyDown);
    return () => document.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

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

      {/* ---- Slash command dropdowns ---- */}
      {slashMode.active && !slashMode.category && (
        <QuestoesSlashDropdown
          onSelect={handleSlashCategorySelect}
          onClose={resetSlashMode}
        />
      )}

      {slashMode.active && slashMode.category && (
        <QuestoesSlashFilterDropdown
          category={slashMode.category}
          query={slashMode.query}
          onSelect={handleSlashValueSelect}
          onClose={resetSlashMode}
        />
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
