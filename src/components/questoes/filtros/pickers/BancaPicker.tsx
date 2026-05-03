'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterRecentesBlock, FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared';
import { useFiltroRecentes } from '@/hooks/useFiltroRecentes';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface BancaPickerProps {
  dicionario: FiltrosDicionario | null;
  facets?: Record<string, number>;
  selected: string[];
  onChange: (next: string[]) => void;
}

export function BancaPicker({ dicionario, facets, selected, onChange }: BancaPickerProps) {
  const [q, setQ] = useState('');
  const { items: recentes, push } = useFiltroRecentes('banca');

  const allItems = useMemo(() => {
    if (!dicionario) return [];
    const unique = [...new Set(Object.values(dicionario.bancas))].sort();
    return unique.map((v) => ({ id: v, label: v }));
  }, [dicionario]);

  const filtered = useMemo(() => {
    if (!q.trim()) return allItems;
    const norm = q.trim().toLowerCase();
    return allItems.filter((i) => i.label.toLowerCase().includes(norm));
  }, [allItems, q]);

  const toggle = (value: string) => {
    const isSel = selected.includes(value);
    const next = isSel ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
    if (!isSel) push({ value, label: value });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200">
      <header className="px-4 py-3 border-b border-slate-200 min-h-[72px] flex flex-col justify-center shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Bancas</h2>
        <p className="text-xs text-slate-500">
          {allItems.length} · marque para filtrar
        </p>
      </header>
      <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto min-h-0">

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar banca…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      {!q && recentes.length > 0 && (
        <FilterRecentesBlock
          items={recentes}
          renderItem={(r) => (
            <button
              key={r.value}
              onClick={() => toggle(r.value)}
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
        renderItem={(item) => (
          <FilterCheckboxItemWithCount
            label={item.label}
            checked={selected.includes(item.id)}
            onToggle={() => toggle(item.id)}
            count={facets?.[item.id]}
          />
        )}
      />
      </div>
    </div>
  );
}
