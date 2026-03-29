"use client";

import React, { useMemo, useCallback } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useQuestoesContext } from "@/contexts/QuestoesContext";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestoesAdvancedPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Toggle row config
// ---------------------------------------------------------------------------

interface ToggleConfig {
  key: "excluirAnuladas" | "excluirDesatualizadas" | "excluirResolvidas";
  label: string;
  description: string;
}

const TOGGLES: ToggleConfig[] = [
  {
    key: "excluirAnuladas",
    label: "Excluir anuladas",
    description: "Remove questões anuladas pela banca",
  },
  {
    key: "excluirDesatualizadas",
    label: "Excluir desatualizadas",
    description: "Legislação desatualizada",
  },
  {
    key: "excluirResolvidas",
    label: "Excluir resolvidas",
    description: "Somente não respondidas",
  },
];

// ---------------------------------------------------------------------------
// Toggle Switch sub-component
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: checked ? "#E8930C" : "#e0e3e8",
        border: "none",
        padding: 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "transform 0.2s",
          transform: checked ? "translateX(18px)" : "translateX(0px)",
          display: "block",
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuestoesAdvancedPopover({
  open,
  onOpenChange,
  children,
}: QuestoesAdvancedPopoverProps) {
  const { filters, setFilter, removeFilter } = useQuestoesContext();

  const activeCount = useMemo(
    () =>
      (filters.excluirAnuladas ? 1 : 0) +
      (filters.excluirDesatualizadas ? 1 : 0) +
      (filters.excluirResolvidas ? 1 : 0),
    [filters.excluirAnuladas, filters.excluirDesatualizadas, filters.excluirResolvidas],
  );

  const handleReset = useCallback(() => {
    removeFilter("excluirAnuladas");
    removeFilter("excluirDesatualizadas");
    removeFilter("excluirResolvidas");
  }, [removeFilter]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        sideOffset={6}
        align="end"
        className="p-0 outline-none"
        style={{
          width: 300,
          borderRadius: 14,
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #e0e3e8",
          background: "#fff",
        }}
      >
        {/* ---- Header ---- */}
        <div className="px-4 pt-3 pb-1">
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            Avançado
          </span>
        </div>

        {/* ---- Toggle rows ---- */}
        <div className="px-4 py-2 flex flex-col gap-3">
          {TOGGLES.map((toggle) => {
            const checked = filters[toggle.key] as boolean;
            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 450,
                      color: "#374151",
                    }}
                  >
                    {toggle.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#a0a4ac",
                    }}
                  >
                    {toggle.description}
                  </span>
                </div>
                <ToggleSwitch
                  checked={checked}
                  onChange={() => setFilter(toggle.key, !checked)}
                />
              </div>
            );
          })}
        </div>

        {/* ---- Footer ---- */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t"
          style={{ borderColor: "#f0f1f3" }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: activeCount > 0 ? "#E8930C" : "#a0a4ac",
            }}
          >
            {activeCount} filtro{activeCount !== 1 ? "s" : ""} ativo{activeCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#E8930C",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            Resetar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
