"use client";

import React from "react";
import { useQuestoesOptional } from "@/contexts/QuestoesContext";

const ARRAY_KEYS = ["materias", "assuntos", "bancas", "anos", "orgaos", "cargos"] as const;

const BOOLEAN_KEYS = [
  { key: "excluirAnuladas", label: "Excluir Anuladas" },
  { key: "excluirDesatualizadas", label: "Excluir Desatualizadas" },
  { key: "excluirResolvidas", label: "Excluir Resolvidas" },
] as const;

export const FilterChipsBidirectional = React.memo(function FilterChipsBidirectional() {
  const ctx = useQuestoesOptional();
  if (!ctx) return null;

  const { filters, toggleFilter, clearFilters, activeFilterCount, searchQuery, setSearchQuery } = ctx;

  // Collect all active items: { label, onRemove }[]
  const items: { label: string; onRemove: () => void }[] = [];

  if (searchQuery) {
    items.push({
      label: searchQuery.length > 20 ? searchQuery.slice(0, 20) + "..." : searchQuery,
      onRemove: () => setSearchQuery(""),
    });
  }

  for (const key of ARRAY_KEYS) {
    for (const value of filters[key] as (string | number)[]) {
      items.push({
        label: String(value),
        onRemove: () => toggleFilter(key, value),
      });
    }
  }

  for (const { key, label } of BOOLEAN_KEYS) {
    if (filters[key]) {
      items.push({
        label,
        onRemove: () => toggleFilter(key, true),
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "white",
        border: "1px solid #d0d3d9",
        borderRadius: 50,
        height: 30,
        overflow: "hidden",
        margin: "6px 0",
      }}
    >
      {/* Scrollable items */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          overflowX: "auto",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          flex: 1,
          minWidth: 0,
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <React.Fragment key={`${item.label}-${i}`}>
            {/* Item */}
            <div
              style={{
                fontSize: 11,
                color: "#555",
                fontWeight: 450,
                padding: "0 12px",
                height: 30,
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                flexShrink: 0,
                cursor: "default",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f6f8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {item.label}
              <span
                onClick={item.onRemove}
                style={{
                  fontSize: 9,
                  color: "#ccc",
                  cursor: "pointer",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; }}
              >
                ✕
              </span>
            </div>

            {/* Pipe separator (not after last item) */}
            {i < items.length - 1 && (
              <span
                style={{
                  color: "#e0e3e8",
                  fontSize: 14,
                  fontWeight: 200,
                  flexShrink: 0,
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                │
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Clear all — fixed at end */}
      <span
        onClick={clearFilters}
        style={{
          fontSize: 10,
          color: "#bbb",
          cursor: "pointer",
          padding: "0 12px",
          whiteSpace: "nowrap",
          flexShrink: 0,
          height: 30,
          display: "flex",
          alignItems: "center",
          borderLeft: "1px solid #eaecf0",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#bbb"; }}
      >
        limpar
      </span>
    </div>
  );
});
