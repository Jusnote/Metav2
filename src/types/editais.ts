export interface EditalResumo {
  id: number
  nome: string
  sigla: string | null
  esfera: string | null
  tipo: string | null
  totalCargos: number
  totalDisciplinas: number
  totalTopicos: number
}

export interface PaginaInfo {
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

export interface EditaisPaginados {
  dados: EditalResumo[]
  paginacao: PaginaInfo
}

export interface Cargo {
  id: number
  nome: string
  vagas: number | null
  remuneracao: number | null
  qtdDisciplinas: number | null
  qtdTopicos: number | null
}

export interface Edital extends EditalResumo {
  descricao: string | null
  dataPublicacao: string | null
  link: string | null
  cargos: Cargo[]
}

export type EsferaFilter = 'todos' | 'federal' | 'estadual' | 'municipal'
