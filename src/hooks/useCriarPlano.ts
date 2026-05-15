import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { SetupPayload } from '@/lib/cronograma-v2/setup-payload'

export interface CriarPlanoResponse {
  plano_id: string
  items_created: number
  overflow_weeks: number
  warnings: Array<{ warning: string; msg: string; [k: string]: unknown }>
  edital_synced: boolean
  decomposicao_summary?: {
    ai_model: string
    total_topicos: number
    decomposed_count: number
    fallback_count: number
  }
}

export class CriarPlanoError extends Error {
  constructor(public readonly status: number, public readonly raw: unknown, message: string) {
    super(message)
    this.name = 'CriarPlanoError'
  }
}

export function useCriarPlano() {
  const qc = useQueryClient()

  return useMutation<CriarPlanoResponse, CriarPlanoError, SetupPayload>({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new CriarPlanoError(401, null, 'Não autenticado')
      }

      const res = await fetch('/api/cronograma/criar-plano', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({ error: 'Falha ao parsear resposta' }))

      if (!res.ok) {
        throw new CriarPlanoError(
          res.status,
          json,
          json?.error ?? `HTTP ${res.status}`,
        )
      }

      return json as CriarPlanoResponse
    },
    onSuccess: () => {
      // Invalida queries que dependem do plano ativo
      qc.invalidateQueries({ queryKey: ['plano-ativo'] })
      qc.invalidateQueries({ queryKey: ['cronograma'] })
      qc.invalidateQueries({ queryKey: ['weekly-stats'] })
    },
  })
}
