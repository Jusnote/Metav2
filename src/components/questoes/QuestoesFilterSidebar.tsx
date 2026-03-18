"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { useQuestoesOptional } from "@/contexts/QuestoesContext";
import { useFiltrosDicionario } from "@/hooks/useFiltrosDicionario";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Building2,
  Calendar,
  Briefcase,
  Settings2,
  ChevronRight,
  X,
  Search,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";

// ============================================================
// FILTER SEARCH
// ============================================================

const FilterSearch = React.memo(function FilterSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative px-3 pb-2">
      <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar filtros..."
        className="w-full pl-8 pr-8 py-1.5 text-xs bg-muted/50 border border-transparent rounded-lg
          placeholder:text-muted-foreground/50
          focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300/50 focus:bg-white
          transition-all duration-200"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
});

// ============================================================
// FILTER SECTION (generic expandable wrapper)
// ============================================================

interface FilterSectionProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  activeCount: number;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  hoverBg: string;
  hoverBorder: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterSection = React.memo(function FilterSection({
  icon,
  iconBg,
  label,
  activeCount,
  badgeBg,
  badgeText,
  borderColor,
  hoverBg,
  hoverBorder,
  isOpen,
  onToggle,
  children,
}: FilterSectionProps) {
  return (
    <div className="mb-1">
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group",
          isOpen
            ? `bg-opacity-50 ${hoverBg} border ${hoverBorder}`
            : `border border-transparent hover:${hoverBg} hover:border ${hoverBorder}`
        )}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200 shrink-0",
            isOpen && "rotate-90"
          )}
        />
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-sm",
            iconBg
          )}
        >
          {icon}
        </div>
        <span className="text-sm font-medium text-foreground truncate flex-1 text-left">
          {label}
        </span>
        {activeCount > 0 && (
          <span
            className={cn(
              "text-[10px] font-medium h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center",
              badgeBg,
              badgeText
            )}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Collapsible content */}
      <div className={cn("filter-collapse", isOpen && "open")}>
        <div>
          <div className={cn("mt-1.5 ml-5 pl-3 border-l-2", borderColor)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================
// MATERIA TREE
// ============================================================

function MateriaTree({ searchQuery }: { searchQuery: string }) {
  const ctx = useQuestoesOptional();
  const { dicionario } = useFiltrosDicionario();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const materiaAssuntos = dicionario?.materia_assuntos || {};

  const materias = useMemo(
    () => Object.keys(materiaAssuntos).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [materiaAssuntos]
  );

  const filtered = useMemo(() => {
    if (!searchQuery) return materias;
    const q = searchQuery.toLowerCase();
    return materias.filter(
      (m) =>
        m.toLowerCase().includes(q) ||
        (materiaAssuntos[m] || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [materias, searchQuery, materiaAssuntos]);

  if (!ctx || !dicionario) return null;

  const { filters, toggleFilter, setFilter } = ctx;

  const toggleExpand = (materia: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(materia) ? next.delete(materia) : next.add(materia);
      return next;
    });
  };

  const isAssuntoSelected = (assunto: string) =>
    filters.assuntos.includes(assunto);

  const toggleTudo = (materia: string) => {
    const assuntos = materiaAssuntos[materia] || [];
    const allSelected = assuntos.every((a) => filters.assuntos.includes(a));

    if (allSelected) {
      setFilter("assuntos", filters.assuntos.filter((a) => !assuntos.includes(a)));
      setFilter("materias", filters.materias.filter((m) => m !== materia));
    } else {
      const merged = [...new Set([...filters.assuntos, ...assuntos])];
      setFilter("assuntos", merged);
      if (!filters.materias.includes(materia)) {
        setFilter("materias", [...filters.materias, materia]);
      }
    }
  };

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60 py-2 px-1">
        Nenhuma materia encontrada
      </p>
    );
  }

  return (
    <div className="space-y-0.5 py-1">
      {filtered.map((materia) => {
        const assuntos = materiaAssuntos[materia] || [];
        const isExpanded = expanded.has(materia);
        const selectedAssuntosCount = assuntos.filter((a) =>
          isAssuntoSelected(a)
        ).length;
        const allSelected = assuntos.length > 0 && selectedAssuntosCount === assuntos.length;
        const someSelected = selectedAssuntosCount > 0 && !allSelected;

        const filteredAssuntos = searchQuery
          ? assuntos.filter((a) =>
              a.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : assuntos;

        return (
          <div key={materia}>
            {/* Materia badge header */}
            <button

              onClick={() => toggleExpand(materia)}
              className={cn(
                "w-full flex items-center gap-2 py-1.5 px-1 text-left rounded-md transition-colors group",
                "hover:bg-accent/50",
                isExpanded && "bg-accent/30"
              )}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground/60 transition-transform duration-200 shrink-0",
                  isExpanded && "rotate-90"
                )}
              />
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-wide w-fit bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {materia.toUpperCase()}
              </span>
              {selectedAssuntosCount > 0 && (
                <span className="text-[9px] font-medium bg-amber-600 text-white px-1.5 py-0.5 rounded-full ml-auto">
                  {selectedAssuntosCount}
                </span>
              )}
            </button>

            {/* Assuntos */}
            <div className={cn("filter-collapse", isExpanded && "open")}>
              <div>
                <div className="space-y-0 ml-3.5 pl-3 border-l border-zinc-200/60 dark:border-zinc-700/40">
                  {/* "Tudo" checkbox */}
                  <label

                    className={cn(
                      "flex items-center gap-2 cursor-pointer py-1.5 px-1.5 rounded-md transition-all duration-150",
                      allSelected ? "bg-amber-50/50" : "hover:bg-zinc-100/50"
                    )}
                  >
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                      onCheckedChange={() => toggleTudo(materia)}
                      className={cn(
                        "h-3.5 w-3.5 rounded-[3px] border-muted-foreground/30 transition-colors",
                        (allSelected || someSelected) &&
                          "border-amber-600 bg-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 data-[state=indeterminate]:bg-amber-600 data-[state=indeterminate]:border-amber-600"
                      )}
                    />
                    <span className={cn(
                      "text-xs font-medium flex-1",
                      allSelected ? "text-amber-800" : "text-foreground/70"
                    )}>
                      Tudo
                    </span>
                  </label>

                  {/* Individual assuntos */}
                  <div className="max-h-40 overflow-y-auto custom-scrollbar">
                    {filteredAssuntos.map((assunto) => {
                      const assuntoSelected = isAssuntoSelected(assunto);
                      return (
                        <label
                          key={assunto}
                          data-tree-branch
                          data-tree-level={1}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded-md transition-all duration-150",
                            assuntoSelected
                              ? "bg-amber-50/50"
                              : "hover:bg-zinc-100/50"
                          )}
                        >
                          <Checkbox
                            checked={assuntoSelected}
                            onCheckedChange={() =>
                              toggleFilter("assuntos", assunto)
                            }
                            className={cn(
                              "h-3 w-3 rounded-[2px] border-muted-foreground/25 transition-colors",
                              assuntoSelected &&
                                "border-amber-600 bg-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs truncate flex-1",
                              assuntoSelected
                                ? "font-medium text-amber-800"
                                : "text-muted-foreground"
                            )}
                          >
                            {assunto}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// CHECKBOX LIST (generic for Banca, Orgao, Cargo)
// ============================================================

const ITEM_HEIGHT = 30;

const CheckboxFilterList = React.memo(function CheckboxFilterList({
  items,
  selected,
  onToggle,
  colorChecked,
  searchQuery,
}: {
  items: string[];
  selected: (string | number)[];
  onToggle: (value: string | number) => void;
  colorChecked: string;
  searchQuery: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((i) => i.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const selectedSet = useMemo(
    () => new Set(selected as (string | number)[]),
    [selected]
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60 py-2 px-1">
        Nenhum item encontrado
      </p>
    );
  }

  return (
    <div ref={parentRef} className="max-h-44 overflow-y-auto custom-scrollbar py-1">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = filtered[virtualRow.index];
          const isSelected = selectedSet.has(item);
          return (
            <label
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className={cn(
                "flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded-md transition-all duration-150 absolute left-0 w-full",
                isSelected ? "bg-accent/70" : "hover:bg-accent/40"
              )}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(item)}
                className={cn(
                  "h-3.5 w-3.5 rounded-[3px] border-muted-foreground/30 transition-colors",
                  isSelected && colorChecked
                )}
              />
              <span
                className={cn(
                  "text-xs truncate flex-1",
                  isSelected ? "font-medium text-foreground" : "text-foreground/70"
                )}
              >
                {item}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
});

// ============================================================
// YEAR GRID
// ============================================================

function YearGrid({ searchQuery }: { searchQuery: string }) {
  const ctx = useQuestoesOptional();
  const { dicionario } = useFiltrosDicionario();

  if (!ctx || !dicionario) return null;

  const { filters, toggleFilter, setFilter } = ctx;
  const currentYear = new Date().getFullYear();
  const minYear = dicionario.anos?.min || 2010;
  const maxYear = dicionario.anos?.max || currentYear;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const filteredYears = searchQuery
    ? years.filter((y) => String(y).includes(searchQuery))
    : years;

  const selectQuickRange = (n: number) => {
    const selected = years.filter((y) => y >= currentYear - n + 1);
    setFilter("anos", selected);
  };

  return (
    <div className="space-y-2.5 py-1">
      {/* Quick range buttons */}
      <div className="flex gap-1.5">
        {[
          { label: "Ult. 3 anos", n: 3 },
          { label: "Ult. 5 anos", n: 5 },
          { label: "Ult. 10", n: 10 },
        ].map(({ label, n }) => (
          <button
            key={n}
            onClick={() => selectQuickRange(n)}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium border border-zinc-200
              text-zinc-600 bg-zinc-50
              hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700
              transition-all duration-150"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Year grid */}
      <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
        {filteredYears.map((year) => {
          const isSelected = filters.anos.includes(year);
          return (
            <button
              key={year}
              onClick={() => toggleFilter("anos", year)}
              className={cn(
                "flex items-center justify-center py-1.5 rounded-md text-xs border transition-all duration-150",
                isSelected
                  ? "bg-amber-100 border-amber-300 text-amber-800 font-semibold shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ADVANCED TOGGLES (Switch-based)
// ============================================================

function AdvancedToggles() {
  const ctx = useQuestoesOptional();
  if (!ctx) return null;

  const { filters, toggleFilter } = ctx;

  const toggles = [
    {
      key: "excluirAnuladas" as const,
      label: "Excluir anuladas",
      desc: "Remove questoes anuladas pela banca",
    },
    {
      key: "excluirDesatualizadas" as const,
      label: "Excluir desatualizadas",
      desc: "Remove questoes com legislacao alterada",
    },
    {
      key: "excluirResolvidas" as const,
      label: "Excluir ja acertadas",
      desc: "Mostra apenas questoes nao resolvidas",
    },
  ];

  return (
    <div className="space-y-3 py-1">
      {toggles.map(({ key, label, desc }) => (
        <div key={key} className="flex items-center justify-between gap-3 px-1">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground/80">{label}</p>
            <p className="text-[10px] text-muted-foreground/60 truncate">
              {desc}
            </p>
          </div>
          <Switch
            checked={filters[key]}
            onCheckedChange={() => toggleFilter(key, "")}
            className="shrink-0 h-5 w-9 data-[state=checked]:bg-amber-600"
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ACTIVE FILTER CHIPS
// ============================================================

interface ChipConfig {
  key: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  onRemove: () => void;
}

function ActiveChips() {
  const ctx = useQuestoesOptional();

  const chips = useMemo(() => {
    if (!ctx) return [];
    const { filters, toggleFilter } = ctx;
    return [
    ...filters.materias.map((v) => ({
      key: `m-${v}`,
      label: v,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-800/30",
      onRemove: () => toggleFilter("materias", v),
    })),
    ...filters.assuntos.map((v) => ({
      key: `as-${v}`,
      label: v,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-800/30",
      onRemove: () => toggleFilter("assuntos", v),
    })),
    ...filters.bancas.map((v) => ({
      key: `b-${v}`,
      label: v,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-800/30",
      onRemove: () => toggleFilter("bancas", v),
    })),
    ...filters.anos.map((v) => ({
      key: `a-${v}`,
      label: String(v),
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-800/30",
      onRemove: () => toggleFilter("anos", v),
    })),
    ...filters.orgaos.map((v) => ({
      key: `o-${v}`,
      label: v,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-800/30",
      onRemove: () => toggleFilter("orgaos", v),
    })),
    ...filters.cargos.map((v) => ({
      key: `c-${v}`,
      label: v,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-800/30",
      onRemove: () => toggleFilter("cargos", v),
    })),
  ] as ChipConfig[];
  }, [ctx]);

  if (chips.length === 0) return null;

  return (
    <div className="px-3 py-2 border-t border-border/50">
      <div className="flex flex-wrap gap-1">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all duration-150",
              chip.bg,
              chip.text,
              chip.border,
              "hover:shadow-sm"
            )}
          >
            <span className="truncate max-w-[100px]">{chip.label}</span>
            <button
              onClick={chip.onRemove}
              className="shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN SIDEBAR
// ============================================================

export function QuestoesFilterSidebar() {
  const ctx = useQuestoesOptional();
  const { dicionario, loading: dicionarioLoading } = useFiltrosDicionario();
  const [searchQuery, setSearchQuery] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["materia", "avancado"])
  );

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  }, []);

  // Memoize sorted lists — MUST be before any conditional returns (Rules of Hooks)
  const bancasList = useMemo(
    () => dicionario ? [...new Set(Object.values(dicionario.bancas))].sort((a, b) => a.localeCompare(b, "pt-BR")) : [],
    [dicionario]
  );
  const orgaosList = useMemo(
    () => dicionario ? [...new Set(Object.values(dicionario.orgaos))].sort((a, b) => a.localeCompare(b, "pt-BR")) : [],
    [dicionario]
  );
  const cargosList = useMemo(
    () => dicionario ? [...new Set(Object.values(dicionario.cargos))].sort((a, b) => a.localeCompare(b, "pt-BR")) : [],
    [dicionario]
  );

  // Stable toggle callbacks — MUST be before any conditional returns
  const toggleBanca = useCallback((v: string | number) => { ctx?.toggleFilter("bancas", v as string); }, [ctx]);
  const toggleOrgao = useCallback((v: string | number) => { ctx?.toggleFilter("orgaos", v as string); }, [ctx]);
  const toggleCargo = useCallback((v: string | number) => { ctx?.toggleFilter("cargos", v as string); }, [ctx]);

  // No context = not on questoes route
  if (!ctx) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <div className="text-center space-y-2">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground/50">
            Navegue para Questoes
          </p>
        </div>
      </div>
    );
  }

  const { filters, toggleFilter, clearFilters, activeFilterCount } = ctx;

  // Loading state
  if (dicionarioLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        <p className="text-xs text-muted-foreground/60">
          Carregando filtros...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
          </div>
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-2 bg-amber-100 text-amber-700 border-amber-200/60 font-semibold dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30"
            >
              {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <FilterSearch value={searchQuery} onChange={setSearchQuery} />

      {/* ── Divider ── */}
      <div className="mx-3 border-t border-border/40 mb-1" />

      {/* ── Filter Sections ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar scroll-fade px-3 py-1">
        {/* Materia */}
        <FilterSection
          icon={<BookOpen className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />}
          iconBg="bg-zinc-200 dark:bg-zinc-700"
          label="Materia"
          activeCount={filters.materias.length + filters.assuntos.length}
          badgeBg="bg-amber-100 dark:bg-amber-900/30"
          badgeText="text-amber-700 dark:text-amber-300"
          borderColor="border-zinc-200/50 dark:border-zinc-700/50"
          hoverBg="bg-zinc-50/50 dark:bg-zinc-800/30"
          hoverBorder="border-zinc-200/50 dark:border-zinc-700/30"
          isOpen={openSections.has("materia")}
          onToggle={() => toggleSection("materia")}
        >
          <MateriaTree searchQuery={searchQuery} />
        </FilterSection>

        {/* Banca */}
        <FilterSection
          icon={<Building2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />}
          iconBg="bg-zinc-200 dark:bg-zinc-700"
          label="Banca"
          activeCount={filters.bancas.length}
          badgeBg="bg-amber-100 dark:bg-amber-900/30"
          badgeText="text-amber-700 dark:text-amber-300"
          borderColor="border-zinc-200/50 dark:border-zinc-700/50"
          hoverBg="bg-zinc-50/50 dark:bg-zinc-800/30"
          hoverBorder="border-zinc-200/50 dark:border-zinc-700/30"
          isOpen={openSections.has("banca")}
          onToggle={() => toggleSection("banca")}
        >
          <CheckboxFilterList
            items={bancasList}
            selected={filters.bancas}
            onToggle={toggleBanca}
            colorChecked="border-amber-600 bg-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
            searchQuery={searchQuery}
          />
        </FilterSection>

        {/* Ano */}
        <FilterSection
          icon={<Calendar className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />}
          iconBg="bg-zinc-200 dark:bg-zinc-700"
          label="Ano"
          activeCount={filters.anos.length}
          badgeBg="bg-amber-100 dark:bg-amber-900/30"
          badgeText="text-amber-700 dark:text-amber-300"
          borderColor="border-zinc-200/50 dark:border-zinc-700/50"
          hoverBg="bg-zinc-50/50 dark:bg-zinc-800/30"
          hoverBorder="border-zinc-200/50 dark:border-zinc-700/30"
          isOpen={openSections.has("ano")}
          onToggle={() => toggleSection("ano")}
        >
          <YearGrid searchQuery={searchQuery} />
        </FilterSection>

        {/* Orgao / Cargo */}
        <FilterSection
          icon={<Briefcase className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />}
          iconBg="bg-zinc-200 dark:bg-zinc-700"
          label="Orgao / Cargo"
          activeCount={filters.orgaos.length + filters.cargos.length}
          badgeBg="bg-amber-100 dark:bg-amber-900/30"
          badgeText="text-amber-700 dark:text-amber-300"
          borderColor="border-zinc-200/50 dark:border-zinc-700/50"
          hoverBg="bg-zinc-50/50 dark:bg-zinc-800/30"
          hoverBorder="border-zinc-200/50 dark:border-zinc-700/30"
          isOpen={openSections.has("orgao-cargo")}
          onToggle={() => toggleSection("orgao-cargo")}
        >
          <div className="space-y-3 py-1">
            {orgaosList.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1 px-1">
                  Orgao
                </p>
                <CheckboxFilterList
                  items={orgaosList}
                  selected={filters.orgaos}
                  onToggle={toggleOrgao}
                  colorChecked="border-amber-600 bg-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  searchQuery={searchQuery}
                />
              </div>
            )}
            {cargosList.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1 px-1">
                  Cargo
                </p>
                <CheckboxFilterList
                  items={cargosList}
                  selected={filters.cargos}
                  onToggle={toggleCargo}
                  colorChecked="border-amber-600 bg-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  searchQuery={searchQuery}
                />
              </div>
            )}
          </div>
        </FilterSection>

        {/* Avancado */}
        <FilterSection
          icon={<Settings2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />}
          iconBg="bg-zinc-200 dark:bg-zinc-700"
          label="Avancado"
          activeCount={
            (filters.excluirAnuladas ? 1 : 0) +
            (filters.excluirDesatualizadas ? 1 : 0) +
            (filters.excluirResolvidas ? 1 : 0)
          }
          badgeBg="bg-zinc-100 dark:bg-zinc-800"
          badgeText="text-zinc-600 dark:text-zinc-400"
          borderColor="border-zinc-200/50 dark:border-zinc-700/50"
          hoverBg="bg-zinc-50/50 dark:bg-zinc-800/30"
          hoverBorder="border-zinc-200/50 dark:border-zinc-700/30"
          isOpen={openSections.has("avancado")}
          onToggle={() => toggleSection("avancado")}
        >
          <AdvancedToggles />
        </FilterSection>
      </div>

      {/* ── Active Chips ── */}
      <ActiveChips />

      {/* ── Footer ── */}
      <div className="px-3 py-2.5 border-t border-border/50 space-y-1.5">
        <Button
          className="w-full h-9 text-sm font-medium rounded-lg
            bg-[#E8930C]
            hover:bg-[#D4860B]
            text-white shadow-[0_1px_4px_rgba(232,147,12,0.25)]
            hover:shadow-[0_2px_8px_rgba(232,147,12,0.30)]
            transition-all duration-200
            active:scale-[0.98]"
          size="sm"
        >
          <Search className="h-3.5 w-3.5 mr-2" />
          Buscar questoes
        </Button>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="w-full text-[11px] text-muted-foreground/60 hover:text-foreground/80 text-center py-0.5 transition-colors duration-200"
          >
            Limpar todos os filtros
          </button>
        )}
      </div>
    </div>
  );
}
