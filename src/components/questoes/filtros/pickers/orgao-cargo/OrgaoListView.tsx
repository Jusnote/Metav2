'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import type { OrgaoSelection } from '@/hooks/useOrgaoCargoState';

export interface OrgaoListViewProps {
  dicionario: FiltrosDicionario | null;
  orgaosSelecionados: Map<string, OrgaoSelection>;
  onSelectOrgao: (orgao: string) => void;
  onOpenFlatSearch: () => void;
}

export function OrgaoListView({
  dicionario,
  orgaosSelecionados,
  onSelectOrgao,
  onOpenFlatSearch,
}: OrgaoListViewProps) {
  const [q, setQ] = useState('');

  const allOrgaos = useMemo(() => {
    if (!dicionario) return [];
    const unique = [...new Set(Object.values(dicionario.orgaos))].sort();
    return unique.map((v) => ({ id: v, label: v }));
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (!q.trim()) return allOrgaos;
    const norm = q.trim().toLowerCase();
    return allOrgaos.filter((i) => i.label.toLowerCase().includes(norm));
  }, [allOrgaos, q]);

  return (
    <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200">
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 min-h-[72px] shrink-0">
        <div className="flex flex-col justify-center">
          <h2 className="text-lg font-semibold text-slate-900">Órgãos</h2>
          <p className="text-xs text-slate-500">
            {allOrgaos.length} instituições · clique para escolher cargos
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFlatSearch}
          className="text-xs text-blue-700 hover:underline shrink-0 mt-1"
        >
          Buscar cargo direto →
        </button>
      </header>
      <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto min-h-0">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar órgão…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <FilterAlphabeticList
        items={filtered}
        renderItem={(item) => {
          const sel = orgaosSelecionados.get(item.id);
          let badge: string | null = null;
          if (sel === 'all') badge = 'todos';
          else if (Array.isArray(sel)) badge = `${sel.length} cargos`;

          return (
            <button
              type="button"
              onClick={() => onSelectOrgao(item.id)}
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-left"
            >
              <span className="flex-1 text-sm text-blue-700 truncate">{item.label}</span>
              {badge && (
                <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                  {badge}
                </span>
              )}
            </button>
          );
        }}
      />
      </div>
    </div>
  );
}
