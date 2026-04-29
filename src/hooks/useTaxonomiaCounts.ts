import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export type CountsBody = {
  banca?: string[];
  ano?: number[];
  tipo?: string[];
  excluir_anuladas?: boolean;
  excluir_desatualizadas?: boolean;
};

const stableKey = (body: CountsBody) => JSON.stringify(body, Object.keys(body).sort());

async function fetchCounts(slug: string, body: CountsBody): Promise<Record<string, number>> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taxonomia/${slug}/counts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error('Falha ao buscar counts');
  return res.json();
}

export function useTaxonomiaCounts(slug: string | null, body: CountsBody, enabled: boolean) {
  const key = body && stableKey(body);
  return useQuery<Record<string, number>>({
    queryKey: ['taxonomia-counts', slug, key],
    queryFn: () => fetchCounts(slug!, body),
    enabled: enabled && !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaxonomiaCountsPrefetch(slug: string | null, body: CountsBody, enabled: boolean) {
  const qc = useQueryClient();
  const key = body && stableKey(body);
  useEffect(() => {
    if (!enabled || !slug) return;
    qc.prefetchQuery({
      queryKey: ['taxonomia-counts', slug, key],
      queryFn: () => fetchCounts(slug, body),
      staleTime: 5 * 60 * 1000,
    });
  }, [qc, slug, key, enabled, body]);
}
