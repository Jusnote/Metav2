import { useEffect, useRef, useState } from 'react';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { filtersToSearchParams } from '@/lib/questoes/filter-serialization';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.projetopapiro.com.br';

const DEBOUNCE_MS = 300;
const LOCAL_CACHE_MAX = 50;

export interface CountState {
  count: number | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  tookMs: number | null;
}

const initialState: CountState = {
  count: null,
  loading: false,
  error: null,
  cached: false,
  tookMs: null,
};

class LRUCache<K, V> {
  private map: Map<K, V> = new Map();
  constructor(private max: number) {}
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
  }
}

const lruCache = new LRUCache<string, { count: number; tookMs: number }>(LOCAL_CACHE_MAX);

function buildCacheKey(filters: AppliedFilters): string {
  const params = filtersToSearchParams(filters);
  const entries = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

export function useQuestoesCount(filters: AppliedFilters): CountState {
  const [state, setState] = useState<CountState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const cacheKey = buildCacheKey(filters);
    const localHit = lruCache.get(cacheKey);

    if (localHit) {
      setState({
        count: localHit.count,
        loading: false,
        error: null,
        cached: true,
        tookMs: localHit.tookMs,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      const params = filtersToSearchParams(filters);
      const url = `${API_BASE}/api/v1/questoes/count?${params.toString()}`;

      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<{
            count: number;
            took_ms: number;
            cached: boolean;
          }>;
        })
        .then((data) => {
          lruCache.set(cacheKey, { count: data.count, tookMs: data.took_ms });
          setState({
            count: data.count,
            loading: false,
            error: null,
            cached: data.cached,
            tookMs: data.took_ms,
          });
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setState({
            count: null,
            loading: false,
            error: err.message,
            cached: false,
            tookMs: null,
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [filters]);

  return state;
}
