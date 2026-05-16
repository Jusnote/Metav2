// V3 — Tipos de domínio derivados do schema do banco
// Refs: doc 04 (schema), doc 10 (fase 1)
//
// ATENÇÃO: Database import abaixo requer que src/v3/types/database.ts
// seja gerado após aplicação completa das migrations V3:
//   npx supabase gen types typescript --linked > src/v3/types/database.ts
//
// Enquanto as migrations não estiverem aplicadas, use os tipos inline abaixo.

// ---------------------------------------------------------------------------
// Tipos de atividade
// ---------------------------------------------------------------------------

export type TipoAtividade =
  | 'teoria'
  | 'questoes'
  | 'lei_seca'
  | 'resumo'
  | 'mapa_mental'
  | 'revisao_fsrs'
  | 'simulado'

export type StatusAtividade = 'pendente' | 'em_andamento' | 'concluida' | 'pulada'

export type OrigemAtividade = 'planejada' | 'fsrs_due' | 'reforco_manual'

// ---------------------------------------------------------------------------
// Natureza dos tópicos
// ---------------------------------------------------------------------------

export type Natureza =
  | 'doutrina'
  | 'doutrina_pratica'
  | 'pratica'
  | 'pratica_intensiva'
  | 'lei_seca'
  | 'lei_seca_mais_doutrina'
  | 'jurisprudencia'
  | 'misto'

// ---------------------------------------------------------------------------
// FSRS
// ---------------------------------------------------------------------------

export type EstadoFSRS = 'new' | 'learning' | 'review' | 'relearning'

// ---------------------------------------------------------------------------
// Concursos
// ---------------------------------------------------------------------------

export type StatusConcurso = 'rascunho' | 'revisao' | 'publicado' | 'arquivado'

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------

export type RoleAluno = 'aluno' | 'admin'

export type HorarioPico = 'manha' | 'tarde' | 'noite'

export type HorasPorDia = {
  seg: number
  ter: number
  qua: number
  qui: number
  sex: number
  sab: number
  dom: number
}

// ---------------------------------------------------------------------------
// Semanas
// ---------------------------------------------------------------------------

export type StatusSemana = 'bloqueada' | 'atual' | 'concluida'

// ---------------------------------------------------------------------------
// Conteúdos e questões
// ---------------------------------------------------------------------------

export type TipoConteudo = 'teoria' | 'lei_seca' | 'resumo' | 'mapa_mental' | 'jurisprudencia'

export type TipoQuestao = 'certo_errado' | 'multipla_escolha'

export interface Alternativa {
  letra: string
  texto: string
}

// ---------------------------------------------------------------------------
// Interfaces compostas (úteis para lógica de negócio)
// ---------------------------------------------------------------------------

/**
 * Tópico com metadados aninhados — usado em listas e árv ore de conteúdo
 */
export interface TopicoComMetadata {
  id: string
  bloco_id: string
  nome: string
  natureza: Natureza
  peso_incidencia: number
  horas_sugeridas: number
  tipo_revisao: string | null
  observacao: string | null
  pre_requisito_topico_id: string | null
  ordem: number
  criado_em: string
  atualizado_em: string
  bloco?: {
    id: string
    disciplina_id: string
    nome: string
    horas_bloco: number | null
    ordem: number
  }
  subtopicos?: Array<{
    id: string
    topico_id: string
    nome: string
    horas_sugeridas: number | null
    ordem: number
  }>
}

/**
 * Card FSRS com informações do subtópico — usado na view de memória
 */
export interface CardComSubtopico {
  aluno_id: string
  subtopico_id: string
  subtopico_nome: string
  topico_nome: string
  disciplina_nome: string
  retrievability: number | null
  due_date: string
  last_review: string | null
  lapse_count: number
}

/**
 * Progresso do aluno por disciplina — retorno da view v_progresso_disciplinas
 */
export interface ProgressoDisciplina {
  aluno_id: string
  disciplina_id: string
  disciplina_nome: string
  horas_totais: number
  total_topicos: number
  topicos_com_teoria: number
  subtopicos_em_fsrs: number
  desempenho_medio: number | null
}

/**
 * Payload de evento registrado em `eventos`
 */
export interface EventoPayload {
  tipo: string
  aluno_id?: string
  payload?: Record<string, unknown>
  criado_em?: string
}
