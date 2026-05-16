import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { editaisQuery } from '@/lib/editais-client'
import { useListaEditaisCurados } from './useListaEditaisCurados'

const CARGOS_ALL_QUERY = `
  query CargosAll($pagina: Int!, $porPagina: Int!) {
    editais(filtro: { ativo: true }, pagina: $pagina, porPagina: $porPagina) {
      dados { id nome }
    }
  }
`

const CARGOS_BY_EDITAL = `
  query CargosByEdital($editalId: Int!) {
    cargos(editalId: $editalId) { id nome }
  }
`

export interface CargoCurado {
  cargoId: number
  cargoNome: string
  editalId: number
  editalNome: string
  status: 'no_cache' | 'draft' | 'published' | 'archived'
  lastValidatedAt: string | null
  topicosCount: number
}

export function useCargosCurados() {
  const cacheList = useListaEditaisCurados()

  const cargosQuery = useQuery({
    queryKey: ['curadoria-cargos-all'],
    queryFn: async () => {
      const { data: ld } = await editaisQuery<{
        editais: { dados: Array<{ id: number; nome: string }> }
      }>(CARGOS_ALL_QUERY, { pagina: 1, porPagina: 200 })
      const editais = ld?.editais?.dados ?? []
      const all = await Promise.all(
        editais.map(async (e) => {
          const { data: cd } = await editaisQuery<{ cargos: Array<{ id: number; nome: string }> }>(
            CARGOS_BY_EDITAL, { editalId: e.id },
          )
          return (cd?.cargos ?? []).map((c) => ({
            cargoId: c.id, cargoNome: c.nome, editalId: e.id, editalNome: e.nome,
          }))
        }),
      )
      return all.flat()
    },
    staleTime: 30 * 60 * 1000,
  })

  return useMemo<{ items: CargoCurado[]; isLoading: boolean; error: Error | null }>(() => {
    const items: CargoCurado[] = (cargosQuery.data ?? []).map((c) => {
      const cached = cacheList.data?.find(
        (x) => x.cargo_id === c.cargoId && x.edital_id === c.editalId,
      )
      return {
        ...c,
        status: (cached?.status ?? 'no_cache') as CargoCurado['status'],
        lastValidatedAt: cached?.last_validated_at ?? null,
        topicosCount: cached?.topicos_count ?? 0,
      }
    })
    return {
      items,
      isLoading: cargosQuery.isLoading || cacheList.isLoading,
      error: (cargosQuery.error ?? cacheList.error) as Error | null,
    }
  }, [cargosQuery.data, cargosQuery.isLoading, cargosQuery.error, cacheList.data, cacheList.isLoading, cacheList.error])
}
