import { useQuery } from '@tanstack/react-query'
import { editaisQuery } from '@/lib/editais-client'
import type { ApiDisciplina, ApiTopico } from './useEditaisData'

// ---- GraphQL queries ----

const EDITAIS_LIST_QUERY = `
  query EditaisListForCargoMatch($pagina: Int!, $porPagina: Int!) {
    editais(filtro: { ativo: true }, pagina: $pagina, porPagina: $porPagina) {
      dados { id nome }
      paginacao { totalPaginas }
    }
  }
`

const CARGOS_BY_EDITAL_QUERY = `
  query CargosByEdital($editalId: Int!) {
    cargos(editalId: $editalId) { id nome }
  }
`

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

// ---- Types ----

export interface CargoEditalMatch {
  cargoId: number
  cargoNome: string
  editalId: number
  editalNome: string
  disciplinas: Array<{ id: number; nome: string }>
  /** Tópicos achatados em uma lista, com referência à disciplina */
  topicos: Array<{ id: number; disciplina_id: number; nome: string }>
}

export interface UseCargoEditalResult {
  data: CargoEditalMatch | null
  isLoading: boolean
  error: Error | null
  /** True quando GraphQL respondeu mas nenhum cargo bate com o nome. */
  notFound: boolean
}

// ---- Normalizer ----

/**
 * Normaliza nome pra match: lowercase, sem acentos, sem separadores comuns.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[·\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- Match helper ----

function findCargoMatch(
  editais: Array<{ id: number; nome: string; cargos: Array<{ id: number; nome: string }> }>,
  nomeCargo: string,
): { cargoId: number; cargoNome: string; editalId: number; editalNome: string } | null {
  const target = normalize(nomeCargo)

  // 1. Exact match (normalized)
  for (const ed of editais) {
    for (const cg of ed.cargos) {
      if (normalize(cg.nome) === target) {
        return { cargoId: cg.id, cargoNome: cg.nome, editalId: ed.id, editalNome: ed.nome }
      }
    }
  }

  // 2. Substring match
  for (const ed of editais) {
    for (const cg of ed.cargos) {
      const n = normalize(cg.nome)
      if (n.includes(target) || target.includes(n)) {
        return { cargoId: cg.id, cargoNome: cg.nome, editalId: ed.id, editalNome: ed.nome }
      }
    }
  }

  return null
}

// ---- Hook ----

/**
 * Mapeia `Carreira.nome` local → cargo na API GraphQL (match exato + substring),
 * depois baixa disciplinas e tópicos.
 *
 * Estratégia de fetch:
 *   1. Busca todos os editais ativos (paginado, até 200 por página)
 *   2. Para cada edital, busca `cargos(editalId)` em paralelo
 *   3. Encontrado o match, busca disciplinas + tópicos em paralelo
 *
 * Quando `nomeCargo` é null/empty, hook fica desabilitado.
 */
export function useCargoEdital(nomeCargo: string | null | undefined): UseCargoEditalResult {
  // Step 1: fetch all editais with their cargos
  const editaisComCargos = useQuery({
    queryKey: ['cargos-global-with-editais'],
    queryFn: async () => {
      // Fetch editais list (first page, 200 per page — assume no more)
      const { data: listData, error: listError } = await editaisQuery<{
        editais: {
          dados: Array<{ id: number; nome: string }>
          paginacao: { totalPaginas: number }
        }
      }>(EDITAIS_LIST_QUERY, { pagina: 1, porPagina: 200 })

      if (listError || !listData?.editais?.dados) {
        throw new Error(listError ?? 'Falha ao carregar editais')
      }

      const editalList = listData.editais.dados

      // Fetch cargos for each edital in parallel
      const results = await Promise.all(
        editalList.map(async (ed) => {
          const { data: cargosData } = await editaisQuery<{
            cargos: Array<{ id: number; nome: string }>
          }>(CARGOS_BY_EDITAL_QUERY, { editalId: ed.id })

          return {
            id: ed.id,
            nome: ed.nome,
            cargos: cargosData?.cargos ?? [],
          }
        }),
      )

      return results
    },
    staleTime: 30 * 60 * 1000, // 30 min
    gcTime: 60 * 60 * 1000,    // 1 hour
    enabled: !!nomeCargo,
  })

  // Step 2: find match
  const match = nomeCargo
    ? findCargoMatch(editaisComCargos.data ?? [], nomeCargo)
    : null

  const cargoId = match?.cargoId ?? null

  // Step 3: fetch disciplinas + topicos for matched cargo
  const composedQuery = useQuery({
    queryKey: ['cargo-edital-composed', cargoId],
    queryFn: async () => {
      if (!cargoId || !match) return null

      const { data: discData, error: discError } = await editaisQuery<{
        disciplinas: ApiDisciplina[]
      }>(DISCIPLINAS_QUERY, { cargoId })

      if (discError) throw new Error(discError)

      const disciplinas = discData?.disciplinas ?? []

      // Fetch topicos for each disciplina in parallel
      const topicosByDisciplina = await Promise.all(
        disciplinas.map(async (d) => {
          const { data: topData } = await editaisQuery<{ topicos: ApiTopico[] }>(
            TOPICOS_QUERY,
            { disciplinaId: d.id },
          )
          return (topData?.topicos ?? []).map((t) => ({
            id: t.id,
            disciplina_id: d.id,
            nome: t.nome,
          }))
        }),
      )
      const topicos = topicosByDisciplina.flat()

      return {
        cargoId: match.cargoId,
        cargoNome: match.cargoNome,
        editalId: match.editalId,
        editalNome: match.editalNome,
        disciplinas: disciplinas.map((d) => ({ id: d.id, nome: d.nome })),
        topicos,
      } satisfies CargoEditalMatch
    },
    enabled: !!cargoId,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  return {
    data: composedQuery.data ?? null,
    isLoading: editaisComCargos.isLoading || composedQuery.isLoading,
    error: (editaisComCargos.error ?? composedQuery.error) as Error | null,
    notFound: !editaisComCargos.isLoading && !!nomeCargo && !!editaisComCargos.data && match === null,
  }
}
