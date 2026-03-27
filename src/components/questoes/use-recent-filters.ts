import { useState, useCallback } from 'react';

const STORAGE_KEY = 'questoes_recent_filters';
const MAX_ENTRIES = 3;

interface RecentEntry {
  values: string[];
  timestamp: number;
}

type RecentsMap = Record<string, RecentEntry[]>;

function loadRecents(): RecentsMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveRecents(map: RecentsMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function useRecentFilters(categoryKey: string) {
  const [recents, setRecents] = useState<RecentEntry[]>(
    () => loadRecents()[categoryKey] || [],
  );

  const addRecent = useCallback(
    (values: string[]) => {
      if (values.length === 0) return;
      const map = loadRecents();
      const key = [...values].sort().join('+');
      const existing = (map[categoryKey] || []).filter(
        e => [...e.values].sort().join('+') !== key,
      );
      const updated = [{ values, timestamp: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
      map[categoryKey] = updated;
      saveRecents(map);
      setRecents(updated);
    },
    [categoryKey],
  );

  return { recents, addRecent };
}
