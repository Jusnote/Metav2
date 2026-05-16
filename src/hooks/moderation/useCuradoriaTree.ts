import { useQuery } from '@tanstack/react-query'
import { editaisQuery } from '@/lib/editais-client'
import { supabase } from '@/integrations/supabase/client'
import {
  editalDecomposicaoSchema,
  type EditalDecomposicao,
  type SubtopicoDecomposed,
} from '@/lib/cronograma-v2/schemas'
import type { ApiDisciplina, ApiTopico } from '@/hooks/useEditaisData'

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id fonteId nome nomeEdital totalTopicos }
  }
`

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id fonteId nome ordem }
  }
`

export interface CuradoriaTreeNode {
  disciplinaId: number
  disciplinaNome: string
  topicos: Array<{
    topicoId: number
    topicoNome: string
    subtopicos: SubtopicoDecomposed[]   // do cache; vazio se nada curado ainda
  }>
}

export interface UseCuradoriaTreeResult {
  tree: CuradoriaTreeNode[]
  decomposicao: EditalDecomposicao | null
  status: 'no_cache' | 'draft' | 'published' | 'archived'
  cargoNome: string
  editalNome: string
  isLoading: boolean
  error: Error | null
}

export function useCuradoriaTree(
  cargoId: number | null,
  editalId: number | null,
  cargoNome: string | null,
  editalNome: string | null,
): UseCuradoriaTreeResult {
  // 1. Cache row (status + decomposicao)
  const cacheQuery = useQuery({
    queryKey: ['edital-cache-row', cargoId, editalId],
    queryFn: async () => {
      if (!cargoId || !editalId) return null
      const { data } = await supabase
        .from('edital_cache')
        .select('status, decomposicao, published_at')
        .eq('cargo_id', cargoId)
        .eq('edital_id', editalId)
        .maybeSingle()
      return data
    },
    enabled: !!cargoId && !!editalId,
    staleTime: 10_000,
  })

  // 2. GraphQL disciplinas + topicos (N+1 intentional for MVP)
  const graphQuery = useQuery({
    queryKey: ['curadoria-graph', cargoId],
    queryFn: async () => {
      if (!cargoId) return { disciplinas: [], topicos: [] as ApiTopico[] }
      const { data: dd } = await editaisQuery<{ disciplinas: ApiDisciplina[] }>(
        DISCIPLINAS_QUERY, { cargoId },
      )
      const disciplinas = dd?.disciplinas ?? []
      const topicosArrays = await Promise.all(
        disciplinas.map(async (d) => {
          const { data: td } = await editaisQuery<{ topicos: ApiTopico[] }>(
            TOPICOS_QUERY, { disciplinaId: d.id },
          )
          return (td?.topicos ?? []).map((t) => ({ ...t, disciplina_id: d.id }))
        }),
      )
      return { disciplinas, topicos: topicosArrays.flat() }
    },
    enabled: !!cargoId,
    staleTime: 5 * 60 * 1000,
  })

  // 3. Merge
  const decomposicao = cacheQuery.data?.decomposicao
    ? editalDecomposicaoSchema.safeParse(cacheQuery.data.decomposicao).data ?? null
    : null

  const tree: CuradoriaTreeNode[] = (graphQuery.data?.disciplinas ?? []).map((d) => {
    const topicos = (graphQuery.data?.topicos ?? [])
      .filter((t) => Number(t.disciplina_id) === d.id)
      .map((t) => {
        const decomp = decomposicao?.by_topico[String(t.id)]
        return {
          topicoId: t.id,
          topicoNome: t.nome,
          subtopicos: decomp?.subtopicos ?? [],
        }
      })
    return { disciplinaId: d.id, disciplinaNome: d.nome, topicos }
  })

  const status = cacheQuery.data?.status as UseCuradoriaTreeResult['status'] ?? 'no_cache'

  return {
    tree,
    decomposicao,
    status,
    cargoNome: cargoNome ?? '',
    editalNome: editalNome ?? '',
    isLoading: cacheQuery.isLoading || graphQuery.isLoading,
    error: (cacheQuery.error ?? graphQuery.error) as Error | null,
  }
}
