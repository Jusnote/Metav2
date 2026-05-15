import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EditalGraphQL } from '@/lib/cronograma-v2/schemas'

export interface SyncEditalResponse {
  cacheHit: boolean
  decomposicao: {
    by_topico: Record<string, {
      nome_curto: string
      conceitos_pai: string[]
      subtopicos: Array<{ nome: string; duracao_min: number; conceito_pai: string }>
      referencias_legais: string[]
    }>
    metadata: {
      ai_model: string
      decomposed_at: string
      total_topicos: number
      decomposed_count: number
      fallback_count: number
    }
  }
  payload_hash: string
  decomposed_topicos: number
  fallback_topicos: number
  total_topicos: number
}

export function useSyncEdital() {
  return useMutation<SyncEditalResponse, Error, { edital: EditalGraphQL; forceRefresh?: boolean }>({
    mutationFn: async ({ edital, forceRefresh = false }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const res = await fetch('/api/cronograma-v2/sync-edital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ edital_payload: edital, force_refresh: forceRefresh }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha desconhecida' }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      return res.json()
    },
  })
}
