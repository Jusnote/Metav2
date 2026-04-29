import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'taxonomia_recentes_v1';
const MAX = 20;

type Recente = { nodeId: number | string; nome: string; ts: number };

function safeRead(): Recente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeWrite(items: Recente[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // localStorage cheio, evict
    safeWrite(items.slice(0, Math.floor(MAX / 2)));
  }
}

export function useTaxonomiaRecentes() {
  const [items, setItems] = useState<Recente[]>(safeRead);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(safeRead());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const push = useCallback((r: Omit<Recente, 'ts'>) => {
    setItems(prev => {
      const dedup = prev.filter(x => x.nodeId !== r.nodeId);
      const next = [{ ...r, ts: Date.now() }, ...dedup].slice(0, MAX);
      safeWrite(next);
      return next;
    });
  }, []);

  return { items: items.slice(0, 5), push };
}
