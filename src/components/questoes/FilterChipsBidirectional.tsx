"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuestoesOptional } from "@/contexts/QuestoesContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMaterias } from "@/hooks/useMaterias";
import { useNodeChipResolver } from "@/hooks/useNodeChipResolver";

const ARRAY_KEYS = ["materias", "assuntos", "bancas", "anos", "orgaos", "cargos"] as const;

const BOOLEAN_KEYS = [
  { key: "excluirAnuladas", label: "Excluir Anuladas" },
  { key: "excluirDesatualizadas", label: "Excluir Desatualizadas" },
  { key: "excluirResolvidas", label: "Excluir Resolvidas" },
] as const;

const SCROLL_AMOUNT = 160;

interface FilterChipsBidirectionalProps {
  onSearch?: () => void;
}

export const FilterChipsBidirectional = React.memo(function FilterChipsBidirectional({
  onSearch,
}: FilterChipsBidirectionalProps) {
  const ctx = useQuestoesOptional();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Hooks must be called unconditionally before any early return
  const { data: materias } = useMaterias();
  const materiaNome = ctx?.filters.materias[0] ?? null;
  const materiaSlug = materias?.find(m => m.nome === materiaNome)?.slug ?? null;
  const resolveNodeChip = useNodeChipResolver(materiaSlug);

  if (!ctx) return null;

  const { filters, toggleFilter, clearFilters, searchQuery, setSearchQuery } = ctx;

  // Collect all active items
  const items: { label: string; tooltip?: string; onRemove: () => void }[] = [];

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

  // Node taxonomy chips
  for (const id of filters.nodeIds) {
    const info = resolveNodeChip(id);
    if (!info) continue;
    items.push({
      label: info.nome,
      tooltip: info.path.join(" › "),
      onRemove: () => {
        const next = filters.nodeIds.filter(x => x !== id);
        ctx.setFilter("nodeIds", next);
      },
    });
  }

  for (const { key, label } of BOOLEAN_KEYS) {
    if (filters[key]) {
      items.push({
        label,
        onRemove: () => toggleFilter(key, true),
      });
    }
  }

  // Check overflow state
  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // biome-ignore lint: items.length triggers recalc
  useEffect(() => {
    checkOverflow();
  }, [items.length, checkOverflow]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
    };
  }, [checkOverflow]);

  const scrollBy = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_AMOUNT, behavior: "smooth" });
  }, []);

  if (items.length === 0) return null;

  const showArrows = !isMobile && (canScrollLeft || canScrollRight);

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
        position: "relative",
      }}
    >
      {/* Left arrow — desktop only, when can scroll left */}
      {!isMobile && canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 30,
            flexShrink: 0,
            cursor: "pointer",
            background: "linear-gradient(90deg, white 60%, transparent)",
            border: "none",
            borderRight: "1px solid #eaecf0",
            color: "#999",
            zIndex: 2,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#333"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#999"; }}
        >
          <ChevronLeft size={13} strokeWidth={2} />
        </button>
      )}

      {/* Scrollable items */}
      <div
        ref={scrollRef}
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
              title={item.tooltip}
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
                  padding: isMobile ? 4 : 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; }}
              >
                ✕
              </span>
            </div>

            {/* Pipe separator */}
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

      {/* Right arrow — desktop only, when can scroll right */}
      {!isMobile && canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 30,
            flexShrink: 0,
            cursor: "pointer",
            background: "linear-gradient(270deg, white 60%, transparent)",
            border: "none",
            borderLeft: "1px solid #eaecf0",
            color: "#999",
            zIndex: 2,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#333"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#999"; }}
        >
          <ChevronRight size={13} strokeWidth={2} />
        </button>
      )}

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

      {/* Buscar button — rightmost, merges with bar */}
      <button
        type="button"
        onClick={onSearch}
        style={{
          height: 30,
          padding: "0 14px",
          background: "#2563EB",
          color: "white",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: "0 50px 50px 0",
          cursor: "pointer",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 5,
          border: "none",
          whiteSpace: "nowrap",
        }}
      >
        Buscar
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          stroke="white"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
});
