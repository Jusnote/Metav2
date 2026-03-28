"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useQuestoesContext } from "@/contexts/QuestoesContext";
import type { QuestoesFilters } from "@/contexts/QuestoesContext";
import { useIsSmall } from "@/hooks/use-small";
import { useFiltrosDicionario } from "@/hooks/useFiltrosDicionario";
import {
  FILTER_CATEGORIES,
  getCategoryItems,
  type FilterCategoryConfig,
} from "./filter-config";
import { QuestoesSlashInlineDropdown } from "./QuestoesSlashInlineDropdown";
import { useFilterKeyboardNav } from "./use-filter-keyboard-nav";
import { QuestoesFilterSheet } from "./QuestoesFilterSheet";

// ---------------------------------------------------------------------------
// QuestoesSearchBar
// ---------------------------------------------------------------------------
// Native <input> search bar with inline slash autocomplete.
// Features: debounced search, IA toggle, filter badge, Cmd+K shortcut,
// slash command with mirror-div ghost text + inline dropdown.
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 500;
const MAX_VISIBLE_ITEMS = 12;

// ---------------------------------------------------------------------------
// Slash state machine
// ---------------------------------------------------------------------------

interface SlashState {
  active: boolean;
  phase: "category" | "value";
  categoryText: string; // what user typed for category (e.g. "ban")
  matchedCategory: FilterCategoryConfig | null;
  valueText: string; // what user typed for value (e.g. "ces")
  selectedInSession: string[]; // values selected via comma in current slash session
}

const SLASH_INITIAL: SlashState = {
  active: false,
  phase: "category",
  categoryText: "",
  matchedCategory: null,
  valueText: "",
  selectedInSession: [],
};

// ---------------------------------------------------------------------------
// Fuzzy category matching
// ---------------------------------------------------------------------------

/**
 * Match typed text against FILTER_CATEGORIES labels.
 * Returns the best match if the label starts with or contains the typed text.
 */
function fuzzyMatchCategory(
  text: string,
): FilterCategoryConfig | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (!t) return null;

  // Exact start match first
  for (const cat of FILTER_CATEGORIES) {
    if (cat.label.toLowerCase().startsWith(t)) return cat;
  }

  // Also try matching the key (e.g. "bancas" for "ban")
  for (const cat of FILTER_CATEGORIES) {
    if (cat.key.toLowerCase().startsWith(t)) return cat;
  }

  // Partial match (contains)
  for (const cat of FILTER_CATEGORIES) {
    if (cat.label.toLowerCase().includes(t)) return cat;
  }

  return null;
}

/**
 * Compute ghost text for category completion.
 * If user typed "ban" and matched "Bancas", ghost = "cas"
 */
function categoryGhostText(
  typed: string,
  matched: FilterCategoryConfig | null,
): string {
  if (!matched || !typed) return "";
  const label = matched.label.toLowerCase();
  const t = typed.toLowerCase();
  if (label.startsWith(t)) {
    return matched.label.slice(t.length).toLowerCase();
  }
  // Try key
  const key = matched.key.toLowerCase();
  if (key.startsWith(t)) {
    return matched.key.slice(t.length).toLowerCase();
  }
  return "";
}

/**
 * Coerce value to the correct type for the category.
 * `anos` expects numbers; everything else expects strings.
 */
