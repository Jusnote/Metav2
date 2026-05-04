'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterCheckboxItem } from '@/components/questoes/filtros/shared';
import type { OrgaoSelection } from '@/hooks/useOrgaoCargoState';

export interface OrgaoDrilldownViewProps {
  orgao: string;
  /** Map cargo→count vindo do facet contextual do backend */
  availableCargos: Record<string, number>;
  /** Estado atual deste órgão no state global */
  selection: OrgaoSelection | undefined;
  /** Total de questões do órgão (count global, sem refinamento de cargo) */
  totalCount?: number;
  onMarkAll: (orgao: string) => void;
  onTogglePair: (orgao: string, cargo: string) => void;
  /** Limpa o estado 'all' do órgão pra permitir seleção individual de cargos */
  onRefineToSpecific: (orgao: string) => void;
  onBack: () => void;
}

export function OrgaoDrilldownView({
  orgao,
  availableCargos,
  selection,
  totalCount,
  onMarkAll,
  onTogglePair,
  onRefineToSpecific,
  onBack,
}: OrgaoDrilldownViewProps) {
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    return Object.entries(availableCargos)
      .map(([cargo, count]) => ({ id: cargo, label: cargo, count }))
      .sort((a, b) => b.count - a.count); // mais frequentes primeiro
  }, [availableCargos]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const norm = q.trim().toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(norm));
  }, [items, q]);

  const isAllSelected = selection === 'all';
  const selectedCargos = Array.isArray(selection) ? new Set(selection) : new Set<string>();

  return (
    <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200 overflow-hidden">
      <header className="flex flex-col px-4 py-3 border-b border-slate-200 min-h-[72px] justify-center shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para instituições"
            title="Voltar para instituições"
            className="text-blue-600 hover:text-blue-800 text-lg leading-none shrink-0"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-slate-900">{orgao}</h2>
        </div>
        <p className="text-xs text-slate-500">{items.length} cargos disponíveis</p>
      </header>
      <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto min-h-0">

      {/* Botão destacado "Marcar todos" ou estado ativo "all" */}
      {isAllSelected ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex flex-col gap-1">
          <span>✓ Todos os cargos selecionados</span>
          <button
            type="button"
            onClick={() => onRefineToSpecific(orgao)}
            className="text-xs text-blue-700 hover:underline self-start"
          >
            ↳ Refinar cargos individualmente →
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onMarkAll(orgao)}
          className="w-full rounded-md bg-blue-900 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-800 transition-colors flex items-center justify-between"
        >
          <span>Marcar todos os cargos do {orgao}</span>
          {typeof totalCount === 'number' && (
            <span className="text-xs opacity-90 tabular-nums">
              {totalCount.toLocaleString('pt-BR')}
            </span>
          )}
        </button>
      )}

      {!isAllSelected && (
        <>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cargo…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => (
              <FilterCheckboxItem
                label={item.label}
                checked={selectedCargos.has(item.id)}
                onToggle={() => onTogglePair(orgao, item.id)}
                count={item.count}
              />
            )}
          />
        </>
      )}
      </div>
    </div>
  );
}
