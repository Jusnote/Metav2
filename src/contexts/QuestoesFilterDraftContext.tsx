'use client';
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { EMPTY_FILTERS, searchParamsToFilters, filtersToSearchParams } from '@/lib/questoes/filter-serialization';

const STORAGE_KEY = 'questoes_filter_draft';

function loadDraft(): AppliedFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppliedFilters;
  } catch {
    return null;
  }
}

function saveDraft(filters: AppliedFilters): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // sessionStorage cheio — ignora
  }
}

function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}

export interface QuestoesFilterDraftValue {
  pendentes: AppliedFilters;
  aplicados: AppliedFilters;
  isDirty: boolean;
  setPendentes: (next: AppliedFilters) => void;
  apply: () => void;
  reset: () => void;
}

const QuestoesFilterDraftContext = createContext<QuestoesFilterDraftValue | null>(
  null,
);

export function useQuestoesFilterDraft(): QuestoesFilterDraftValue {
  const ctx = useContext(QuestoesFilterDraftContext);
  if (!ctx) {
    throw new Error(
      'useQuestoesFilterDraft must be used within QuestoesFilterDraftProvider',
    );
  }
  return ctx;
}

export function QuestoesFilterDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const aplicados = useMemo(
    () => searchParamsToFilters(searchParams),
    [searchParams],
  );

  const [pendentes, setPendentesState] = useState<AppliedFilters>(() => {
    // Se URL tem filtros (deep link), aplicados venceu → pendentes = aplicados, descarta draft
    // Senão tenta sessionStorage; senão fallback aplicados (= EMPTY_FILTERS)
    const aplicadosInicial = searchParamsToFilters(searchParams);
    const hasUrlFilters = filtersToSearchParams(aplicadosInicial).toString() !== '';
    if (hasUrlFilters) {
      clearDraft();
      return aplicadosInicial;
    }
    const stored = loadDraft();
    return stored ?? aplicadosInicial;
  });

  const setPendentes = useCallback((next: AppliedFilters) => {
    setPendentesState(next);
    saveDraft(next);
  }, []);

  const isDirty = useMemo(() => {
    const a = filtersToSearchParams(pendentes).toString();
    const b = filtersToSearchParams(aplicados).toString();
    const sortedA = a.split('&').sort().join('&');
    const sortedB = b.split('&').sort().join('&');
    return sortedA !== sortedB;
  }, [pendentes, aplicados]);

  const apply = useCallback(() => {
    const next = filtersToSearchParams(pendentes);
    const currentView = searchParams.get('view');
    if (currentView) {
      next.set('view', currentView);
    }
    setSearchParams(next, { replace: true });
    clearDraft();
  }, [pendentes, searchParams, setSearchParams]);

  const reset = useCallback(() => {
    setPendentesState(aplicados);
  }, [aplicados]);

  const value: QuestoesFilterDraftValue = {
    pendentes,
    aplicados,
    isDirty,
    setPendentes,
    apply,
    reset,
  };
  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
