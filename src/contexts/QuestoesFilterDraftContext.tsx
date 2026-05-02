'use client';
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { EMPTY_FILTERS, searchParamsToFilters } from '@/lib/questoes/filter-serialization';

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
  const [searchParams] = useSearchParams();

  const aplicados = useMemo(
    () => searchParamsToFilters(searchParams),
    [searchParams],
  );

  const [pendentes, setPendentesState] = useState<AppliedFilters>(aplicados);

  const setPendentes = useCallback((next: AppliedFilters) => {
    setPendentesState(next);
  }, []);

  const value: QuestoesFilterDraftValue = {
    pendentes,
    aplicados,
    isDirty: false,
    setPendentes,
    apply: () => {},
    reset: () => {},
  };
  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
