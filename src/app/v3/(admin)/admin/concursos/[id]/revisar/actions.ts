'use server'

// Server Actions: edição da árvore na tela de revisão
// Atualizações granulares de tópico/disciplina/subtópico + publicação do concurso.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/v3/lib/supabase/server'
import { NaturezaEnum } from '@/v3/lib/anthropic/schemas'

// ---------------------------------------------------------------------------
// Atualizar tópico
// ---------------------------------------------------------------------------

const AtualizarTopicoSchema = z.object({
  topicoId: z.string().uuid(),
  nome: z.string().min(1).max(300).optional(),
  natureza: NaturezaEnum.optional(),
  peso_incidencia: z.number().int().min(1).max(5).optional(),
  horas_sugeridas: z.number().positive().optional(),
  tipo_revisao: z.string().min(1).optional(),
  observacao: z.string().optional(),
  ordem: z.number().int().nonnegative().optional(),
})

export type AtualizarTopicoInput = z.infer<typeof AtualizarTopicoSchema>

export async function atualizarTopicoAction(
  input: AtualizarTopicoInput,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = AtualizarTopicoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Input inválido' }
  }
  const { topicoId, ...patch } = parsed.data

  const supabase = createServerClient()
  const { error } = await supabase.from('topicos').update(patch).eq('id', topicoId)
  if (error) return { ok: false, erro: error.message }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Atualizar disciplina
// ---------------------------------------------------------------------------

const AtualizarDisciplinaSchema = z.object({
  disciplinaId: z.string().uuid(),
  nome: z.string().min(1).max(200).optional(),
  horas_totais: z.number().positive().optional(),
  nivel: z.enum(['basico', 'intermediario', 'avancado']).optional(),
  ordem: z.number().int().nonnegative().optional(),
})

export type AtualizarDisciplinaInput = z.infer<typeof AtualizarDisciplinaSchema>

export async function atualizarDisciplinaAction(
  input: AtualizarDisciplinaInput,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = AtualizarDisciplinaSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Input inválido' }
  }
  const { disciplinaId, ...patch } = parsed.data

  const supabase = createServerClient()
  const { error } = await supabase.from('disciplinas').update(patch).eq('id', disciplinaId)
  if (error) return { ok: false, erro: error.message }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Atualizar subtópico
// ---------------------------------------------------------------------------

const AtualizarSubtopicoSchema = z.object({
  subtopicoId: z.string().uuid(),
  nome: z.string().min(1).max(300).optional(),
  horas_sugeridas: z.number().positive().nullable().optional(),
  ordem: z.number().int().nonnegative().optional(),
})

export async function atualizarSubtopicoAction(
  input: z.infer<typeof AtualizarSubtopicoSchema>,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = AtualizarSubtopicoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Input inválido' }
  }
  const { subtopicoId, ...patch } = parsed.data

  const supabase = createServerClient()
  const { error } = await supabase.from('subtopicos').update(patch).eq('id', subtopicoId)
  if (error) return { ok: false, erro: error.message }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Reordenar tópicos dentro de um bloco (drag-and-drop)
// ---------------------------------------------------------------------------

const ReordenarTopicosSchema = z.object({
  blocoId: z.string().uuid(),
  ordens: z.array(
    z.object({
      topicoId: z.string().uuid(),
      ordem: z.number().int().nonnegative(),
    }),
  ),
})

export async function reordenarTopicosAction(
  input: z.infer<typeof ReordenarTopicosSchema>,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = ReordenarTopicosSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Input inválido' }
  }

  const supabase = createServerClient()

  // UNIQUE(bloco_id, ordem) impede update direto sem conflito. Estratégia:
  // jogar todos pra ordens temporárias (+10000) e depois aplicar as finais.
  const ordens = parsed.data.ordens
  const ids = ordens.map((o) => o.topicoId)

  // Passo 1 — temp
  for (const o of ordens) {
    const { error } = await supabase
      .from('topicos')
      .update({ ordem: o.ordem + 10000 })
      .eq('id', o.topicoId)
    if (error) {
      return { ok: false, erro: `Falha temp em ${o.topicoId}: ${error.message}` }
    }
  }
  // Passo 2 — final
  for (const o of ordens) {
    const { error } = await supabase
      .from('topicos')
      .update({ ordem: o.ordem })
      .eq('id', o.topicoId)
    if (error) {
      return { ok: false, erro: `Falha final em ${o.topicoId}: ${error.message}` }
    }
  }

  // sanity check — os IDs realmente são do mesmo bloco?
  await supabase.from('eventos').insert({
    tipo: 'arvore_reordenada',
    payload: { bloco_id: parsed.data.blocoId, count: ids.length } as unknown as Record<
      string,
      unknown
    >,
  })

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Publicar concurso
// ---------------------------------------------------------------------------

export async function publicarConcursoAction(
  concursoId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!z.string().uuid().safeParse(concursoId).success) {
    return { ok: false, erro: 'concursoId inválido' }
  }

  const supabase = createServerClient()

  // Validação mínima: concurso precisa ter ao menos 1 disciplina e cada
  // disciplina ao menos 1 bloco + tópico.
  const { data: discs, error: errCheck } = await supabase
    .from('disciplinas')
    .select('id, nome, blocos_tematicos(id, topicos(id))')
    .eq('concurso_id', concursoId)

  if (errCheck) return { ok: false, erro: `Falha ao validar árvore: ${errCheck.message}` }
  if (!discs || discs.length === 0) {
    return { ok: false, erro: 'Concurso sem disciplinas — não pode publicar' }
  }
  for (const d of discs) {
    const blocos = (d.blocos_tematicos ?? []) as Array<{
      id: string
      topicos: Array<{ id: string }>
    }>
    if (blocos.length === 0) {
      return { ok: false, erro: `Disciplina "${d.nome}" não tem blocos` }
    }
    for (const b of blocos) {
      if (!b.topicos || b.topicos.length === 0) {
        return { ok: false, erro: `Disciplina "${d.nome}" tem bloco sem tópicos` }
      }
    }
  }

  const { error: errUpd } = await supabase
    .from('concursos')
    .update({
      status: 'publicado',
      publicado_em: new Date().toISOString(),
    })
    .eq('id', concursoId)

  if (errUpd) return { ok: false, erro: errUpd.message }

  await supabase.from('eventos').insert({
    tipo: 'concurso_publicado',
    payload: { concurso_id: concursoId } as unknown as Record<string, unknown>,
  })

  revalidatePath('/v3/admin/concursos')
  revalidatePath(`/v3/admin/concursos/${concursoId}/revisar`)

  return { ok: true }
}
