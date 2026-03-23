// Types mirroring the GraphQL API responses

export interface Lei {
  id: string
  titulo: string
  apelido: string | null
  ementa: string | null
  tipo: string
  nivel: string
  data: string | null
  status: string
  hierarquia: HierarquiaNode[]
  stats?: LeiStats
}

export interface LeiStats {
  totalDispositivos: number
  totalArtigos: number
  totalRevogados: number
}

export interface HierarquiaNode {
  tipo: string
  descricao: string
  subtitulo?: string
  path: string
  filhos: HierarquiaNode[]
}

export interface Dispositivo {
  id: string
  tipo: string
  numero: string | null
  texto: string
  epigrafe: string | null
  pena: string | null
  anotacoes: Anotacao[] | null
  links: ReferenciaCruzada[] | null
  revogado: boolean
  path: string | null
  posicao: number
}

export interface Anotacao {
  tipo: string
  lei: string | null
  texto: string | null
}

export interface ReferenciaCruzada {
  href: string
  titulo: string
  textoAncora: string
  leiId: string | null
}

export interface BuscaHit {
  dispositivo: Dispositivo
  lei: Lei
  highlight: string
  score: number
}

export interface LeisConnection {
  nodes: Lei[]
  totalCount: number
}

export interface DispositivosConnection {
  nodes: Dispositivo[]
  totalCount: number
}

export interface BuscaResult {
  total: number
  hits: BuscaHit[]
}
