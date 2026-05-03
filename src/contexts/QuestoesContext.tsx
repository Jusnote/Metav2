"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, startTransition } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

// ============ TIPOS ============

/**
 * Shape consumido por useQuestoesV2 (lista de questões).
 *
 * Este tipo é mantido pra compatibilidade com a API de busca; o estado
 * canônico de filtros vive em `QuestoesFilterDraftContext` (URL como
 * source of truth). A conversão é feita por `appliedToQuestoesFilters`.
 */
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
  nodeIds: (number | 'outros')[];
}

export type ViewMode = 'lista' | 'individual';
export type StatusTab = 'todas' | 'nao_resolvidas' | 'erradas' | 'marcadas';
export type SortOption = 'recentes' | 'dificuldade' | 'menos_resolvidas' | 'relevancia';

export interface QuestoesContextValue {
  // Search query (busca semântica) — separada de filtros
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  committedQuery: string;
  /** Commita a query atual (semantic search) — copia draft → committed. */
  triggerSearch: () => void;

  // Pagination
  page: number;
  setPage: (p: number) => void;

  // View state (não-filtro)
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  statusTab: StatusTab;
  setStatusTab: (t: StatusTab) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
}

// ============ URL SYNC HELPERS ============

function paramsFromState(extra: {
  searchQuery?: string;
  statusTab?: StatusTab;
  sortBy?: SortOption;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (extra.searchQuery) params.set('q', extra.searchQuery);
  if (extra.statusTab && extra.statusTab !== 'todas') params.set('tab', extra.statusTab);
  if (extra.sortBy && extra.sortBy !== 'recentes') params.set('sort', extra.sortBy);
  return params;
}

function stateFromParams(params: URLSearchParams): {
  searchQuery: string;
  statusTab: StatusTab;
  sortBy: SortOption;
} {
  return {
    searchQuery: params.get('q') || '',
    statusTab: (params.get('tab') as StatusTab) || 'todas',
    sortBy: (params.get('sort') as SortOption) || 'recentes',
  };
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

  const initial = stateFromParams(searchParams);

  const [searchQuery, setSearchQuery] = useState(initial.searchQuery);
  const [committedQuery, setCommittedQuery] = useState(initial.searchQuery);
  const [statusTab, setStatusTab] = useState<StatusTab>(initial.statusTab);
  const [sortBy, setSortBy] = useState<SortOption>(initial.sortBy);
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [page, setPageRaw] = useState(1);

  const triggerSearch = useCallback(() => {
    startTransition(() => {
      setCommittedQuery(searchQuery);
      setPageRaw(1);
    });
  }, [searchQuery]);

  // Reset page to 1 when committed query, tab ou sort mudam
  const prevCommittedQueryRef = useRef(committedQuery);
  const prevTabRef = useRef(statusTab);
  const prevSortRef = useRef(sortBy);
  useEffect(() => {
    if (
      prevCommittedQueryRef.current !== committedQuery ||
      prevTabRef.current !== statusTab ||
      prevSortRef.current !== sortBy
    ) {
      setPageRaw(1);
      prevCommittedQueryRef.current = committedQuery;
      prevTabRef.current = statusTab;
      prevSortRef.current = sortBy;
    }
  }, [committedQuery, statusTab, sortBy]);

  const setPage = useCallback((p: number) => setPageRaw(p), []);

  // Sync committed state → URL (somente q/tab/sort; filtros são geridos
  // pelo QuestoesFilterDraftContext). Preserva params que não são nossos.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      // Limpa nossas chaves antes de re-setar
      next.delete('q');
      next.delete('tab');
      next.delete('sort');
      const ours = paramsFromState({ searchQuery: committedQuery, statusTab, sortBy });
      ours.forEach((value, key) => next.set(key, value));
      setSearchParams(next, { replace: true });
    }, 150);

    return () => clearTimeout(timer);
  }, [committedQuery, statusTab, sortBy, setSearchParams, searchParams]);

  const value = useMemo<QuestoesContextValue>(() => ({
    searchQuery,
    setSearchQuery,
    committedQuery,
    triggerSearch,
    page,
    setPage,
    viewMode,
    setViewMode,
    statusTab,
    setStatusTab,
    sortBy,
    setSortBy,
  }), [searchQuery, committedQuery, triggerSearch, page, setPage, viewMode, statusTab, sortBy]);

  return (
    <QuestoesContext.Provider value={value}>
      {children}
    </QuestoesContext.Provider>
  );
}
