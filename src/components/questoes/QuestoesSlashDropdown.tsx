"use client";

import React, { useCallback, useRef, useEffect } from "react";
import {
  FILTER_CATEGORIES,
  type FilterCategoryConfig,
} from "./filter-config";
import { useFilterKeyboardNav } from "./use-filter-keyboard-nav";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestoesSlashDropdownProps {
  onSelect: (category: FilterCategoryConfig) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Placeholder counts per category (hardcoded for now)
// ---------------------------------------------------------------------------

const PLACEHOLDER_COUNTS: Record<string, string> = {
  bancas: "498",
  materias: "42",
  anos: "27",
  orgaos: "312",
  cargos: "185",
  assuntos: "64",
};

// ---------------------------------------------------------------------------
// QuestoesSlashDropdown
// ---------------------------------------------------------------------------

export function QuestoesSlashDropdown({
  onSelect,
  onClose,
}: QuestoesSlashDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const categories = FILTER_CATEGORIES;

  const handleSelect = useCallback(
    (index: number) => {
      const cat = categories[index];
      if (cat) onSelect(cat);
    },
    [categories, onSelect],
  );

  const { highlightedIndex, setHighlightedIndex, handleKeyDown } =
    useFilterKeyboardNav({
      itemCount: categories.length,
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
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 50,
        width: 250,
        borderRadius: 12,
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #e8eaed",
        background: "#fff",
        overflow: "hidden",
        marginTop: 4,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px 6px",
          fontSize: 11,
          fontWeight: 500,
          color: "#b0b4bc",
          userSelect: "none",
        }}
      >
        Selecione um filtro
      </div>

      {/* Category rows */}
      {categories.map((cat, index) => {
        const isHighlighted = index === highlightedIndex;
        const Icon = cat.icon;
        const count = PLACEHOLDER_COUNTS[cat.key] ?? "0";

        return (
          <div
            key={cat.key}
            ref={(el) => {
              if (el) rowRefs.current.set(index, el);
            }}
            role="option"
            aria-selected={isHighlighted}
            onClick={() => onSelect(cat)}
            onMouseEnter={() => setHighlightedIndex(index)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              cursor: "pointer",
              transition: "background 75ms ease",
              background: isHighlighted ? "#FFFBEB" : "transparent",
            }}
          >
            {/* Colored icon square */}
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: cat.iconBg,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={14} color={cat.iconStroke} strokeWidth={2} />
            </span>

            {/* Label */}
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                color: "#1a1a1a",
              }}
            >
              {cat.label}
            </span>

            {/* Count */}
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default QuestoesSlashDropdown;
