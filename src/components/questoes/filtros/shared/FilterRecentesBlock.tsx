import React from 'react';

export interface FilterRecentesBlockProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  /** Quantidade máxima exibida. Default: 5. */
  max?: number;
}

/**
 * Bloco "Recentes" no topo do picker.
 *
 * Renderiza nada quando `items` está vazio (não polui UI). Limita a `max` items
 * (default 5). Mesmo padrão visual do divisor alfabético do `FilterAlphabeticList`.
 *
 * O caller decide quais items são "recentes" (via `useRecentFilters` ou outra fonte)
 * e como cada um é renderizado.
 */
export function FilterRecentesBlock<T>({
  items,
  renderItem,
  max = 5,
}: FilterRecentesBlockProps<T>) {
  if (items.length === 0) return null;

  const visible = items.slice(0, max);

  return (
    <div className="flex flex-col">
      <div className="px-2 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        Recentes
      </div>
      {visible.map((item, index) => (
        <React.Fragment key={index}>{renderItem(item)}</React.Fragment>
      ))}
    </div>
  );
}
