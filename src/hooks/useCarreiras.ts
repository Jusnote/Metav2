// src/hooks/useCarreiras.ts
//
// Fase 1A: fonte = mock estático em `@/data/carreiras-mock`.
// Fase 1B: mesma API, mas `queryFn` passa a bater no Supabase.
// Componentes consumidores não mudam entre fases.

'use client';

import { useQuery } from '@tanstack/react-query';
import { MOCK_CARREIRAS } from '@/data/carreiras-mock';
import type { Area, Carreira } from '@/types/carreira';

export function useCarreiras(area?: Area) {
  return useQuery({
    queryKey: ['carreiras', 'ativas', area ?? 'todas'],
    queryFn: async () => {
      let list = MOCK_CARREIRAS.filter((c) => c.ativa);
      if (area) list = list.filter((c) => c.area === area);
      return [...list].sort(
        (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
      ) as Carreira[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAreaCounts() {
  return useQuery({
    queryKey: ['carreiras', 'area-counts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const c of MOCK_CARREIRAS) {
        if (!c.ativa) continue;
        counts[c.area] = (counts[c.area] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });
}
