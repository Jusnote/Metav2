'use client';

import { useQuery } from '@tanstack/react-query';

// TODO: Replace stub with actual FastAPI call once the incidencia endpoint is ready.
// The endpoint should return a map of dispositivo_id → incidence count for a given lei.

export function useLeiIncidencia(leiId: string | undefined) {
  return useQuery({
    queryKey: ['lei-incidencia', leiId],
    queryFn: async (): Promise<Record<string, number>> => {
      // Stub — FastAPI endpoint not ready yet.
      // Will be replaced with: fetch(`${FASTAPI_URL}/incidencia/${leiId}`)
      return {};
    },
    enabled: !!leiId,
    staleTime: 5 * 60 * 1000,
  });
}
