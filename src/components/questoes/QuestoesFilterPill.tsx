"use client";

import React from "react";
import { ChevronDown, X } from "lucide-react";
import type { FilterCategoryConfig } from "./filter-config";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestoesFilterPillProps {
  category: FilterCategoryConfig;
  selectedCount: number;
  isOpen: boolean;
  onClick: () => void;
  onClear: () => void;
  isMobile?: boolean;
  /** When true, the inactive border uses dashed style (used for Advanced pill) */
  dashed?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const QuestoesFilterPill = React.forwardRef<
  HTMLButtonElement,
  QuestoesFilterPillProps
>(function QuestoesFilterPill(
  {
    category,
    selectedCount,
    isOpen,
    onClick,
    onClear,
    isMobile = false,
    dashed = false,
    ...restProps
  },
  ref,
) {
  const Icon = category.icon;
  const isActive = selectedCount > 0;

  // --- Sizing ---
  const fontSize = isMobile ? "10px" : "11px";
  const padding = isMobile ? "4px 8px" : "5px 11px";
  const borderRadius = isMobile ? "7px" : "8px";

  // --- Color-dependent inline styles ---
  const inactiveStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.85)",
    border: `1px ${dashed ? "dashed" : "solid"} rgba(0,0,0,0.08)`,
    color: "#5f6368",
  };

  const activeStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${category.gradientFrom}, ${category.gradientTo})`,
    border: `1px solid ${category.borderColor}`,
    color: category.textColor,
  };

  const pillStyle: React.CSSProperties = {
    fontSize,
    padding,
    borderRadius,
    ...(isActive ? activeStyle : inactiveStyle),
  };

  // --- Event handlers ---
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear();
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...restProps}
      style={pillStyle}
      className={[
        "group inline-flex items-center gap-1.5 cursor-pointer select-none",
        "transition-colors duration-150 ease-out whitespace-nowrap",
        "font-medium leading-none",
        // Hover state (only when inactive)
        !isActive && !isOpen
          ? "hover:border-[#2563EB] hover:text-[#1E40AF]"
          : "",
        // Open state (only when inactive)
        !isActive && isOpen ? "!border-[#2563EB] !text-[#1E40AF]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Icon */}
      <Icon
        size={isMobile ? 12 : 13}
        strokeWidth={2}
        style={{ color: isActive ? category.iconStroke : undefined }}
        className={!isActive ? "text-current opacity-60" : ""}
      />

      {/* Label */}
      <span>{category.label}</span>

      {/* Count badge (only when more than 1 selection) */}
      {isActive && selectedCount > 1 && (
        <span
          style={{
            background: category.borderColor,
            color: "#fff",
            fontSize: isMobile ? "8px" : "9px",
            lineHeight: 1,
            padding: "1px 4px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          {selectedCount}
        </span>
      )}

      {/* Clear button (active state) */}
      {isActive ? (
        <span
          role="button"
          tabIndex={-1}
          onClick={handleClear}
          className="ml-0.5 rounded-full p-0.5 transition-opacity opacity-60 hover:opacity-100"
          style={{ color: category.textColor }}
        >
          <X size={isMobile ? 10 : 11} strokeWidth={2.5} />
        </span>
      ) : (
        /* Chevron (inactive / open states) */
        <ChevronDown
          size={isMobile ? 10 : 11}
          strokeWidth={2}
          className={[
            "transition-transform duration-150",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      )}
    </button>
  );
});
