'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItem } from '@/components/questoes/filtros/shared/FilterCheckboxItem';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

const TOP_N_DEFAULT = 100;

export interface CargoFlatSearchViewProps {
  dicionario: FiltrosDicionario | null;
  flatCargosSelecionados: string[];
  facetsCargo: Record<string, number>;
  onToggleFlatCargo: (cargo: string) => void;
  onBack: () => void;
}

export function CargoFlatSearchView({
  dicionario,
  flatCargosSelecionados,
  facetsCargo,
  onToggleFlatCargo,
  onBack,
}: CargoFlatSearchViewProps) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const allCargos = useMemo(() => {
    if (!dicionario) return [];
    const unique = [...new Set(Object.values(dicionario.cargos))].sort();
    return unique;
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (q.trim()) {
      const norm = q.trim().toLowerCase();
      return allCargos.filter((c) => c.toLowerCase().includes(norm));
    }
    if (showAll) return allCargos;
    // Sem busca, mostra Top N por count desc
    return [...allCargos]
      .sort((a, b) => (facetsCargo[b] ?? 0) - (facetsCargo[a] ?? 0))
      .slice(0, TOP_N_DEFAULT);
  }, [allCargos, q, showAll, facetsCargo]);

  const items = filtered.map((c) => ({ id: c, label: c }));
  const selected = new Set(flatCargosSelecionados);

  return (
    <div className="flex flex-col">
      <header className="flex flex-col px-4 py-3 border-b border-slate-200 min-h-[72px] justify-center">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 self-start"
        >
          ← Voltar para órgãos
        </button>
        <h2 className="text-lg font-semibold text-slate-900">Buscar cargo direto</h2>
        <p className="text-xs text-slate-500">
          {q.trim() || showAll
            ? `${filtered.length} de ${allCargos.length} cargos`
            : `Top ${TOP_N_DEFAULT} mais comuns · ${allCargos.length} no total`}
        </p>
      </header>
      <div className="flex flex-col gap-3 p-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar cargo…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <FilterAlphabeticList
        items={items}
        renderItem={(item) => (
          <FilterCheckboxItem
            label={item.label}
            checked={selected.has(item.id)}
            onToggle={() => onToggleFlatCargo(item.id)}
            count={facetsCargo[item.id]}
          />
        )}
      />

      {!q.trim() && !showAll && allCargos.length > TOP_N_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-blue-700 hover:underline self-start mt-2"
        >
          Ver todos os {allCargos.length.toLocaleString('pt-BR')} cargos →
        </button>
      )}
      </div>
    </div>
  );
}
