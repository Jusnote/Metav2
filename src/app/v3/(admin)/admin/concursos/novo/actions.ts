'use server'

// Server Action: processar edital
// Cria o concurso, persiste o edital bruto, dispara o pipeline IA e
// persiste a árvore validada em coaching.disciplinas/blocos/topicos/subtopicos.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { processarEdital, type ContextoConcurso } from '@/v3/lib/anthropic/parse-edital'
import { persistirArvoreEdital } from '@/v3/lib/anthropic/persistir-arvore'
import { createServerClient } from '@/v3/lib/supabase/server'
import { IAResponseError } from '@/v3/lib/anthropic/schemas'

// ---------------------------------------------------------------------------
// Schemas de input
// ---------------------------------------------------------------------------

const InputProcessarEditalSchema = z.object({
  nome: z.string().min(3, 'Nome do concurso é obrigatório').max(200),
  banca: z.string().min(2, 'Banca é obrigatória').max(100),
  cargo: z.string().min(2, 'Cargo é obrigatório').max(100),
  nivel: z.enum(['medio', 'superior']).optional(),
  dataProva: z.string().optional(),
  textoEdital: z.string().min(200, 'Texto do edital muito curto (mínimo 200 caracteres)'),
  horasTotaisCronograma: z.coerce.number().int().positive().max(2000).default(400),
  nivelProfundidade: z.enum(['basico', 'intermediario', 'avancado']).default('intermediario'),
})

export type ProcessarEditalInput = z.infer<typeof InputProcessarEditalSchema>

export type ProcessarEditalResult =
  | {
      ok: true
      concursoId: string
      totais: { disciplinas: number; blocos: number; topicos: number; subtopicos: number }
      custoBrl: number
      alertas: string[]
    }
  | {
      ok: false
      erro: string
      etapa?: string
      disciplina?: string
      concursoId?: string // permite retentar
    }

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------

export async function processarEditalAction(
  raw: unknown,
): Promise<ProcessarEditalResult> {
  // Validação Zod do input
  const parsed = InputProcessarEditalSchema.safeParse(raw)
  if (!parsed.success) {
    const primeiraMsg = parsed.error.issues[0]?.message ?? 'Input inválido'
    return { ok: false, erro: primeiraMsg }
  }
  const input = parsed.data

  const supabase = createServerClient()

  // 1) Cria o concurso (status rascunho)
  const { data: concursoCriado, error: errConcurso } = await supabase
    .from('concursos')
    .insert({
      nome: input.nome,
      banca: input.banca,
      cargo: input.cargo,
      nivel: input.nivel ?? null,
      data_prova: input.dataProva ?? null,
      status: 'rascunho',
    })
    .select('id')
    .single()

  if (errConcurso || !concursoCriado) {
    return { ok: false, erro: `Falha ao criar concurso: ${errConcurso?.message ?? 'sem dados'}` }
  }
  const concursoId = concursoCriado.id

  // 2) Persiste edital bruto
  const { error: errEdital } = await supabase.from('editais_raw').insert({
    concurso_id: concursoId,
    texto_bruto: input.textoEdital,
    fonte: 'colado',
    versao: 1,
  })
  if (errEdital) {
    return {
      ok: false,
      erro: `Falha ao persistir edital bruto: ${errEdital.message}`,
      concursoId,
    }
  }

  // 3) Dispara pipeline IA
  const ctx: ContextoConcurso = {
    concursoId,
    concursoNome: input.nome,
    banca: input.banca,
    cargo: input.cargo,
    nivel: input.nivelProfundidade,
    horasTotaisCronograma: input.horasTotaisCronograma,
  }

  let resultado
  try {
    resultado = await processarEdital(input.textoEdital, ctx)
  } catch (e) {
    if (e instanceof IAResponseError) {
      return {
        ok: false,
        erro: e.message,
        etapa: e.etapa,
        disciplina: e.disciplina,
        concursoId,
      }
    }
    return {
      ok: false,
      erro: e instanceof Error ? e.message : String(e),
      concursoId,
    }
  }

  // 4) Persiste a árvore
  let totais
  try {
    totais = await persistirArvoreEdital({
      concursoId,
      disciplinas: resultado.disciplinasEstruturadas,
    })
  } catch (e) {
    return {
      ok: false,
      erro: e instanceof Error ? e.message : String(e),
      etapa: 'persistencia',
      concursoId,
    }
  }

  // 5) Move concurso pra status revisao
  await supabase
    .from('concursos')
    .update({ status: 'revisao' })
    .eq('id', concursoId)

  // 6) Registra evento de conclusão
  await supabase.from('eventos').insert({
    tipo: 'edital_processado',
    payload: {
      concurso_id: concursoId,
      totais,
      custo: resultado.custoTotal,
      alertas_count: resultado.alertasGerais.length,
    } as unknown as Record<string, unknown>,
  })

  revalidatePath('/v3/admin/concursos')
  revalidatePath(`/v3/admin/concursos/${concursoId}/revisar`)

  return {
    ok: true,
    concursoId,
    totais: {
      disciplinas: totais.totalDisciplinas,
      blocos: totais.totalBlocos,
      topicos: totais.totalTopicos,
      subtopicos: totais.totalSubtopicos,
    },
    custoBrl: resultado.custoTotal.cost_brl,
    alertas: resultado.alertasGerais,
  }
}
