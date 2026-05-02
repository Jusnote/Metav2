'use client';
import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { EMPTY_FILTERS, searchParamsToFilters, filtersToSearchParams } from '@/lib/questoes/filter-serialization';

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

  const [pendentes, setPendentesState] = useState<AppliedFilters>(aplicados);

  const setPendentes = useCallback((next: AppliedFilters) => {
    setPendentesState(next);
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
  }, [pendentes, searchParams, setSearchParams]);

  const value: QuestoesFilterDraftValue = {
    pendentes,
    aplicados,
    isDirty,
    setPendentes,
    apply,
    reset: () => {},
  };
  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
