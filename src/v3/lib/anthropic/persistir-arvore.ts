// Persiste a árvore validada da IA em coaching.disciplinas / blocos_tematicos / topicos / subtopicos
// Ref: doc 04 (schema do banco) — usa client com service role e schema coaching

import { createServerClient } from '@/v3/lib/supabase/server'
import type { DisciplinaEstruturada } from './schemas'

interface PersistirArvoreParams {
  concursoId: string
  disciplinas: DisciplinaEstruturada[]
}

interface PersistirArvoreResult {
  totalDisciplinas: number
  totalBlocos: number
  totalTopicos: number
  totalSubtopicos: number
}

/**
 * Persiste a árvore completa em uma sequência de inserts.
 *
 * NÃO há transação real (supabase-js não suporta) — em caso de falha parcial,
 * o admin tem botão "Reprocessar com IA" pra retentar. Aceita-se idempotência
 * eventual no MVP. Em produção, considerar Edge Function com plpgsql transação.
 */
export async function persistirArvoreEdital(
  params: PersistirArvoreParams,
): Promise<PersistirArvoreResult> {
  const supabase = createServerClient()
  let totalBlocos = 0
  let totalTopicos = 0
  let totalSubtopicos = 0

  for (let dIdx = 0; dIdx < params.disciplinas.length; dIdx++) {
    const d = params.disciplinas[dIdx]

    // Insere disciplina
    const { data: discInserida, error: errDisc } = await supabase
      .from('disciplinas')
      .insert({
        concurso_id: params.concursoId,
        nome: d.disciplina,
        horas_totais: d.horas_totais_sugeridas,
        nivel: d.nivel,
        ordem: dIdx + 1,
        observacoes_globais: d.observacoes_globais as unknown as Record<string, unknown>,
      })
      .select('id')
      .single()

    if (errDisc || !discInserida) {
      throw new Error(
        `Falha ao inserir disciplina "${d.disciplina}": ${errDisc?.message ?? 'sem dados'}`,
      )
    }
    const disciplinaId = discInserida.id

    // Blocos
    for (const b of d.blocos) {
      const { data: blocoInserido, error: errBloco } = await supabase
        .from('blocos_tematicos')
        .insert({
          disciplina_id: disciplinaId,
          nome: b.nome,
          horas_bloco: b.horas_bloco ?? null,
          ordem: b.ordem,
        })
        .select('id')
        .single()

      if (errBloco || !blocoInserido) {
        throw new Error(
          `Falha ao inserir bloco "${b.nome}" em "${d.disciplina}": ${errBloco?.message ?? 'sem dados'}`,
        )
      }
      const blocoId = blocoInserido.id
      totalBlocos++

      // Tópicos
      for (const t of b.topicos) {
        const { data: topicoInserido, error: errTopico } = await supabase
          .from('topicos')
          .insert({
            bloco_id: blocoId,
            nome: t.nome,
            natureza: t.natureza,
            peso_incidencia: t.peso_incidencia,
            horas_sugeridas: t.horas_sugeridas,
            tipo_revisao: t.tipo_revisao,
            observacao: t.observacao ?? null,
            ordem: t.ordem,
          })
          .select('id')
          .single()

        if (errTopico || !topicoInserido) {
          throw new Error(
            `Falha ao inserir tópico "${t.nome}" em "${b.nome}": ${errTopico?.message ?? 'sem dados'}`,
          )
        }
        const topicoId = topicoInserido.id
        totalTopicos++

        // Subtópicos
        if (t.subtopicos && t.subtopicos.length > 0) {
          const subRows = t.subtopicos.map((s) => ({
            topico_id: topicoId,
            nome: s.nome,
            horas_sugeridas: s.horas_sugeridas ?? null,
            ordem: s.ordem,
          }))
          const { error: errSub } = await supabase.from('subtopicos').insert(subRows)
          if (errSub) {
            throw new Error(
              `Falha ao inserir subtópicos de "${t.nome}": ${errSub.message}`,
            )
          }
          totalSubtopicos += subRows.length
        }
      }
    }
  }

  return {
    totalDisciplinas: params.disciplinas.length,
    totalBlocos,
    totalTopicos,
    totalSubtopicos,
  }
}
