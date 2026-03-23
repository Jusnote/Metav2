import { useQuery } from 'urql'
import { useState, useEffect, useCallback, useRef } from 'react'
import { LEIS_QUERY, LEI_QUERY, DISPOSITIVOS_QUERY, BUSCA_QUERY } from '@/lib/lei-queries'
import type { Lei, Dispositivo, LeisConnection, DispositivosConnection, BuscaResult } from '@/types/lei-api'

// Hook: list all available laws
export function useLeis() {
  const [result] = useQuery<{ leis: LeisConnection }>({ query: LEIS_QUERY })
  return {
    leis: result.data?.leis.nodes ?? [],
    totalCount: result.data?.leis.totalCount ?? 0,
    isLoading: result.fetching,
    error: result.error,
  }
}

// Hook: single law metadata + hierarchy
export function useLei(id: string | null) {
  const [result] = useQuery<{ lei: Lei | null }>({
    query: LEI_QUERY,
    variables: { id },
    pause: !id,
  })
  return {
    lei: result.data?.lei ?? null,
    isLoading: result.fetching,
    error: result.error,
  }
}

// Hook: paginated dispositivos with manual accumulation
export function useDispositivos(leiId: string | null, incluirRevogados = false) {
  const [allDispositivos, setAll] = useState<Dispositivo[]>([])
  const [offset, setOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const prevLeiIdRef = useRef(leiId)
  const prevRevogadosRef = useRef(incluirRevogados)

  // Reset when lei or revogados filter changes
  useEffect(() => {
    if (leiId !== prevLeiIdRef.current || incluirRevogados !== prevRevogadosRef.current) {
      setAll([])
      setOffset(0)
      setTotalCount(0)
      prevLeiIdRef.current = leiId
      prevRevogadosRef.current = incluirRevogados
    }
  }, [leiId, incluirRevogados])

  const [result] = useQuery<{ dispositivos: DispositivosConnection }>({
    query: DISPOSITIVOS_QUERY,
    variables: { leiId, offset, limit: 100, incluirRevogados },
    pause: !leiId,
  })

  // Append new page to accumulated array
  useEffect(() => {
    if (result.data?.dispositivos) {
      const newNodes = result.data.dispositivos.nodes
      if (newNodes.length > 0) {
        setAll(prev => {
          // Avoid duplicates on re-render
          const existingIds = new Set(prev.map(d => d.id))
          const unique = newNodes.filter(n => !existingIds.has(n.id))
          return unique.length > 0 ? [...prev, ...unique] : prev
        })
        setTotalCount(result.data.dispositivos.totalCount)
      }
    }
  }, [result.data])

  const loadMore = useCallback(() => {
    if (!result.fetching && allDispositivos.length < totalCount) {
      setOffset(allDispositivos.length)
    }
  }, [result.fetching, allDispositivos.length, totalCount])

  const hasMore = allDispositivos.length < totalCount

  return {
    dispositivos: allDispositivos,
    totalCount,
    loadMore,
    hasMore,
    isLoading: result.fetching && allDispositivos.length === 0,
    isLoadingMore: result.fetching && allDispositivos.length > 0,
  }
}

// Hook: full-text search
// NOTE: Caller must debounce `termo` (500ms) before passing to this hook.
// ts_headline is CPU-intensive — firing on every keystroke will hammer the API.
export function useBusca(termo: string, leiId?: string) {
  const [result] = useQuery<{ busca: BuscaResult }>({
    query: BUSCA_QUERY,
    variables: { termo, leiId, limit: 50 },
    pause: termo.length < 2,
  })
  return {
    hits: result.data?.busca.hits ?? [],
    total: result.data?.busca.total ?? 0,
    isSearching: result.fetching,
    error: result.error,
  }
}
