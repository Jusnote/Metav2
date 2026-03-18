"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, startTransition } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

// ============ TIPOS ============

export interface QuestoesFilters {
  materias: string[];
  assuntos: string[];
  bancas: string[];
  anos: number[];
  orgaos: string[];
  cargos: string[];
  excluirAnuladas: boolean;
  excluirDesatualizadas: boolean;
  excluirResolvidas: boolean;
}

export type ViewMode = 'lista' | 'individual';
export type StatusTab = 'todas' | 'nao_resolvidas' | 'erradas' | 'marcadas';
export type SortOption = 'recentes' | 'dificuldade' | 'menos_resolvidas' | 'relevancia';

export interface QuestoesContextValue {
  // Filtros (bidirecional sidebar <-> main)
  filters: QuestoesFilters;
  setFilter: <K extends keyof QuestoesFilters>(key: K, value: QuestoesFilters[K]) => void;
  toggleFilter: (key: keyof QuestoesFilters, value: string | number) => void;
  removeFilter: (key: keyof QuestoesFilters, value?: string | number) => void;
  clearFilters: () => void;
  activeFilterCount: number;

  // Pagination
  page: number;
  setPage: (p: number) => void;

  // View state
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  statusTab: StatusTab;
  setStatusTab: (t: StatusTab) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

// ============ DEFAULTS ============

const defaultFilters: QuestoesFilters = {
  materias: [],
  assuntos: [],
  bancas: [],
  anos: [],
  orgaos: [],
  cargos: [],
  excluirAnuladas: false,
  excluirDesatualizadas: false,
  excluirResolvidas: false,
};

// ============ URL SYNC HELPERS ============

function filtersToSearchParams(filters: QuestoesFilters, extra: {
  searchQuery?: string;
  statusTab?: StatusTab;
  sortBy?: SortOption;
}): URLSearchParams {
  const params = new URLSearchParams();

  filters.materias.forEach(v => params.append('materia', v));
  filters.assuntos.forEach(v => params.append('assunto', v));
  filters.bancas.forEach(v => params.append('banca', v));
  filters.anos.forEach(v => params.append('ano', String(v)));
  filters.orgaos.forEach(v => params.append('orgao', v));
  filters.cargos.forEach(v => params.append('cargo', v));

  if (filters.excluirAnuladas) params.set('excluir_anuladas', '1');
  if (filters.excluirDesatualizadas) params.set('excluir_desatualizadas', '1');
  if (filters.excluirResolvidas) params.set('excluir_resolvidas', '1');

  if (extra.searchQuery) params.set('q', extra.searchQuery);
  if (extra.statusTab && extra.statusTab !== 'todas') params.set('tab', extra.statusTab);
  if (extra.sortBy && extra.sortBy !== 'recentes') params.set('sort', extra.sortBy);

  return params;
}

function searchParamsToFilters(params: URLSearchParams): {
  filters: QuestoesFilters;
  searchQuery: string;
  statusTab: StatusTab;
  sortBy: SortOption;
} {
  return {
    filters: {
      materias: params.getAll('materia'),
      assuntos: params.getAll('assunto'),
      bancas: params.getAll('banca'),
      anos: params.getAll('ano').map(Number).filter(n => !isNaN(n)),
      orgaos: params.getAll('orgao'),
      cargos: params.getAll('cargo'),
      excluirAnuladas: params.get('excluir_anuladas') === '1',
      excluirDesatualizadas: params.get('excluir_desatualizadas') === '1',
      excluirResolvidas: params.get('excluir_resolvidas') === '1',
    },
    searchQuery: params.get('q') || '',
    statusTab: (params.get('tab') as StatusTab) || 'todas',
    sortBy: (params.get('sort') as SortOption) || 'recentes',
  };
}

function countActiveFilters(filters: QuestoesFilters): number {
  return (
    filters.materias.length +
    filters.assuntos.length +
    filters.bancas.length +
    filters.anos.length +
    filters.orgaos.length +
    filters.cargos.length +
    (filters.excluirAnuladas ? 1 : 0) +
    (filters.excluirDesatualizadas ? 1 : 0) +
    (filters.excluirResolvidas ? 1 : 0)
  );
}

// ============ CONTEXT ============

const QuestoesContext = createContext<QuestoesContextValue | null>(null);

export function useQuestoesContext(): QuestoesContextValue {
  const ctx = useContext(QuestoesContext);
  if (!ctx) {
    throw new Error('useQuestoesContext must be used within QuestoesProvider');
  }
  return ctx;
}

export function useQuestoesOptional(): QuestoesContextValue | null {
  return useContext(QuestoesContext);
}

// ============ PROVIDER ============

export function QuestoesProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isQuestoesRoute = location.pathname.startsWith('/questoes');

