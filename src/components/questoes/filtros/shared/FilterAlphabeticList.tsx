import React, { useMemo } from 'react';

export interface AlphabeticItem {
  id: string;
  label: string;
}

export interface FilterAlphabeticListProps<T extends AlphabeticItem> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  /** Retorna a chave do grupo. Default: primeira letra maiúscula do label. */
  getGroupKey?: (item: T) => string;
  /** Mostrado quando items está vazio. Default: nada. */
  emptyState?: React.ReactNode;
}

/**
 * Lista agrupada alfabeticamente com divisores de letra.
 *
 * Recebe items genéricos e função de render. Agrupa por inicial do label
 * (override via `getGroupKey`). Render do item fica a critério do consumidor —
 * pode ser FilterCheckboxItem, link de pasta, ou qualquer outro elemento.
 *
 * Exemplo:
 * ```tsx
 * <FilterAlphabeticList
 *   items={bancas}
 *   renderItem={(b) => (
 *     <FilterCheckboxItem
 *       label={b.label}
 *       checked={selected.has(b.id)}
 *       onToggle={() => toggle(b.id)}
 *       count={b.count}
 *     />
 *   )}
 * />
 * ```
 */
export function FilterAlphabeticList<T extends AlphabeticItem>({
  items,
  renderItem,
  getGroupKey,
  emptyState,
}: FilterAlphabeticListProps<T>) {
  const groups = useMemo(() => {
    const keyOf = getGroupKey ?? ((item: T) => firstLetter(item.label));
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyOf(item);
      const arr = map.get(key);
      if (arr) {
        arr.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, getGroupKey]);

  if (items.length === 0) {
    return <div className="py-4">{emptyState}</div>;
  }

  return (
    <div className="flex flex-col">
      {groups.map(([key, group]) => (
        <div key={key} className="flex flex-col">
          <div className="px-2 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {key}
          </div>
          {group.map((item) => (
            <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function firstLetter(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) return '#';
  const first = trimmed[0].toUpperCase();
  // Não-letra (número, símbolo) cai num bucket "#"
  return /[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÄËÏÖÜ]/.test(first) ? first : '#';
}
