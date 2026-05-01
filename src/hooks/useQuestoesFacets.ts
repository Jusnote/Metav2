import { useEffect, useRef, useState } from 'react';
import { filtersToSearchParams, EMPTY_FILTERS, type AppliedFilters } from '@/lib/questoes/filter-serialization';

const DEBOUNCE_MS = 300;
const LOCAL_CACHE_MAX = 30;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type FacetField =
  | 'banca'
  | 'ano'
  | 'orgao'
  | 'cargo'
  | 'area_concurso'
  | 'especialidade'
  | 'tipo'
  | 'formato';

export type FacetsByField = Partial<Record<FacetField, Record<string, number>>>;

export interface FacetsState {
  facets: FacetsByField;
  loading: boolean;
  error: string | null;
  cached: boolean;
  tookMs: number | null;
}

class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number) {}
  get(k: K): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: K, v: V): void {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
  }
}

const cache = new LRU<string, FacetsByField>(LOCAL_CACHE_MAX);

function mergeWithEmpty(filters: Partial<AppliedFilters>): AppliedFilters {
  return { ...EMPTY_FILTERS, ...filters };
}

function buildKey(filters: Partial<AppliedFilters>): string {
  // Pre-flight verificou: filtersToSearchParams aceita 1 arg só (sem options)
  return filtersToSearchParams(mergeWithEmpty(filters)).toString();
}

function isEmpty(filters: Partial<AppliedFilters>): boolean {
  return Object.values(filters).every(
    (v) => v === undefined || v === null || (Array.isArray(v) && v.length === 0),
  );
}

export function useQuestoesFacets(filters: Partial<AppliedFilters>): FacetsState {
  const [state, setState] = useState<FacetsState>({
    facets: {},
    loading: false,
    error: null,
    cached: false,
    tookMs: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isEmpty(filters)) {
      setState({ facets: {}, loading: false, error: null, cached: false, tookMs: null });
      return;
    }

    const key = buildKey(filters);
    const hit = cache.get(key);
    if (hit) {
      setState({ facets: hit, loading: false, error: null, cached: true, tookMs: 0 });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const params = filtersToSearchParams(mergeWithEmpty(filters));
        const res = await fetch(`${API_BASE}/api/v1/questoes/facets?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cache.set(key, data.facets);
        setState({
          facets: data.facets,
          loading: false,
          error: null,
          cached: data.cached ?? false,
          tookMs: data.took_ms ?? null,
        });
      } catch (e: unknown) {
        if ((e as Error)?.name === 'AbortError') return;
        setState({
          facets: {},
          loading: false,
          error: (e as Error)?.message || 'Erro ao buscar facets',
          cached: false,
          tookMs: null,
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return state;
}
