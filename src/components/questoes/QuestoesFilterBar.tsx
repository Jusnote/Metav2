"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  FILTER_CATEGORIES,
  ADVANCED_CATEGORY,
} from "./filter-config";
import { QuestoesFilterPill } from "./QuestoesFilterPill";
import { QuestoesFilterPopover } from "./QuestoesFilterPopover";
import { QuestoesAdvancedPopover } from "./QuestoesAdvancedPopover";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import type { QuestoesFilters } from "@/contexts/QuestoesContext";
import { useIsMobile } from "@/hooks/use-mobile";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestoesFilterBarProps {
  onPopoverChange?: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the number of selected values for a given category key.
 */
function countForCategory(
  key: string,
  filters: QuestoesFilters,
): number {
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
    case "advanced":
      return (
        (filters.excluirAnuladas ? 1 : 0) +
        (filters.excluirDesatualizadas ? 1 : 0) +
        (filters.excluirResolvidas ? 1 : 0)
      );
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestoesFilterBar({ onPopoverChange }: QuestoesFilterBarProps) {
  const { filters, clearFilters, removeFilter, activeFilterCount } =
    useQuestoesContext();
  const isMobile = useIsMobile();

  // Which pill's popover is currently open (null = none)
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  // Notify parent when popover open state changes
  useEffect(() => {
    onPopoverChange?.(openPopover !== null);
  }, [openPopover, onPopoverChange]);

  const togglePopover = useCallback((key: string) => {
    setOpenPopover((prev) => (prev === key ? null : key));
  }, []);

  // Build selection counts for each category (memoised)
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of FILTER_CATEGORIES) {
      map[cat.key] = countForCategory(cat.key, filters);
    }
    map[ADVANCED_CATEGORY.key] = countForCategory(ADVANCED_CATEGORY.key, filters);
    return map;
  }, [filters]);

  // Clear handler for a single category pill
  const handleClearCategory = useCallback(
    (key: string) => {
      if (key === "advanced") {
        removeFilter("excluirAnuladas");
        removeFilter("excluirDesatualizadas");
        removeFilter("excluirResolvidas");
      } else {
        removeFilter(key as keyof QuestoesFilters);
      }
      setOpenPopover(null);
    },
    [removeFilter],
  );

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #f6f7f9, #eef0f3)",
        border: "1px solid #e2e5ea",
        borderTop: "1px solid #eaecf0",
        borderRadius: "0 0 14px 14px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
        gap: "6px",
        padding: "8px 12px",
      }}
      className={[
        "flex items-center",
        // Horizontal scroll on mobile, hide scrollbar
        isMobile
          ? "overflow-x-auto scrollbar-hide"
          : "flex-wrap",
      ].join(" ")}
    >
      {/* Standard category pills wrapped in popovers */}
      {FILTER_CATEGORIES.map((cat) => (
        <QuestoesFilterPopover
          key={cat.key}
          category={cat}
          open={openPopover === cat.key}
          onOpenChange={(open) => setOpenPopover(open ? cat.key : null)}
        >
          <QuestoesFilterPill
            category={cat}
            selectedCount={counts[cat.key]}
            isOpen={openPopover === cat.key}
            onClick={() => togglePopover(cat.key)}
            onClear={() => handleClearCategory(cat.key)}
            isMobile={isMobile}
          />
        </QuestoesFilterPopover>
      ))}

      {/* Advanced pill wrapped in advanced popover (dashed border when inactive) */}
      <QuestoesAdvancedPopover
        open={openPopover === ADVANCED_CATEGORY.key}
        onOpenChange={(open) => setOpenPopover(open ? ADVANCED_CATEGORY.key : null)}
      >
        <QuestoesFilterPill
          category={ADVANCED_CATEGORY}
          selectedCount={counts[ADVANCED_CATEGORY.key]}
          isOpen={openPopover === ADVANCED_CATEGORY.key}
          onClick={() => togglePopover(ADVANCED_CATEGORY.key)}
          onClear={() => handleClearCategory(ADVANCED_CATEGORY.key)}
          isMobile={isMobile}
          dashed
        />
      </QuestoesAdvancedPopover>

      {/* "Limpar" link - only visible when filters are active */}
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="ml-auto shrink-0 text-[11px] font-medium text-gray-400 hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