  if (!isQuestoesRoute) {
    return <>{children}</>;
  }

  return <QuestoesProviderInner>{children}</QuestoesProviderInner>;
}

function QuestoesProviderInner({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);

  // Initialize from URL
  const initial = searchParamsToFilters(searchParams);

  const [filters, setFilters] = useState<QuestoesFilters>(initial.filters);
  const [searchQuery, setSearchQuery] = useState(initial.searchQuery);
  const [statusTab, setStatusTab] = useState<StatusTab>(initial.statusTab);
  const [sortBy, setSortBy] = useState<SortOption>(initial.sortBy);
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [page, setPageRaw] = useState(1);

  // Reset page to 1 when filters/search/tab/sort change
  const prevFiltersRef = useRef(filters);
  const prevSearchRef = useRef(searchQuery);
  const prevTabRef = useRef(statusTab);
  const prevSortRef = useRef(sortBy);
  useEffect(() => {
    if (
      prevFiltersRef.current !== filters ||
      prevSearchRef.current !== searchQuery ||
      prevTabRef.current !== statusTab ||
      prevSortRef.current !== sortBy
    ) {
      setPageRaw(1);
      prevFiltersRef.current = filters;
      prevSearchRef.current = searchQuery;
      prevTabRef.current = statusTab;
      prevSortRef.current = sortBy;
    }
  }, [filters, searchQuery, statusTab, sortBy]);

  const setPage = useCallback((p: number) => setPageRaw(p), []);

  // Sync state → URL (debounced to avoid double render cycles)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = filtersToSearchParams(filters, { searchQuery, statusTab, sortBy });
      setSearchParams(params, { replace: true });
    }, 150);

    return () => clearTimeout(timer);
  }, [filters, searchQuery, statusTab, sortBy, setSearchParams]);

  const setFilter = useCallback(<K extends keyof QuestoesFilters>(key: K, value: QuestoesFilters[K]) => {
    startTransition(() => {
      setFilters(prev => ({ ...prev, [key]: value }));
    });
  }, []);

  const toggleFilter = useCallback((key: keyof QuestoesFilters, value: string | number) => {
    startTransition(() => {
      setFilters(prev => {
        const current = prev[key];
        if (typeof current === 'boolean') {
          return { ...prev, [key]: !current };
        }
        const arr = current as (string | number)[];
        const exists = arr.includes(value);
        return {
          ...prev,
          [key]: exists ? arr.filter(v => v !== value) : [...arr, value],
        };
      });
    });
  }, []);

  const removeFilter = useCallback((key: keyof QuestoesFilters, value?: string | number) => {
    startTransition(() => {
      setFilters(prev => {
        const current = prev[key];
        if (typeof current === 'boolean') {
          return { ...prev, [key]: false };
        }
        if (value === undefined) {
          return { ...prev, [key]: [] };
        }
        const arr = current as (string | number)[];
        return { ...prev, [key]: arr.filter(v => v !== value) };
      });
    });
  }, []);

  const clearFilters = useCallback(() => {
    startTransition(() => {
      setFilters(defaultFilters);
      setSearchQuery('');
    });
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const value = useMemo<QuestoesContextValue>(() => ({
    filters,
    setFilter,
    toggleFilter,
    removeFilter,
    clearFilters,
    activeFilterCount,
    page,
    setPage,
    viewMode,
    setViewMode,
    statusTab,
    setStatusTab,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
  }), [filters, setFilter, toggleFilter, removeFilter, clearFilters, activeFilterCount, page, setPage, viewMode, statusTab, sortBy, searchQuery]);

  return (
    <QuestoesContext.Provider value={value}>
      {children}
    </QuestoesContext.Provider>
  );
}
