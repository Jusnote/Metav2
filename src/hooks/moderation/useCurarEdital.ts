// src/hooks/moderation/useCurarEdital.ts
// Mirrors useCriarPlano.ts: NDJSON ReadableStream reader, exposes `progress` state.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EditalGraphQL } from '@/lib/cronograma-v2/schemas'

export interface CurarEditalProgress {
  stage: 'sync'
  message: string
  done?: number
  total?: number
}

export interface CurarEditalResult {
  cargo_id: number
  edital_id: number
  decomposed_topicos: number
  fallback_topicos: number
  total_topicos: number
  status: 'draft'
}

export class CurarEditalError extends Error {
  constructor(public readonly status: number, public readonly raw: unknown, message: string) {
    super(message)
    this.name = 'CurarEditalError'
  }
}

type StreamEvent =
  | ({ type: 'progress' } & CurarEditalProgress)
  | ({ type: 'done' } & CurarEditalResult)
  | { type: 'error'; message: string }

export function useCurarEdital() {
  const [progress, setProgress] = useState<CurarEditalProgress | null>(null)

  const mutation = useMutation<CurarEditalResult, CurarEditalError, EditalGraphQL>({
    mutationFn: async (payload) => {
      setProgress(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new CurarEditalError(401, null, 'Não autenticado')
      }

      const res = await fetch('/api/admin/editais/curate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      // Pre-stream errors (auth, payload, 403) come as JSON
      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok && !ct.includes('ndjson')) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new CurarEditalError(res.status, errJson, errJson?.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) {
        throw new CurarEditalError(500, null, 'Resposta sem body — stream indisponível')
      }

      // Read NDJSON stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let final: CurarEditalResult | null = null

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
              console.warn('[useCurarEdital] linha não-JSON:', trimmed.slice(0, 200))
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
                cargo_id: event.cargo_id,
                edital_id: event.edital_id,
                decomposed_topicos: event.decomposed_topicos,
                fallback_topicos: event.fallback_topicos,
                total_topicos: event.total_topicos,
                status: 'draft',
              }
            } else if (event.type === 'error') {
              throw new CurarEditalError(500, null, event.message)
            }
          }
        }
      } finally {
        try { reader.releaseLock() } catch { /* noop */ }
      }

      if (!final) {
        throw new CurarEditalError(500, null, 'Stream terminou sem evento de conclusão')
      }
      return final
    },
  })

  return Object.assign(mutation, { progress })
}
