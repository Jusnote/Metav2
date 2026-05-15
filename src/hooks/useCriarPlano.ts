import { useState } from 'react'
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

export interface CriarPlanoProgress {
  stage: 'sync' | 'archive' | 'map' | 'rpc'
  message: string
  done?: number
  total?: number
}

export class CriarPlanoError extends Error {
  constructor(public readonly status: number, public readonly raw: unknown, message: string) {
    super(message)
    this.name = 'CriarPlanoError'
  }
}

type StreamEvent =
  | ({ type: 'progress' } & CriarPlanoProgress)
  | ({ type: 'done' } & CriarPlanoResponse)
  | { type: 'error'; status: number; message: string; details?: unknown }

export function useCriarPlano() {
  const qc = useQueryClient()
  const [progress, setProgress] = useState<CriarPlanoProgress | null>(null)

  const mutation = useMutation<CriarPlanoResponse, CriarPlanoError, SetupPayload>({
    mutationFn: async (payload) => {
      setProgress(null)

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

      // Erros antes do stream (auth, payload, feature flag, rate limit) vêm como JSON
      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok && !ct.includes('ndjson')) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new CriarPlanoError(res.status, errJson, errJson?.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) {
        throw new CriarPlanoError(500, null, 'Resposta sem body — stream indisponível')
      }

      // Lê NDJSON do stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let final: CriarPlanoResponse | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            let event: StreamEvent
            try {
              event = JSON.parse(trimmed) as StreamEvent
            } catch {
              console.warn('[useCriarPlano] linha não-JSON do stream:', trimmed.slice(0, 200))
              continue
            }

            if (event.type === 'progress') {
              setProgress({
                stage: event.stage,
                message: event.message,
                done: event.done,
                total: event.total,
              })
            } else if (event.type === 'done') {
              final = {
                plano_id: event.plano_id,
                items_created: event.items_created,
                overflow_weeks: event.overflow_weeks,
                warnings: event.warnings as CriarPlanoResponse['warnings'],
                edital_synced: event.edital_synced,
                decomposicao_summary: event.decomposicao_summary,
              }
            } else if (event.type === 'error') {
              throw new CriarPlanoError(event.status, event.details, event.message)
            }
          }
        }
      } finally {
        try { reader.releaseLock() } catch { /* noop */ }
      }

      if (!final) {
        throw new CriarPlanoError(500, null, 'Stream terminou sem evento de conclusão')
      }
      return final
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plano-ativo'] })
      qc.invalidateQueries({ queryKey: ['cronograma'] })
      qc.invalidateQueries({ queryKey: ['weekly-stats'] })
    },
    onSettled: () => {
      // Mantém o último progress por ~500ms pra UI piscar suave; consumidor reseta on close
    },
  })

  return Object.assign(mutation, { progress })
}
