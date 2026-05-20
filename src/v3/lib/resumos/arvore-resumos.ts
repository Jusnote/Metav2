// Carrega a árvore disciplina → tópico (aula) → subtópico (bloco) de um concurso,
// já com info do resumo associado (se existe e qual o status).
//
// Usado pela tela admin de lista de blocos com resumos.

import { createServerClient } from '@/v3/lib/supabase/server'

export type StatusResumo = 'sem-resumo' | 'rascunho' | 'publicado'

export interface BlocoComResumo {
  id: string // subtopico_id (semântica V3: bloco do cronograma == subtopico)
  nome: string
  ordem: number
  horas_sugeridas: number | null
  resumo: {
    id: string
    status: 'rascunho' | 'publicado'
    atualizado_em: string
    publicado_em: string | null
  } | null
  statusResumo: StatusResumo
}

export interface AulaComBlocos {
  id: string // topico_id
  nome: string
  ordem: number
  natureza: string
  horas_sugeridas: number
  blocos: BlocoComResumo[]
}

export interface DisciplinaComAulas {
  id: string
  nome: string
  ordem: number
  cor: string | null
  aulas: AulaComBlocos[]
}

export interface ConcursoComResumos {
  id: string
  nome: string
  banca: string
  cargo: string
  disciplinas: DisciplinaComAulas[]
  stats: {
    totalBlocos: number
    publicados: number
    rascunhos: number
    semResumo: number
  }
}

export async function carregarConcursoComResumos(
  concursoId: string,
): Promise<ConcursoComResumos | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('concursos')
    .select(
      `
      id, nome, banca, cargo,
      disciplinas (
        id, nome, ordem, cor,
        blocos_tematicos (
          id, ordem,
          topicos (
            id, nome, ordem, natureza, horas_sugeridas,
            subtopicos ( id, nome, ordem, horas_sugeridas )
          )
        )
      )
    `,
    )
    .eq('id', concursoId)
    .single()

  if (error || !data) {
    console.error(
      '[arvore-resumos] Falha ao carregar concurso:',
      error?.message,
    )
    return null
  }

  // Buscar todos resumos do concurso (uma única query plana)
  const subtopicoIds: string[] = []
  for (const d of data.disciplinas ?? []) {
    for (const b of d.blocos_tematicos ?? []) {
      for (const t of b.topicos ?? []) {
        for (const s of t.subtopicos ?? []) {
          subtopicoIds.push(s.id)
        }
      }
    }
  }

  const resumosPorSubtopico = new Map<
    string,
    {
      id: string
      status: 'rascunho' | 'publicado'
      atualizado_em: string
      publicado_em: string | null
    }
  >()

  if (subtopicoIds.length > 0) {
    const { data: resumos, error: errResumos } = await supabase
      .from('resumos')
      .select('id, subtopico_id, status, atualizado_em, publicado_em')
      .in('subtopico_id', subtopicoIds)

    if (errResumos) {
      console.error('[arvore-resumos] Falha ao carregar resumos:', errResumos.message)
    } else {
      for (const r of resumos ?? []) {
        resumosPorSubtopico.set(r.subtopico_id, {
          id: r.id,
          status: r.status as 'rascunho' | 'publicado',
          atualizado_em: r.atualizado_em,
          publicado_em: r.publicado_em,
        })
      }
    }
  }

  // Reorganizar: a estrutura semântica V3 é disciplina → topico (aula) → subtopico (bloco).
  // O nível "bloco_tematico" do schema é apenas agrupador horário — para a tela de resumos
  // a unidade visual significativa é a AULA (topico). Flatten todos topicos de todos
  // blocos_tematicos de uma disciplina pra simplificar.
  const stats = { totalBlocos: 0, publicados: 0, rascunhos: 0, semResumo: 0 }

  const disciplinas: DisciplinaComAulas[] = (data.disciplinas ?? [])
    .map((d) => {
      const aulas: AulaComBlocos[] = []
      for (const bt of d.blocos_tematicos ?? []) {
        for (const t of bt.topicos ?? []) {
          const blocos: BlocoComResumo[] = (t.subtopicos ?? [])
            .map((s) => {
              const resumo = resumosPorSubtopico.get(s.id) ?? null
              const statusResumo: StatusResumo = resumo
                ? resumo.status === 'publicado'
                  ? 'publicado'
                  : 'rascunho'
                : 'sem-resumo'
              stats.totalBlocos += 1
              if (statusResumo === 'publicado') stats.publicados += 1
              else if (statusResumo === 'rascunho') stats.rascunhos += 1
              else stats.semResumo += 1
              return {
                id: s.id,
                nome: s.nome,
                ordem: s.ordem,
                horas_sugeridas: s.horas_sugeridas,
                resumo,
                statusResumo,
              }
            })
            .sort((a, b) => a.ordem - b.ordem)

          aulas.push({
            id: t.id,
            nome: t.nome,
            ordem: t.ordem,
            natureza: t.natureza,
            horas_sugeridas: t.horas_sugeridas,
            blocos,
          })
        }
      }
      aulas.sort((a, b) => a.ordem - b.ordem)
      return {
        id: d.id,
        nome: d.nome,
        ordem: d.ordem,
        cor: d.cor,
        aulas,
      }
    })
    .sort((a, b) => a.ordem - b.ordem)

  return {
    id: data.id,
    nome: data.nome,
    banca: data.banca,
    cargo: data.cargo,
    disciplinas,
    stats,
  }
}

