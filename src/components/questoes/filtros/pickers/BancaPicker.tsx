'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterRecentesBlock } from '@/components/questoes/filtros/shared';
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
    <div className="flex flex-col gap-3 p-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Bancas</h2>
        <p className="text-xs text-slate-500">
          {allItems.length} · marque para filtrar
        </p>
      </header>

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
  );
}

// Local helper — will be extracted to shared/ in next task when other pickers reuse it.
function FilterCheckboxItemWithCount({
  label,
  checked,
  onToggle,
  count,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded text-left"
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-400"
      />
      <span className="flex-1 text-sm text-slate-800">{label}</span>
      {typeof count === 'number' && (
        <span className="text-xs text-slate-400 tabular-nums">{count}</span>
      )}
    </button>
  );
}
