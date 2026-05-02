'use client';
import React, { createContext, useContext } from 'react';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

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
  // Stub mínimo. Implementação real virá nas próximas tasks (6-12).
  const value: QuestoesFilterDraftValue = {
    pendentes: EMPTY_FILTERS,
    aplicados: EMPTY_FILTERS,
    isDirty: false,
    setPendentes: () => {},
    apply: () => {},
    reset: () => {},
  };
  return (
    <QuestoesFilterDraftContext.Provider value={value}>
      {children}
    </QuestoesFilterDraftContext.Provider>
  );
}