// Helper "Continue de onde parou": último resumo em rascunho do concurso,
// junto com contexto mínimo (nome do bloco, aula, ordens) pra renderizar o card.
export interface UltimoRascunho {
  resumoId: string
  blocoId: string
  blocoNome: string
  blocoOrdem: number
  aulaOrdem: number
  aulaNome: string
  disciplinaNome: string
  atualizadoEm: string
}

export async function carregarUltimoRascunho(
  concursoId: string,
): Promise<UltimoRascunho | null> {
  const supabase = createServerClient()

  // 1) Pega o conjunto de subtopico_ids deste concurso
  const { data: discData } = await supabase
    .from('concursos')
    .select(
      `
      id,
      disciplinas (
        id, nome,
        blocos_tematicos (
          topicos (
            id, nome, ordem,
            subtopicos ( id, nome, ordem )
          )
        )
      )
    `,
    )
    .eq('id', concursoId)
    .maybeSingle()

  if (!discData) return null

  const subtopicoMap = new Map<
    string,
    {
      nome: string
      ordem: number
      aulaNome: string
      aulaOrdem: number
      disciplinaNome: string
    }
  >()

  for (const d of discData.disciplinas ?? []) {
    for (const bt of d.blocos_tematicos ?? []) {
      for (const t of bt.topicos ?? []) {
        for (const s of t.subtopicos ?? []) {
          subtopicoMap.set(s.id, {
            nome: s.nome,
            ordem: s.ordem,
            aulaNome: t.nome,
            aulaOrdem: t.ordem,
            disciplinaNome: d.nome,
          })
        }
      }
    }
  }

  if (subtopicoMap.size === 0) return null

  // 2) Mais recente rascunho dentre esses subtópicos
  const { data: rascunho } = await supabase
    .from('resumos')
    .select('id, subtopico_id, atualizado_em, status')
    .in('subtopico_id', Array.from(subtopicoMap.keys()))
    .eq('status', 'rascunho')
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!rascunho) return null

  const ctx = subtopicoMap.get(rascunho.subtopico_id)
  if (!ctx) return null

  return {
    resumoId: rascunho.id,
    blocoId: rascunho.subtopico_id,
    blocoNome: ctx.nome,
    blocoOrdem: ctx.ordem,
    aulaOrdem: ctx.aulaOrdem,
    aulaNome: ctx.aulaNome,
    disciplinaNome: ctx.disciplinaNome,
    atualizadoEm: rascunho.atualizado_em,
  }
}

// Helper para a tela do editor: dados de um bloco específico (com aula/disciplina pai).
export interface BlocoEditorContexto {
  concursoId: string
  concursoNome: string
  disciplina: { id: string; nome: string }
  aula: {
    id: string
    nome: string
    ordem: number
    horas_sugeridas: number
  }
  bloco: {
    id: string
    nome: string
    ordem: number
    horas_sugeridas: number | null
  }
  // Outros subtópicos da mesma aula (pra exibir na sidebar como "roteiro").
  // Como subtopico já é o bloco, exibimos os outros blocos irmãos como referência.
  blocosIrmaos: Array<{ id: string; nome: string; ordem: number }>
}

export async function carregarContextoBloco(
  concursoId: string,
  blocoId: string,
): Promise<BlocoEditorContexto | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('subtopicos')
    .select(
      `
      id, nome, ordem, horas_sugeridas,
      topicos!inner(
        id, nome, ordem, horas_sugeridas,
        subtopicos ( id, nome, ordem ),
        blocos_tematicos!inner(
          disciplinas!inner(
            id, nome, concurso_id,
            concursos!inner(id, nome)
          )
        )
      )
    `,
    )
    .eq('id', blocoId)
    .maybeSingle()

  if (error || !data) {
    console.error('[arvore-resumos] Falha ao carregar contexto bloco:', error?.message)
    return null
  }

  // Navegação defensiva (tipos do Supabase pra nested arrays vêm meio frouxos)
  const topico = Array.isArray(data.topicos) ? data.topicos[0] : data.topicos
  if (!topico) return null

  const bt = Array.isArray(topico.blocos_tematicos)
    ? topico.blocos_tematicos[0]
    : topico.blocos_tematicos
  const disc = bt && (Array.isArray(bt.disciplinas) ? bt.disciplinas[0] : bt.disciplinas)
  if (!disc) return null

  const conc = Array.isArray(disc.concursos) ? disc.concursos[0] : disc.concursos
  if (!conc) return null

  // Confere que o bloco pertence ao concurso da rota
  if (disc.concurso_id !== concursoId) return null

  const irmaos = ((topico.subtopicos ?? []) as Array<{
    id: string
    nome: string
    ordem: number
  }>)
    .filter((s) => s.id !== blocoId)
    .sort((a, b) => a.ordem - b.ordem)

  return {
    concursoId,
    concursoNome: conc.nome,
    disciplina: { id: disc.id, nome: disc.nome },
    aula: {
      id: topico.id,
      nome: topico.nome,
      ordem: topico.ordem,
      horas_sugeridas: topico.horas_sugeridas,
    },
    bloco: {
      id: data.id,
      nome: data.nome,
      ordem: data.ordem,
      horas_sugeridas: data.horas_sugeridas,
    },
    blocosIrmaos: irmaos,
  }
}
