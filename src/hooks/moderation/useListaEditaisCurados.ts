// src/hooks/moderation/useListaEditaisCurados.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export interface EditaisCuradosEntry {
  cargo_id: number
  edital_id: number
  status: 'draft' | 'published' | 'archived'
  generated_at: string
  last_validated_at: string
  published_at: string | null
  topicos_count: number
  decomposicao: EditalDecomposicao | null
}

async function fetchListaEditaisCurados(): Promise<EditaisCuradosEntry[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const res = await fetch('/api/admin/editais/curated-list', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  // Endpoint now returns a flat array (not wrapped in { items })
  return res.json()
}

export function useListaEditaisCurados() {
  return useQuery<EditaisCuradosEntry[], Error>({
    queryKey: ['editais-curados'],
    queryFn: fetchListaEditaisCurados,
    staleTime: 30_000,
  })
}
