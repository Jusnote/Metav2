'use client'

// Auto-save de resumo (Plate doc + tldr + takeaways → server action) com debounce.
// Pattern: chame `agendar(novoValor)` a cada onChange; o hook agenda salvar
// 5s depois da última chamada. Indica status saving/saved/error.
//
// Extras (tldr, takeaways) são lidos via callback no momento do save, pra
// sempre pegar o estado mais recente do componente.

import { useCallback, useEffect, useRef, useState } from 'react'
import { salvarRascunhoResumo } from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface ResumoExtras {
  tldr?: string | null
  takeaways?: string[]
}

interface UseResumoAutoSaveOptions {
  subtopicoId: string
  debounceMs?: number
  /** Callback chamado no momento do save pra obter tldr/takeaways atuais. */
  getExtras?: () => ResumoExtras
}

interface UseResumoAutoSaveReturn {
  status: AutoSaveStatus
  error: string | null
  agendar: (valor: unknown) => void
  salvarAgora: (valor: unknown) => Promise<void>
  cancelar: () => void
}

export function useResumoAutoSave({
  subtopicoId,
  debounceMs = 5000,
  getExtras,
}: UseResumoAutoSaveOptions): UseResumoAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoValorRef = useRef<unknown>(null)
  const desmontadoRef = useRef(false)
  const getExtrasRef = useRef(getExtras)

  useEffect(() => {
    getExtrasRef.current = getExtras
  }, [getExtras])

  const salvarAgora = useCallback(
    async (valor: unknown) => {
      if (desmontadoRef.current) return
      setStatus('saving')
      setError(null)
      const extras = getExtrasRef.current?.() ?? {}
      const res = await salvarRascunhoResumo({
        subtopicoId,
        conteudoPlate: valor,
        tldr: extras.tldr,
        takeaways: extras.takeaways,
      })
      if (desmontadoRef.current) return
      if (res.ok) {
        setStatus('saved')
        setTimeout(() => {
          if (!desmontadoRef.current) setStatus('idle')
        }, 2000)
      } else {
        setStatus('error')
        setError(res.erro)
      }
    },
    [subtopicoId],
  )

  const cancelar = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const agendar = useCallback(
    (valor: unknown) => {
      ultimoValorRef.current = valor
      cancelar()
      timerRef.current = setTimeout(() => {
        void salvarAgora(valor)
      }, debounceMs)
    },
    [cancelar, debounceMs, salvarAgora],
  )

  useEffect(() => {
    const handler = () => {
      if (timerRef.current && ultimoValorRef.current !== null) {
        cancelar()
        void salvarAgora(ultimoValorRef.current)
      }
    }
    window.addEventListener('beforeunload', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [cancelar, salvarAgora])

  useEffect(() => {
    return () => {
      desmontadoRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { status, error, agendar, salvarAgora, cancelar }
}
