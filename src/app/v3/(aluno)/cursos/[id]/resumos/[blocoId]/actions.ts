'use server'

// Server Actions do aluno para o leitor de resumos.
// `marcarBlocoConcluidoAction` insere uma revisão FSRS (rating) na tabela
// coaching.resumo_revisoes. Por enquanto NÃO calcula a próxima data — isso
// fica para a integração com o motor FSRS em fase futura.

import { z } from 'zod'
import { createAnonServerClient } from '@/v3/lib/supabase/server'

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; erro: string }

const MarcarConcluidoSchema = z.object({
  resumoId: z.string().uuid(),
  rating: z.enum(['again', 'hard', 'good', 'easy']),
})

export async function marcarBlocoConcluidoAction(input: {
  resumoId: string
  rating: 'again' | 'hard' | 'good' | 'easy'
}): Promise<ActionResult<{ proximaRevisaoEm: string | null }>> {
  const parsed = MarcarConcluidoSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      erro: parsed.error.issues[0]?.message ?? 'Input inválido',
    }
  }

  // Usa cliente anon — RLS exige aluno_id = auth.uid()
  const supabase = createAnonServerClient()

  // Pega o usuário autenticado para preencher aluno_id (RLS valida igualdade)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, erro: 'Não autenticado' }
  }

  const { error } = await supabase.from('resumo_revisoes').insert({
    aluno_id: user.id,
    resumo_id: parsed.data.resumoId,
    rating: parsed.data.rating,
  })

  if (error) {
    return { ok: false, erro: error.message }
  }

  // TODO: integrar com motor FSRS para calcular próxima data real.
  return { ok: true, data: { proximaRevisaoEm: null } }
}
