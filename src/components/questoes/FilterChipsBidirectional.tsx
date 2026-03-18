"use client";

import React from "react";
import { useQuestoesOptional } from "@/contexts/QuestoesContext";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const CHIP_STYLES: Record<string, string> = {
  materias: "bg-blue-50 text-blue-700 border-blue-200",
  assuntos: "bg-blue-50 text-blue-700 border-blue-200",
  bancas: "bg-blue-50 text-blue-700 border-blue-200",
  anos: "bg-blue-50 text-blue-700 border-blue-200",
  orgaos: "bg-blue-50 text-blue-700 border-blue-200",
  cargos: "bg-blue-50 text-blue-700 border-blue-200",
};

const CHIP_LABELS: Record<string, string> = {
  materias: "Materia",
  assuntos: "Assunto",
  bancas: "Banca",
  anos: "Ano",
  orgaos: "Orgao",
  cargos: "Cargo",
};

export const FilterChipsBidirectional = React.memo(function FilterChipsBidirectional() {
  const ctx = useQuestoesOptional();
  if (!ctx) return null;

  const { filters, toggleFilter, clearFilters, activeFilterCount, searchQuery, setSearchQuery } = ctx;

  if (activeFilterCount === 0 && !searchQuery) return null;

  const arrayKeys = ['materias', 'assuntos', 'bancas', 'anos', 'orgaos', 'cargos'] as const;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      {searchQuery && (
        <Badge variant="outline" className="text-xs gap-1 bg-gray-50 text-gray-700 border-gray-200">
          Busca: {searchQuery.length > 25 ? searchQuery.slice(0, 25) + '...' : searchQuery}
          <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setSearchQuery('')} />
        </Badge>
      )}

      {arrayKeys.map(key =>
        (filters[key] as (string | number)[]).map(value => (
          <Badge
            key={`${key}-${value}`}
            variant="outline"
            className={`text-xs gap-1 ${CHIP_STYLES[key] || ''}`}
          >
            {value}
            <X
              className="h-2.5 w-2.5 cursor-pointer"
              onClick={() => toggleFilter(key, value)}
            />
          </Badge>
        ))
      )}

      {(activeFilterCount > 2 || (activeFilterCount > 0 && searchQuery)) && (
        <button
          onClick={clearFilters}
          className="text-[10px] text-muted-foreground hover:text-foreground ml-1"
        >
          Limpar tudo
        </button>
      )}
    </div>
  );
});
