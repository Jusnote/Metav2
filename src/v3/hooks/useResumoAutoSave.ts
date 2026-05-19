'use client'

// Auto-save de resumo (Plate doc → server action) com debounce.
// Pattern: chame `agendar(novoValor)` a cada onChange; o hook agenda salvar
// 5s depois da última chamada. Indica status saving/saved/error.

import { useCallback, useEffect, useRef, useState } from 'react'
import { salvarRascunhoResumo } from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseResumoAutoSaveOptions {
  subtopicoId: string
  debounceMs?: number
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
}: UseResumoAutoSaveOptions): UseResumoAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoValorRef = useRef<unknown>(null)
  const desmontadoRef = useRef(false)

  // Salva imediato (usado por blur / beforeunload / botão "Salvar agora")
  const salvarAgora = useCallback(
    async (valor: unknown) => {
      if (desmontadoRef.current) return
      setStatus('saving')
      setError(null)
      const res = await salvarRascunhoResumo({
        subtopicoId,
        conteudoPlate: valor,
      })
      if (desmontadoRef.current) return
      if (res.ok) {
        setStatus('saved')
        // Volta pra 'idle' depois de 2s pra UI ficar "limpa"
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

  // Salvar pendente antes de fechar a janela / trocar de aba
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
