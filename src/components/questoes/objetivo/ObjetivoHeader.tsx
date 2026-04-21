// src/components/questoes/objetivo/ObjetivoHeader.tsx
'use client';

import { Search, Target } from 'lucide-react';

interface ObjetivoHeaderProps {
  filtro: string;
  onFiltroChange: (value: string) => void;
  hasAnyFoco: boolean;
  onClearFocos: () => void;
}

export function ObjetivoHeader({
  filtro,
  onFiltroChange,
  hasAnyFoco,
  onClearFocos,
}: ObjetivoHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
        <Target className="h-[14px] w-[14px] text-[#94a3b8]" strokeWidth={2} />
        Objetivo
      </div>

      <div className="inline-flex items-center gap-[10px]">
        {hasAnyFoco && (
          <button
            type="button"
            onClick={onClearFocos}
            className="rounded-md border border-dashed border-[#cbd5e1] bg-transparent px-[10px] py-[4px] text-[11px] text-[#64748b] transition-colors hover:border-[#64748b] hover:text-[#0f172a]"
          >
            Limpar objetivo
          </button>
        )}

        <div className="inline-flex w-[200px] items-center gap-[6px] rounded-lg border border-[#e2e8f0] bg-white px-[10px] py-[5px]">
          <Search className="h-3 w-3 text-[#94a3b8]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Filtrar carreiras"
            value={filtro}
            onChange={(e) => onFiltroChange(e.target.value)}
            className="flex-1 border-none bg-transparent text-[12px] text-[#334155] outline-none placeholder:text-[#cbd5e1]"
          />
        </div>
      </div>
    </div>
  );
}
