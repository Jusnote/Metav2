// src/hooks/moderation/useEditaisAdmin.ts
import { useState, useCallback } from 'react'
import { editaisQuery, editaisMutation } from '@/lib/editais-client'

// ---- Types ----

export interface AdminEdital {
  id: number
  nome: string
  sigla: string | null
  esfera: string | null
  tipo: string | null
  ativo: boolean
  destaque: boolean
  totalCargos: number
  totalDisciplinas: number
  totalTopicos: number
}

export interface AdminCargo {
  id: number
  nome: string
  vagas: number | null
  remuneracao: number | null
  qtdDisciplinas: number | null
  qtdTopicos: number | null
  ativo: boolean
  dataProva: string | null
}

export interface AdminDisciplina {
  id: number
  nome: string
  nomeEdital: string | null
  totalTopicos: number
  ativo: boolean
}

export interface AdminTopico {
  id: number
  nome: string
  ordem: number
  ativo: boolean
}

export interface AdminLogEntry {
  id: number
  actorId: string
  targetType: string
  targetId: number
  action: string
  details: string | null
  criadoEm: string
}

export type HierarchyLevel = 'editais' | 'cargos' | 'disciplinas' | 'topicos'

export interface BreadcrumbItem {
  id: number
  nome: string
  tipo: HierarchyLevel
}

interface MutationResult {
  success: boolean
  message: string | null
  id: number | null
}

interface BulkResult {
  success: boolean
  affected: number
}

// ---- Queries ----

const EDITAIS_ADMIN_QUERY = `
  query EditaisAdmin($filtro: EditalFiltro, $pagina: Int, $porPagina: Int) {
    editais(filtro: $filtro, pagina: $pagina, porPagina: $porPagina) {
      dados {
        id nome sigla esfera tipo ativo destaque totalCargos totalDisciplinas totalTopicos
      }
      paginacao { total pagina porPagina totalPaginas }
    }
  }
`

// For admin, we need ativo field — extend the edital query
const EDITAL_FULL_QUERY = `
  query EditalFull($id: Int!) {
    edital(id: $id) {
      id nome sigla esfera tipo descricao dataPublicacao dataEncerramento
      dataInicioInscricao dataFimInscricao link cidade previsto cancelado
      autorizado ativo destaque totalCargos totalDisciplinas totalTopicos
      cargos { id nome vagas remuneracao qtdDisciplinas qtdTopicos ativo dataProva }
    }
  }
`

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id nome nomeEdital totalTopicos }
  }
`

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id nome ordem }
  }
`

const ADMIN_LOG_QUERY = `
  query AdminLog($targetType: String!, $targetId: Int!) {
    adminLog(targetType: $targetType, targetId: $targetId) {
      id actorId targetType targetId action details criadoEm
    }
  }
`

// ---- Mutations ----

const CRIAR_EDITAL = `mutation CriarEdital($input: EditalInput!) { criarEdital(input: $input) { success message id } }`
const ATUALIZAR_EDITAL = `mutation AtualizarEdital($id: Int!, $input: EditalInput!) { atualizarEdital(id: $id, input: $input) { success message id } }`
const DELETAR_EDITAL = `mutation DeletarEdital($id: Int!) { deletarEdital(id: $id) { success message } }`

const CRIAR_CARGO = `mutation CriarCargo($editalId: Int!, $input: CargoInput!) { criarCargo(editalId: $editalId, input: $input) { success message id } }`
const ATUALIZAR_CARGO = `mutation AtualizarCargo($id: Int!, $input: CargoInput!) { atualizarCargo(id: $id, input: $input) { success message id } }`
const DELETAR_CARGO = `mutation DeletarCargo($id: Int!) { deletarCargo(id: $id) { success message } }`

const CRIAR_DISCIPLINA = `mutation CriarDisciplina($cargoId: Int!, $input: DisciplinaInput!) { criarDisciplina(cargoId: $cargoId, input: $input) { success message id } }`
const ATUALIZAR_DISCIPLINA = `mutation AtualizarDisciplina($id: Int!, $input: DisciplinaInput!) { atualizarDisciplina(id: $id, input: $input) { success message id } }`
const DELETAR_DISCIPLINA = `mutation DeletarDisciplina($id: Int!) { deletarDisciplina(id: $id) { success message } }`

const CRIAR_TOPICO = `mutation CriarTopico($disciplinaId: Int!, $input: TopicoInput!) { criarTopico(disciplinaId: $disciplinaId, input: $input) { success message id } }`
const ATUALIZAR_TOPICO = `mutation AtualizarTopico($id: Int!, $input: TopicoInput!) { atualizarTopico(id: $id, input: $input) { success message id } }`
const DELETAR_TOPICO = `mutation DeletarTopico($id: Int!) { deletarTopico(id: $id) { success message } }`
const REORDENAR_TOPICOS = `mutation ReordenarTopicos($disciplinaId: Int!, $topicoIds: [Int!]!) { reordenarTopicos(disciplinaId: $disciplinaId, topicoIds: $topicoIds) { success message } }`

