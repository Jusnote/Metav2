import { useQuery } from 'urql'
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

// Hook: load ALL dispositivos at once (API MAX_LIMIT=10000, protected by rate limiting)
export function useDispositivos(leiId: string | null, incluirRevogados = false) {
  const [result] = useQuery<{ dispositivos: DispositivosConnection }>({
    query: DISPOSITIVOS_QUERY,
    variables: { leiId, offset: 0, limit: 10000, incluirRevogados },
    pause: !leiId,
  })

  return {
    dispositivos: result.data?.dispositivos.nodes ?? [],
    totalCount: result.data?.dispositivos.totalCount ?? 0,
    isLoading: result.fetching,
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
