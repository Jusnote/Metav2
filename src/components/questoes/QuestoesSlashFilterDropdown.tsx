"use client";

import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { useFiltrosDicionario } from "@/hooks/useFiltrosDicionario";
import {
  getCategoryItems,
  type FilterCategoryConfig,
} from "./filter-config";
import { useFilterKeyboardNav } from "./use-filter-keyboard-nav";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestoesSlashFilterDropdownProps {
  category: FilterCategoryConfig;
  query: string;
  onSelect: (value: string | number) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 8;

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "#E8930C", fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Coerce value to the correct type for the category.
 * `anos` expects numbers; everything else expects strings.
 */
function coerceValue(categoryKey: string, value: string): string | number {
  return categoryKey === "anos" ? Number(value) : value;
}

// ---------------------------------------------------------------------------
// QuestoesSlashFilterDropdown
// ---------------------------------------------------------------------------

export function QuestoesSlashFilterDropdown({
  category,
  query,
  onSelect,
  onClose,
}: QuestoesSlashFilterDropdownProps) {
  const { dicionario } = useFiltrosDicionario();

  const allItems = useMemo(
    () => getCategoryItems(category.key, dicionario),
    [category.key, dicionario],
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, MAX_VISIBLE);
    const q = query.trim().toLowerCase();
    return allItems
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, MAX_VISIBLE);
  }, [allItems, query]);

  const handleSelect = useCallback(
    (index: number) => {
      const item = filteredItems[index];
      if (item) {
        onSelect(coerceValue(category.key, String(item.value)));
      }
    },
    [filteredItems, category.key, onSelect],
  );

  const { highlightedIndex, setHighlightedIndex, handleKeyDown } =
    useFilterKeyboardNav({
      itemCount: filteredItems.length,
      onSelect: handleSelect,
      onClose,
      enabled: true,
    });

  // Scroll highlighted row into view
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  useEffect(() => {
    const el = rowRefs.current.get(highlightedIndex);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 50,
        width: 280,
        borderRadius: 12,
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #e8eaed",
        background: "#fff",
        overflow: "hidden",
        marginTop: 4,
      }}
    >
      {/* Header with category label */}
      <div
        style={{
          padding: "10px 14px 6px",
          fontSize: 11,
          fontWeight: 500,
          color: "#b0b4bc",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: category.iconBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <category.icon
            size={10}
            color={category.iconStroke}
            strokeWidth={2}
          />
        </span>
        {category.label}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div
          style={{
            padding: "16px 14px",
            textAlign: "center",
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          Nenhum resultado
        </div>
      ) : (
        <div style={{ maxHeight: MAX_VISIBLE * 36, overflowY: "auto" }}>
          {filteredItems.map((item, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <div
                key={`${category.key}-${item.value}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(index, el);
                }}
                role="option"
                aria-selected={isHighlighted}
                onClick={() =>
                  onSelect(coerceValue(category.key, String(item.value)))
                }
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  cursor: "pointer",
                  transition: "background 75ms ease",
                  background: isHighlighted ? "#FFFBEB" : "transparent",
                  fontSize: 13,
                  color: "#1a1a1a",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  {highlightMatch(item.label, query)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default QuestoesSlashFilterDropdown;
