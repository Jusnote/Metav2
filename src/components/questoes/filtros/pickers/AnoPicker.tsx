'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterRecentesBlock, FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared';
import { useFiltroRecentes } from '@/hooks/useFiltroRecentes';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface AnoPickerProps {
  dicionario: FiltrosDicionario | null;
  facets?: Record<string, number>;
  selected: number[];
  onChange: (next: number[]) => void;
}

export function AnoPicker({ dicionario, facets, selected, onChange }: AnoPickerProps) {
  const [q, setQ] = useState('');
  const { items: recentes, push } = useFiltroRecentes('ano');

  const allItems = useMemo(() => {
    if (!dicionario) return [];
    const { min, max } = dicionario.anos;
    const years: { id: string; label: string; ano: number }[] = [];
    for (let y = max; y >= min; y--) {
      years.push({ id: String(y), label: String(y), ano: y });
    }
    return years;
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (!q.trim()) return allItems;
    return allItems.filter((i) => i.label.includes(q.trim()));
  }, [allItems, q]);

  const toggle = (ano: number) => {
    const isSel = selected.includes(ano);
    const next = isSel ? selected.filter((v) => v !== ano) : [...selected, ano];
    onChange(next);
    if (!isSel) push({ value: String(ano), label: String(ano) });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-200 min-h-[72px] flex flex-col justify-center shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Ano(s)</h2>
        <p className="text-xs text-slate-500">
          {allItems.length} anos · agrupados por década
        </p>
      </header>
      <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto min-h-0 border-r border-slate-200">

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar ano…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      {!q && recentes.length > 0 && (
        <FilterRecentesBlock
          items={recentes}
          renderItem={(r) => (
            <button
              key={r.value}
              onClick={() => toggle(Number(r.value))}
              className="text-left text-sm text-blue-700 hover:underline"
              type="button"
            >
              {r.label}
            </button>
          )}
        />
      )}

      <FilterAlphabeticList
        items={filtered}
        getGroupKey={(item) => `${Math.floor(item.ano / 10) * 10}s`}
        groupSortOrder="desc"
        renderItem={(item) => (
          <FilterCheckboxItemWithCount
            label={item.label}
            checked={selected.includes(item.ano)}
            onToggle={() => toggle(item.ano)}
            count={facets?.[item.id]}
          />
        )}
      />
      </div>
    </div>
  );
}