function coerceValue(categoryKey: string, value: string): string | number {
  return categoryKey === "anos" ? Number(value) : value;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestoesSearchBarProps {
  /** Auto-focus the input on mount (used by Ctrl+K overlay) */
  autoFocus?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestoesSearchBar({ autoFocus = false }: QuestoesSearchBarProps) {
  const { searchQuery, setSearchQuery, filters, activeFilterCount, toggleFilter, triggerSearch } =
    useQuestoesContext();
  const isMobile = useIsSmall();
  const { dicionario } = useFiltrosDicionario();

  // ---- local state ----
  const [inputValue, setInputValue] = useState(searchQuery);
  const [semanticMode, setSemanticMode] = useState(false);
  const [slash, setSlash] = useState<SlashState>(SLASH_INITIAL);
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
  const resetSlash = useCallback(() => {
    setSlash(SLASH_INITIAL);
  }, []);

  /** Remove the `/...` portion from the input value and return the clean text. */
  const stripSlashText = useCallback((val: string): string => {
    const slashIdx = val.lastIndexOf("/");
    if (slashIdx === -1) return val;
    return val.slice(0, slashIdx).trimEnd();
  }, []);

  // ---- Filtered items for value phase ----
  const allCategoryItems = useMemo(() => {
    if (!slash.active || slash.phase !== "value" || !slash.matchedCategory)
      return [];
    return getCategoryItems(slash.matchedCategory.key, dicionario);
  }, [slash.active, slash.phase, slash.matchedCategory, dicionario]);

  const filteredItems = useMemo(() => {
    if (!allCategoryItems.length) return [];
    const q = slash.valueText.trim().toLowerCase();
    if (!q) return allCategoryItems.slice(0, MAX_VISIBLE_ITEMS);
    return allCategoryItems
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, MAX_VISIBLE_ITEMS);
  }, [allCategoryItems, slash.valueText]);

  // ---- Selected values set ----
  const selectedSet = useMemo(() => {
    if (!slash.matchedCategory) return new Set<string>();
    const key = slash.matchedCategory.key as keyof QuestoesFilters;
    const raw = filters[key];
    if (Array.isArray(raw)) return new Set(raw.map(String));
    return new Set<string>();
  }, [slash.matchedCategory, filters]);

  // ---- Value ghost text ----
  const valueGhostText = useMemo(() => {
    if (slash.phase !== "value" || !slash.valueText.trim()) return "";
    if (filteredItems.length === 0) return "";
    const first = filteredItems[0];
    const t = slash.valueText.toLowerCase();
    const label = first.label.toLowerCase();
    if (label.startsWith(t)) {
      return first.label.slice(t.length);
    }
    return "";
  }, [slash.phase, slash.valueText, filteredItems]);

  // ---- Keyboard nav for value items ----
  const handleValueSelect = useCallback(
    (index: number) => {
      const item = filteredItems[index];
      if (!item || !slash.matchedCategory) return;

      toggleFilter(
        slash.matchedCategory.key as keyof QuestoesFilters,
        coerceValue(slash.matchedCategory.key, String(item.value)),
      );

      // Clear entire slash text and exit
      const cleaned = stripSlashText(inputValue);
      setInputValue(cleaned);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      commitSearch(cleaned);
      resetSlash();
      // Trigger search after filter applied
      requestAnimationFrame(() => {
        triggerSearch();
        inputRef.current?.focus();
      });
    },
    [filteredItems, slash.matchedCategory, toggleFilter, stripSlashText, inputValue, commitSearch, resetSlash, triggerSearch],
  );

  const handleValueClose = useCallback(() => {
    const cleaned = stripSlashText(inputValue);
    setInputValue(cleaned);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commitSearch(cleaned);
    resetSlash();
  }, [stripSlashText, inputValue, commitSearch, resetSlash]);

  const {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown: navKeyDown,
  } = useFilterKeyboardNav({
    itemCount: filteredItems.length,
    onSelect: handleValueSelect,
    onClose: handleValueClose,
    enabled: slash.active && slash.phase === "value",
  });

  // ---- input handler ----
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      // Find last `/` position
      const slashIdx = val.lastIndexOf("/");

      if (slashIdx !== -1) {
        const afterSlash = val.slice(slashIdx + 1);

        // Check if there's a space — means value phase
        const spaceIdx = afterSlash.indexOf(" ");

        if (spaceIdx === -1) {
          // No space — category phase
          const matched = fuzzyMatchCategory(afterSlash);
          setSlash({
            active: true,
            phase: "category",
            categoryText: afterSlash,
            matchedCategory: matched,
            valueText: "",
            selectedInSession: [],
          });
        } else {
          // Has space — value phase
          const catPart = afterSlash.slice(0, spaceIdx);
          const valuePart = afterSlash.slice(spaceIdx + 1);
          const matched = fuzzyMatchCategory(catPart);

          if (!matched) {
            // No category match — exit slash mode, treat as normal search
            setSlash(SLASH_INITIAL);
            scheduleCommit(val);
            return;
          }

          setSlash((prev) => ({
            active: true,
            phase: "value",
            categoryText: catPart,
            matchedCategory: matched,
            valueText: valuePart,
            selectedInSession: prev.selectedInSession,
          }));
        }

        // Don't commit search while in slash mode
        return;
      } else {
        // No `/` in the input — exit slash mode
        if (slash.active) {
          resetSlash();
        }
      }

      scheduleCommit(val);
    },
    [scheduleCommit, slash.active, resetSlash],
  );

  // ---- Select item and continue (comma behavior) ----
  const selectAndContinue = useCallback(
    (index: number) => {
      const item = filteredItems[index];
      if (!item || !slash.matchedCategory) return;

      toggleFilter(
        slash.matchedCategory.key as keyof QuestoesFilters,
        coerceValue(slash.matchedCategory.key, String(item.value)),
      );

      // Clear value portion from input, keep /category
      const slashIdx = inputValue.lastIndexOf("/");
      if (slashIdx === -1) return;
      const afterSlash = inputValue.slice(slashIdx + 1);
      const spaceIdx = afterSlash.indexOf(" ");
      const catPart = spaceIdx >= 0 ? afterSlash.slice(0, spaceIdx) : afterSlash;

      const newVal = inputValue.slice(0, slashIdx) + "/" + catPart + " ";
      setInputValue(newVal);

      setSlash((prev) => ({
        ...prev,
        valueText: "",
        selectedInSession: [...prev.selectedInSession, String(item.value)],
      }));

      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [filteredItems, slash.matchedCategory, toggleFilter, inputValue],
  );

  // ---- Toggle from dropdown click ----
  const handleDropdownToggle = useCallback(
    (value: string | number) => {
      if (!slash.matchedCategory) return;
      toggleFilter(
        slash.matchedCategory.key as keyof QuestoesFilters,
        value,
      );
    },
    [slash.matchedCategory, toggleFilter],
  );

  // ---- key handler ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (slash.active) {
        // Category phase
        if (slash.phase === "category") {
          if (e.key === "Escape") {
            e.preventDefault();
            const cleaned = stripSlashText(inputValue);
            setInputValue(cleaned);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            commitSearch(cleaned);
            resetSlash();
            return;
          }

          if (e.key === "Tab" || (e.key === " " && slash.matchedCategory)) {
            // Complete category and enter value phase
            if (slash.matchedCategory) {
              e.preventDefault();
              const slashIdx = inputValue.lastIndexOf("/");
              const catLabel = slash.matchedCategory.label.toLowerCase();
              const newVal = inputValue.slice(0, slashIdx) + "/" + catLabel + " ";
              setInputValue(newVal);
              setSlash((prev) => ({
                ...prev,
                phase: "value",
                categoryText: catLabel,
                valueText: "",
              }));
            }
            return;
          }

          if (e.key === "Backspace") {
            const slashIdx = inputValue.lastIndexOf("/");
            if (slashIdx !== -1 && inputValue.slice(slashIdx) === "/") {
              resetSlash();
            }
            return;
          }

          return;
        }

        // Value phase — forward arrow/enter/esc to nav hook
        if (slash.phase === "value") {
          if (e.key === "," && filteredItems.length > 0) {
            e.preventDefault();
            selectAndContinue(highlightedIndex);
            return;
          }

          if (e.key === "Backspace") {
            // If no valueText and we're at the space after category, go back to category phase
            if (slash.valueText === "") {
              e.preventDefault();
              const slashIdx = inputValue.lastIndexOf("/");
              if (slashIdx !== -1) {
                const catPart = slash.categoryText;
                const newVal = inputValue.slice(0, slashIdx) + "/" + catPart;
                setInputValue(newVal);
                setSlash((prev) => ({
                  ...prev,
                  phase: "category",
                  valueText: "",
                }));
              }
              return;
            }
            // Otherwise let normal backspace happen (handled by change handler)
            return;
          }

          // Forward to keyboard nav (ArrowUp, ArrowDown, Enter, Escape)
          navKeyDown(e);
          return;
        }

        return;
      }

      // Not in slash mode — Enter commits query + triggers search
      if (e.key === "Enter") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        commitSearch(inputValue);
        // Trigger the actual search (draft → committed)
        requestAnimationFrame(() => triggerSearch());
      }
    },
    [
      commitSearch,
      inputValue,
      slash,
      stripSlashText,
      resetSlash,
      filteredItems.length,
      highlightedIndex,
      selectAndContinue,
      navKeyDown,
    ],
  );

  // Note: Ctrl+K is handled by QuestoesPage (opens overlay mode)

  // ---- Close slash mode on click outside ----
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!slash.active) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        resetSlash();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [slash.active, resetSlash]);

  // ---- Mirror div computation ----
  const mirrorContent = useMemo(() => {
    if (!slash.active) return null;

    const slashIdx = inputValue.lastIndexOf("/");
    if (slashIdx === -1) return null;

    const beforeSlash = inputValue.slice(0, slashIdx);
    const afterSlash = inputValue.slice(slashIdx + 1);

    if (slash.phase === "category") {
      const ghost = categoryGhostText(slash.categoryText, slash.matchedCategory);
      return { beforeSlash, categoryText: afterSlash, valueText: "", ghost, hasMatch: !!slash.matchedCategory };
    }

    // Value phase
    const spaceIdx = afterSlash.indexOf(" ");
    const catPart = spaceIdx >= 0 ? afterSlash.slice(0, spaceIdx) : afterSlash;
    const valPart = spaceIdx >= 0 ? afterSlash.slice(spaceIdx + 1) : "";

    return {
      beforeSlash,
      categoryText: catPart,
      valueText: valPart,
      ghost: valueGhostText,
      hasMatch: filteredItems.length > 0,
    };
  }, [slash, inputValue, valueGhostText, filteredItems.length]);

  // ---- mobile keyboard bar handlers ----
  const handleMobileSlashTap = useCallback(() => {
    if (mobileSlashActive) {
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

  // ---- Is the input border in slash mode (amber) ----
  const inSlashMode = slash.active;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          height: 44,
          background: "#fff",
          border: inSlashMode ? "1.5px solid #E8930C" : "1px solid #e2e5ea",
          borderBottom: inSlashMode ? "none" : "none",
          borderRadius: inSlashMode ? "14px 14px 0 0" : "14px 14px 0 0",
          padding: "0 16px",
          gap: 10,
          display: "flex",
          alignItems: "center",
          position: "relative",
          transition: "border-color 150ms ease",
        }}
        className={
          inSlashMode
            ? "questoes-search-bar"
            : "questoes-search-bar focus-within:border-[#E8930C] focus-within:shadow-[0_0_0_3px_rgba(232,147,12,0.06)]"
        }
      >
        {/* Search icon */}
        <Search
          size={16}
          color={inSlashMode ? "#E8930C" : "#888"}
          style={{ flexShrink: 0, transition: "color 150ms ease" }}
        />

        {/* Input container with mirror */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {/* Mirror div — shows colored text behind transparent input */}
          {mirrorContent && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
                fontSize: 14,
                fontFamily: "inherit",
                whiteSpace: "pre",
                overflow: "hidden",
              }}
              aria-hidden="true"
            >
              <span style={{ color: "#333" }}>{mirrorContent.beforeSlash}</span>
              <span style={{ color: "#E8930C", fontWeight: 600 }}>
                /{mirrorContent.categoryText}
              </span>
              {slash.phase === "value" && (
                <>
                  <span style={{ color: "#E8930C" }}> </span>
                  <span
                    style={{
                      color: mirrorContent.hasMatch ? "#D4A06A" : "#999",
                      fontWeight: mirrorContent.hasMatch ? 500 : 400,
                    }}
                  >
                    {mirrorContent.valueText}
                  </span>
                </>
              )}
              {mirrorContent.ghost && (
                <span style={{ color: "#d0d3d9" }}>{mirrorContent.ghost}</span>
              )}
            </div>
          )}

          {/* Actual input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => {
              // Delay to allow tap events on the keyboard bar / dropdown to fire first
              setTimeout(() => setInputFocused(false), 200);
            }}
            placeholder={inSlashMode ? "" : placeholder}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: inSlashMode ? "transparent" : "#1a1a1a",
              caretColor: inSlashMode ? "#E8930C" : undefined,
              minWidth: 0,
              position: "relative",
              zIndex: 1,
            }}
          />
        </div>

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

      {/* ---- Slash inline dropdown ---- */}
      {slash.active && slash.phase === "category" && (
        <QuestoesSlashInlineDropdown
          mode="categories"
          categories={FILTER_CATEGORIES}
          matchedCategory={slash.matchedCategory}
          items={[]}
          selectedValues={new Set()}
          highlightedIndex={0}
          onToggle={() => {}}
          onHover={() => {}}
        />
      )}

      {slash.active && slash.phase === "value" && slash.matchedCategory && (
        <QuestoesSlashInlineDropdown
          mode="values"
          category={slash.matchedCategory}
          items={filteredItems}
          selectedValues={selectedSet}
          highlightedIndex={highlightedIndex}
          searchText={slash.valueText}
          onToggle={handleDropdownToggle}
          onHover={setHighlightedIndex}
          onRemoveSelected={handleDropdownToggle}
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
