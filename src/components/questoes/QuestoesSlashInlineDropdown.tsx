"use client";

import React, { useRef, useEffect } from "react";
import type { FilterCategoryConfig } from "./filter-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlashInlineItem {
  label: string;
  value: string | number;
}

export interface QuestoesSlashInlineDropdownProps {
  mode: "categories" | "values";
  // Categories mode
  categories?: FilterCategoryConfig[];
  matchedCategory?: FilterCategoryConfig | null;
  // Values mode
  category?: FilterCategoryConfig;
  items: SlashInlineItem[];
  selectedValues: Set<string>;
  highlightedIndex: number;
  searchText?: string;
  onToggle: (value: string | number) => void;
  onHover: (index: number) => void;
  onRemoveSelected?: (value: string | number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Highlight the matching portion of `text` that matches `query`.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "#2563EB", fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestoesSlashInlineDropdown({
  mode,
  categories,
  matchedCategory,
  category,
  items,
  selectedValues,
  highlightedIndex,
  searchText = "",
  onToggle,
  onHover,
  onRemoveSelected,
}: QuestoesSlashInlineDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Scroll highlighted row into view
  useEffect(() => {
    if (mode === "values") {
      const el = rowRefs.current.get(highlightedIndex);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, mode]);

  // ---- Categories mode ----
  if (mode === "categories") {
    const cats = categories ?? [];
    return (
      <div
        style={{
          background: "white",
          border: "1.5px solid #2563EB",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.1)",
          padding: "10px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {cats.map((cat, i) => {
            const isMatched = matchedCategory?.key === cat.key;
            return (
              <React.Fragment key={cat.key}>
                <span
                  style={{
                    color: isMatched ? "#2563EB" : "#9ca3af",
                    fontWeight: isMatched ? 700 : 400,
                    transition: "color 100ms ease, font-weight 100ms ease",
                  }}
                >
                  {cat.label.toLowerCase()}
                </span>
                {i < cats.length - 1 && (
                  <span style={{ color: "#d0d3d9" }}>&middot;</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "#b0b4bc",
          }}
        >
          digite o nome do filtro...
        </div>
      </div>
    );
  }

  // ---- Values mode ----
  const selectedItems = items.filter((item) =>
    selectedValues.has(String(item.value)),
  );

  return (
    <div
      style={{
        background: "white",
        border: "1.5px solid #2563EB",
        borderTop: "none",
        borderRadius: "0 0 14px 14px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      {/* Selected bar at top */}
      {selectedItems.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderBottom: "1px solid #f0f1f3",
            flexWrap: "wrap",
          }}
        >
          {selectedItems.map((item) => (
            <span
              key={String(item.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                color: "#2563EB",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 6,
                padding: "2px 8px",
                lineHeight: 1.4,
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M2 5.5L4 7.5L8 3"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {item.label}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onRemoveSelected?.(item.value);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 13,
                  color: "#d0a050",
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div
        style={{
          padding: "6px 14px",
          fontSize: 11,
          color: "#9ca3af",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid #f0f1f3",
        }}
      >
        {category && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
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
        )}
        <span>
          {items.length} resultado{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div
          style={{
            padding: "20px 14px",
            textAlign: "center",
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          Nenhuma encontrada para &lsquo;{searchText}&rsquo;
        </div>
      ) : (
        <div
          ref={listRef}
          style={{ maxHeight: 240, overflowY: "auto" }}
        >
          {items.map((item, index) => {
            const isHighlighted = index === highlightedIndex;
            const isSelected = selectedValues.has(String(item.value));

            return (
              <div
                key={`${String(item.value)}-${index}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(index, el);
                }}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  onToggle(item.value);
                }}
                onMouseEnter={() => onHover(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  cursor: "pointer",
                  transition: "background 75ms ease",
                  background: isHighlighted
                    ? "#EFF6FF"
                    : isSelected
                      ? "#f8f5ff"
                      : "transparent",
                  borderLeft: isHighlighted
                    ? "3px solid #2563EB"
                    : "3px solid transparent",
                }}
              >
                {/* Checkbox */}
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    border: isSelected
                      ? "1.5px solid #2563EB"
                      : "1.5px solid #d0d3d9",
                    background: isSelected ? "#2563EB" : "#fff",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 100ms ease",
                  }}
                >
                  {isSelected && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
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

                {/* Label with match highlight */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "#1a1a1a",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {highlightMatch(item.label, searchText)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer hints */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid #f0f1f3",
          fontSize: 10,
          color: "#b0b4bc",
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
        }}
      >
        <kbd style={kbdStyle}>,</kbd>
        <span>seleciona + continua</span>
        <span style={{ color: "#d0d3d9" }}>&middot;</span>
        <kbd style={kbdStyle}>Enter</kbd>
        <span>seleciona + sai</span>
        <span style={{ color: "#d0d3d9" }}>&middot;</span>
        <kbd style={kbdStyle}>Esc</kbd>
        <span>cancela</span>
        <span style={{ color: "#d0d3d9" }}>&middot;</span>
        <span>&uarr;&darr; navegar</span>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 9,
  fontFamily: "monospace",
  background: "#f5f6f8",
  border: "1px solid #e8eaed",
  borderRadius: 3,
  padding: "1px 4px",
  color: "#666",
  lineHeight: 1.4,
};

export default QuestoesSlashInlineDropdown;
