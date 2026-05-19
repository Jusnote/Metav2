'use server'

// Server Actions: CRUD de resumos por bloco (subtopico).
// Todas operações usam service role (createServerClient) e validação Zod.
//
// Estados:
//   - rascunho  → admin escreveu mas não publicou (aluno NÃO vê)
//   - publicado → visível pra aluno autenticado

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/v3/lib/supabase/server'
import type { Json } from '@/v3/types/database'

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

export interface Resumo {
  id: string
  subtopico_id: string
  conteudo_plate: Json
  status: 'rascunho' | 'publicado'
  atualizado_em: string
  atualizado_por: string | null
  publicado_em: string | null
}

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; erro: string }

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const UuidSchema = z.string().uuid()

const SalvarRascunhoSchema = z.object({
  subtopicoId: z.string().uuid(),
  conteudoPlate: z.unknown(), // Plate doc — array de blocos arbitrários
})

// ----------------------------------------------------------------------------
// getResumoPorBloco — devolve resumo (publicado ou rascunho) ou null
// Uso no admin: precisa ver mesmo rascunho.
// ----------------------------------------------------------------------------

export async function getResumoPorBloco(
  subtopicoId: string,
): Promise<Resumo | null> {
  const parsed = UuidSchema.safeParse(subtopicoId)
  if (!parsed.success) return null

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('resumos')
    .select('*')
    .eq('subtopico_id', parsed.data)
    .maybeSingle()

  if (error) {
    console.error('[getResumoPorBloco] erro:', error.message)
    return null
  }
  if (!data) return null
  return data as unknown as Resumo
}

// ----------------------------------------------------------------------------
// salvarRascunhoResumo — upsert mantendo status (ou criando como rascunho)
// Não muda publicado_em.  Se já estava publicado, mantém publicado e salva.
// ----------------------------------------------------------------------------

export async function salvarRascunhoResumo(input: {
  subtopicoId: string
  conteudoPlate: unknown
}): Promise<ActionResult<{ id: string; status: 'rascunho' | 'publicado' }>> {
  const parsed = SalvarRascunhoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Input inválido' }
  }

  const supabase = createServerClient()

  // Verifica se já existe (pra preservar status atual)
  const { data: existente, error: errSelect } = await supabase
    .from('resumos')
    .select('id, status')
    .eq('subtopico_id', parsed.data.subtopicoId)
    .maybeSingle()

  if (errSelect) {
    return { ok: false, erro: `Falha ao buscar resumo: ${errSelect.message}` }
  }

  if (existente) {
    const { error } = await supabase
      .from('resumos')
      .update({
        conteudo_plate: parsed.data.conteudoPlate as Json,
        // status mantido (rascunho ou publicado)
      })
      .eq('id', existente.id)
    if (error) return { ok: false, erro: error.message }

    return {
      ok: true,
      data: {
        id: existente.id,
        status: existente.status as 'rascunho' | 'publicado',
      },
    }
  }

  // Não existe — cria como rascunho
  const { data: criado, error: errInsert } = await supabase
    .from('resumos')
    .insert({
      subtopico_id: parsed.data.subtopicoId,
      conteudo_plate: parsed.data.conteudoPlate as Json,
      status: 'rascunho',
    })
    .select('id, status')
    .single()

  if (errInsert) return { ok: false, erro: errInsert.message }

  return {
    ok: true,
    data: {
      id: criado.id,
      status: criado.status as 'rascunho' | 'publicado',
    },
  }
}

// ----------------------------------------------------------------------------
// publicarResumo — muda status pra 'publicado' e set publicado_em
// Se ainda não existe linha, cria vazia publicada (raro — UI deve impedir).
// ----------------------------------------------------------------------------

export async function publicarResumo(
  subtopicoId: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UuidSchema.safeParse(subtopicoId)
  if (!parsed.success) {
    return { ok: false, erro: 'subtopicoId inválido' }
  }

  const supabase = createServerClient()

  const { data: existente } = await supabase
    .from('resumos')
    .select('id')
    .eq('subtopico_id', parsed.data)
    .maybeSingle()

  if (!existente) {
    return { ok: false, erro: 'Crie ou salve o resumo antes de publicar' }
  }

  const { error } = await supabase
    .from('resumos')
    .update({
      status: 'publicado',
      publicado_em: new Date().toISOString(),
    })
    .eq('id', existente.id)

  if (error) return { ok: false, erro: error.message }

  // Revalida lista e leitor
  await revalidarRotasResumo(parsed.data)

  return { ok: true, data: { id: existente.id } }
}

// ----------------------------------------------------------------------------
// despublicarResumo — volta pra rascunho (aluno deixa de ver)
// ----------------------------------------------------------------------------

export async function despublicarResumo(
  subtopicoId: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UuidSchema.safeParse(subtopicoId)
  if (!parsed.success) {
    return { ok: false, erro: 'subtopicoId inválido' }
  }

  const supabase = createServerClient()

  const { data: existente } = await supabase
    .from('resumos')
    .select('id')
    .eq('subtopico_id', parsed.data)
    .maybeSingle()

  if (!existente) {
    return { ok: false, erro: 'Resumo não encontrado' }
  }

  const { error } = await supabase
    .from('resumos')
    .update({ status: 'rascunho' })
    .eq('id', existente.id)

  if (error) return { ok: false, erro: error.message }

  await revalidarRotasResumo(parsed.data)

  return { ok: true, data: { id: existente.id } }
}

// ----------------------------------------------------------------------------
// Helper: revalidar paths admin + aluno relacionados ao bloco
// Precisa descobrir o concurso_id via cadeia subtopico→topico→bloco→disciplina.
// ----------------------------------------------------------------------------

async function revalidarRotasResumo(subtopicoId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('subtopicos')
    .select(
      `
      id,
      topicos!inner(
        bloco_id,
        blocos_tematicos!inner(
          disciplina_id,
          disciplinas!inner(concurso_id)
        )
      )
    `,
    )
    .eq('id', subtopicoId)
    .maybeSingle()

  // tipo gerado é complicado aqui — fazemos navegação defensiva
  const concursoId = extrairConcursoId(data)
  if (concursoId) {
    revalidatePath(`/v3/admin/concursos/${concursoId}/resumos`)
    revalidatePath(`/v3/admin/concursos/${concursoId}/resumos/${subtopicoId}`)
    revalidatePath(`/v3/cursos/${concursoId}/resumos/${subtopicoId}`)
  }
}

function extrairConcursoId(data: unknown): string | null {
  try {
    const t = (data as { topicos?: unknown })?.topicos
    const topico = Array.isArray(t) ? t[0] : t
    const b = (topico as { blocos_tematicos?: unknown })?.blocos_tematicos
    const bloco = Array.isArray(b) ? b[0] : b
    const d = (bloco as { disciplinas?: unknown })?.disciplinas
    const disc = Array.isArray(d) ? d[0] : d
    const id = (disc as { concurso_id?: unknown })?.concurso_id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}