const BULK_ATIVAR = `mutation BulkAtivar($tipo: String!, $ids: [Int!]!, $ativo: Boolean!) { bulkAtivar(tipo: $tipo, ids: $ids, ativo: $ativo) { success affected } }`
const BULK_DELETAR = `mutation BulkDeletar($tipo: String!, $ids: [Int!]!) { bulkDeletar(tipo: $tipo, ids: $ids) { success affected } }`

// ---- Hook ----

export function useEditaisAdmin() {
  const [refreshKey, setRefreshKey] = useState(0)
  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  // --- Fetch lists ---

  async function fetchEditais(filtro?: Record<string, unknown>, pagina = 1, porPagina = 20) {
    const result = await editaisQuery<any>(EDITAIS_ADMIN_QUERY, { filtro, pagina, porPagina })
    return result.data?.editais ?? { dados: [], paginacao: null }
  }

  async function fetchEditalFull(id: number) {
    const result = await editaisQuery<any>(EDITAL_FULL_QUERY, { id })
    return result.data?.edital ?? null
  }

  async function fetchCargos(editalId: number): Promise<AdminCargo[]> {
    const result = await editaisQuery<any>(EDITAL_FULL_QUERY, { id: editalId })
    return result.data?.edital?.cargos ?? []
  }

  async function fetchDisciplinas(cargoId: number): Promise<AdminDisciplina[]> {
    const result = await editaisQuery<any>(DISCIPLINAS_QUERY, { cargoId })
    return result.data?.disciplinas ?? []
  }

  async function fetchTopicos(disciplinaId: number): Promise<AdminTopico[]> {
    const result = await editaisQuery<any>(TOPICOS_QUERY, { disciplinaId })
    return result.data?.topicos ?? []
  }

  async function fetchAdminLog(targetType: string, targetId: number): Promise<AdminLogEntry[]> {
    const result = await editaisQuery<any>(ADMIN_LOG_QUERY, { targetType, targetId })
    return result.data?.adminLog ?? []
  }

  // --- Mutations ---

  async function criarEdital(input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_EDITAL, { input })
    if (result.data?.criarEdital) { refetch(); return result.data.criarEdital }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarEdital(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_EDITAL, { id, input })
    if (result.data?.atualizarEdital) { refetch(); return result.data.atualizarEdital }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarEdital(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_EDITAL, { id })
    if (result.data?.deletarEdital) { refetch(); return result.data.deletarEdital }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function criarCargo(editalId: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_CARGO, { editalId, input })
    if (result.data?.criarCargo) { refetch(); return result.data.criarCargo }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarCargo(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_CARGO, { id, input })
    if (result.data?.atualizarCargo) { refetch(); return result.data.atualizarCargo }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarCargo(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_CARGO, { id })
    if (result.data?.deletarCargo) { refetch(); return result.data.deletarCargo }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function criarDisciplina(cargoId: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_DISCIPLINA, { cargoId, input })
    if (result.data?.criarDisciplina) { refetch(); return result.data.criarDisciplina }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarDisciplina(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_DISCIPLINA, { id, input })
    if (result.data?.atualizarDisciplina) { refetch(); return result.data.atualizarDisciplina }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarDisciplina(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_DISCIPLINA, { id })
    if (result.data?.deletarDisciplina) { refetch(); return result.data.deletarDisciplina }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function criarTopico(disciplinaId: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_TOPICO, { disciplinaId, input })
    if (result.data?.criarTopico) { refetch(); return result.data.criarTopico }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarTopico(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_TOPICO, { id, input })
    if (result.data?.atualizarTopico) { refetch(); return result.data.atualizarTopico }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarTopico(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_TOPICO, { id })
    if (result.data?.deletarTopico) { refetch(); return result.data.deletarTopico }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function reordenarTopicos(disciplinaId: number, topicoIds: number[]): Promise<MutationResult> {
    const result = await editaisMutation<any>(REORDENAR_TOPICOS, { disciplinaId, topicoIds })
    if (result.data?.reordenarTopicos) { refetch(); return result.data.reordenarTopicos }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function bulkAtivar(tipo: string, ids: number[], ativo: boolean): Promise<BulkResult> {
    const result = await editaisMutation<any>(BULK_ATIVAR, { tipo, ids, ativo })
    if (result.data?.bulkAtivar) { refetch(); return result.data.bulkAtivar }
    return { success: false, affected: 0 }
  }

  async function bulkDeletar(tipo: string, ids: number[]): Promise<BulkResult> {
    const result = await editaisMutation<any>(BULK_DELETAR, { tipo, ids })
    if (result.data?.bulkDeletar) { refetch(); return result.data.bulkDeletar }
    return { success: false, affected: 0 }
  }

  return {
    refreshKey,
    refetch,

    // Queries
    fetchEditais,
    fetchEditalFull,
    fetchCargos,
    fetchDisciplinas,
    fetchTopicos,
    fetchAdminLog,

    // Mutations
    criarEdital, atualizarEdital, deletarEdital,
    criarCargo, atualizarCargo, deletarCargo,
    criarDisciplina, atualizarDisciplina, deletarDisciplina,
    criarTopico, atualizarTopico, deletarTopico,
    reordenarTopicos,
    bulkAtivar, bulkDeletar,
  }
}
