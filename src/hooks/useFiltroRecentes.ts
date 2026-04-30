import { useCallback, useEffect, useState } from 'react';

const MAX_ITEMS = 5;

export interface FiltroRecenteItem {
  value: string;
  label: string;
  ts?: number;
}

function storageKey(field: string): string {
  return `filtros_recentes_${field}`;
}

function safeRead(field: string): FiltroRecenteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(field));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeWrite(field: string, items: FiltroRecenteItem[]): void {
  try {
    localStorage.setItem(storageKey(field), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage cheio → drop metade
    try {
      localStorage.setItem(
        storageKey(field),
        JSON.stringify(items.slice(0, Math.floor(MAX_ITEMS / 2))),
      );
    } catch {
      /* desiste */
    }
  }
}

export function useFiltroRecentes(field: string) {
  const [items, setItems] = useState<FiltroRecenteItem[]>(() => safeRead(field));

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === storageKey(field)) setItems(safeRead(field));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [field]);

  const push = useCallback(
    (item: { value: string; label: string }) => {
      setItems((prev) => {
        const dedup = prev.filter((x) => x.value !== item.value);
        const next = [{ ...item, ts: Date.now() }, ...dedup].slice(0, MAX_ITEMS);
        safeWrite(field, next);
        return next;
      });
    },
    [field],
  );

  return { items, push };
}
