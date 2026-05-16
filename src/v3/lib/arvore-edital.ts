// Helper para carregar a árvore completa de um concurso em uma única round-trip
// Usado pela tela de revisão (server component).

import { createServerClient } from '@/v3/lib/supabase/server'

export interface SubtopicoArvore {
  id: string
  nome: string
  horas_sugeridas: number | null
  ordem: number
}

export interface TopicoArvore {
  id: string
  bloco_id: string
  nome: string
  natureza: string
  peso_incidencia: number
  horas_sugeridas: number
  tipo_revisao: string | null
  observacao: string | null
  ordem: number
  subtopicos: SubtopicoArvore[]
}

export interface BlocoArvore {
  id: string
  disciplina_id: string
  nome: string
  horas_bloco: number | null
  ordem: number
  topicos: TopicoArvore[]
}

export interface DisciplinaArvore {
  id: string
  concurso_id: string
  nome: string
  horas_totais: number
  nivel: string | null
  cor: string | null
  ordem: number
  observacoes_globais: unknown
  blocos: BlocoArvore[]
}

export interface ConcursoComArvore {
  id: string
  nome: string
  banca: string
  cargo: string
  nivel: string | null
  status: string
  data_prova: string | null
  publicado_em: string | null
  disciplinas: DisciplinaArvore[]
}

export async function carregarConcursoComArvore(
  concursoId: string,
): Promise<ConcursoComArvore | null> {
  const supabase = createServerClient()

  // Single query nested — Supabase resolve as joins
  const { data, error } = await supabase
    .from('concursos')
    .select(
      `
      id, nome, banca, cargo, nivel, status, data_prova, publicado_em,
      disciplinas (
        id, concurso_id, nome, horas_totais, nivel, cor, ordem, observacoes_globais,
        blocos_tematicos (
          id, disciplina_id, nome, horas_bloco, ordem,
          topicos (
            id, bloco_id, nome, natureza, peso_incidencia, horas_sugeridas,
            tipo_revisao, observacao, ordem,
            subtopicos ( id, nome, horas_sugeridas, ordem )
          )
        )
      )
    `,
    )
    .eq('id', concursoId)
    .single()

  if (error || !data) {
    console.error('[arvore-edital] Falha ao carregar concurso:', error?.message)
    return null
  }

  // Normaliza ordenação e renomeia blocos_tematicos → blocos
  const disciplinas: DisciplinaArvore[] = (data.disciplinas ?? [])
    .map((d) => ({
      id: d.id,
      concurso_id: d.concurso_id,
      nome: d.nome,
      horas_totais: d.horas_totais,
      nivel: d.nivel,
      cor: d.cor,
      ordem: d.ordem,
      observacoes_globais: d.observacoes_globais,
      blocos: ((d.blocos_tematicos ?? []) as Array<any>) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((b) => ({
          id: b.id,
          disciplina_id: b.disciplina_id,
          nome: b.nome,
          horas_bloco: b.horas_bloco,
          ordem: b.ordem,
          topicos: ((b.topicos ?? []) as Array<any>) // eslint-disable-line @typescript-eslint/no-explicit-any
            .map((t) => ({
              id: t.id,
              bloco_id: t.bloco_id,
              nome: t.nome,
              natureza: t.natureza,
              peso_incidencia: t.peso_incidencia,
              horas_sugeridas: t.horas_sugeridas,
              tipo_revisao: t.tipo_revisao,
              observacao: t.observacao,
              ordem: t.ordem,
              subtopicos: ((t.subtopicos ?? []) as Array<any>) // eslint-disable-line @typescript-eslint/no-explicit-any
                .map((s) => ({
                  id: s.id,
                  nome: s.nome,
                  horas_sugeridas: s.horas_sugeridas,
                  ordem: s.ordem,
                }))
                .sort((a, b) => a.ordem - b.ordem),
            }))
            .sort((a, b) => a.ordem - b.ordem),
        }))
        .sort((a, b) => a.ordem - b.ordem),
    }))
    .sort((a, b) => a.ordem - b.ordem)

  return {
    id: data.id,
    nome: data.nome,
    banca: data.banca,
    cargo: data.cargo,
    nivel: data.nivel,
    status: data.status,
    data_prova: data.data_prova,
    publicado_em: data.publicado_em,
    disciplinas,
  }
}

/**
 * Coleta alertas dos campos observacoes_globais das disciplinas.
 * Os alertas originais vêm em `eventos.payload` quando o edital foi processado,
 * mas como persistimos `observacoes_globais` na disciplina (que não tem alertas
 * separados no schema), usamos uma query nos eventos para recuperar alertas históricos.
 */
export async function carregarAlertasIa(concursoId: string): Promise<
  Array<{ disciplina: string; texto: string }>
> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('eventos')
    .select('payload')
    .eq('tipo', 'edital_processado')
    .order('criado_em', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return []

  // Sem persistência granular dos alertas (FUTURO: tabela alertas_ia).
  // Retorna lista vazia por ora — UI exibe "Nenhum alerta".
  return []
}
