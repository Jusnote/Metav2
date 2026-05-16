// Orquestrador do pipeline de parsing de edital — Fase 2
// Ref: public/PLANO COACHING/plano/05-prompts-ia.md (seção "Orquestrador")
//
// Fluxo:
//   1. dividirDisciplinas(texto)         → DisciplinaBruta[]
//   2. estimarHoras(disciplinas, ctx)    → HorasDisciplina[]
//   3. estruturarDisciplina(...) ×N      → DisciplinaEstruturada[] (paralelo, p-limit)

import pLimit from 'p-limit'
import { anthropic } from './client'
import { calcularCusto, registrarEventoIaCall } from './custo'
import { buildDividirDisciplinasPrompt } from './prompts/dividir-disciplinas'
import {
  buildEstimarHorasPrompt,
  type EstimarHorasParams,
} from './prompts/estimar-horas'
import {
  buildEstruturarDisciplinaPrompt,
  type EstruturarDisciplinaParams,
} from './prompts/estruturar-disciplina'
import {
  DisciplinasBrutasSchema,
  DisciplinaEstruturadaSchema,
  HorasPorDisciplinaSchema,
  IAResponseError,
  type DisciplinaBruta,
  type DisciplinaEstruturada,
  type HorasDisciplina,
} from './schemas'

const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 8000
const CONCORRENCIA_ESTRUTURAR = 3 // 3 chamadas IA simultâneas (doc 05)

export interface ContextoConcurso {
  concursoId?: string
  concursoNome: string
  banca: string
  cargo: string
  nivel: 'basico' | 'intermediario' | 'avancado'
  horasTotaisCronograma: number // horas alocadas ao concurso como um todo
}

export interface ResultadoParseEdital {
  contexto: ContextoConcurso
  disciplinasBrutas: DisciplinaBruta[]
  horasEstimadas: HorasDisciplina[]
  disciplinasEstruturadas: DisciplinaEstruturada[]
  custoTotal: {
    input_tokens: number
    output_tokens: number
    cost_usd: number
    cost_brl: number
  }
  alertasGerais: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChamadaClaudeResult {
  texto: string
  input_tokens: number
  output_tokens: number
  duracao_ms: number
}

async function chamarClaude(prompt: string): Promise<ChamadaClaudeResult> {
  const t0 = Date.now()
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })
  const duracao_ms = Date.now() - t0

  const bloco = response.content[0]
  if (!bloco || bloco.type !== 'text') {
    throw new Error('Resposta inesperada da IA — sem bloco de texto')
  }

  return {
    texto: bloco.text,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    duracao_ms,
  }
}

/**
 * Tenta extrair JSON de uma resposta que pode vir embrulhada em markdown
 * Tolera ```json ... ``` ou ``` ... ``` em volta
 */
function extrairJson(raw: string): string {
  const trimmed = raw.trim()
  // Remove fence de markdown se presente
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  if (fenceMatch) return fenceMatch[1].trim()
  return trimmed
}

// ---------------------------------------------------------------------------
// Etapa 1 — Dividir
// ---------------------------------------------------------------------------

export async function dividirDisciplinas(
  textoEdital: string,
  ctx?: { concursoId?: string },
): Promise<{ disciplinas: DisciplinaBruta[]; custo: ChamadaClaudeResult }> {
  const prompt = buildDividirDisciplinasPrompt(textoEdital)
  let chamada: ChamadaClaudeResult
  try {
    chamada = await chamarClaude(prompt)
  } catch (e) {
    await registrarEventoIaCall({
      etapa: 'dividir',
      model: MODEL,
      concurso_id: ctx?.concursoId,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      cost_brl: 0,
      duracao_ms: 0,
      status: 'erro',
      erro: e instanceof Error ? e.message : String(e),
    })
    throw new IAResponseError('dividir', '', e)
  }

  const custo = calcularCusto(chamada.input_tokens, chamada.output_tokens)
  await registrarEventoIaCall({
    etapa: 'dividir',
    model: MODEL,
    concurso_id: ctx?.concursoId,
    input_tokens: chamada.input_tokens,
    output_tokens: chamada.output_tokens,
    cost_usd: custo.cost_usd,
    cost_brl: custo.cost_brl,
    duracao_ms: chamada.duracao_ms,
    status: 'ok',
  })

  try {
    const json = JSON.parse(extrairJson(chamada.texto))
    const validated = DisciplinasBrutasSchema.parse(json)
    return { disciplinas: validated, custo: chamada }
  } catch (e) {
    throw new IAResponseError('dividir', chamada.texto, e)
  }
}

// ---------------------------------------------------------------------------
// Etapa 2 — Estimar horas
// ---------------------------------------------------------------------------

export async function estimarHoras(
  disciplinas: DisciplinaBruta[],
  ctx: ContextoConcurso,
): Promise<{ horas: HorasDisciplina[]; custo: ChamadaClaudeResult }> {
  const params: EstimarHorasParams = {
    banca: ctx.banca,
    cargo: ctx.cargo,
    disciplinas,
    horasTotais: ctx.horasTotaisCronograma,
  }
  const prompt = buildEstimarHorasPrompt(params)

  let chamada: ChamadaClaudeResult
  try {
    chamada = await chamarClaude(prompt)
  } catch (e) {
    await registrarEventoIaCall({
      etapa: 'estimar',
      model: MODEL,
      concurso_id: ctx.concursoId,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      cost_brl: 0,
      duracao_ms: 0,
      status: 'erro',
      erro: e instanceof Error ? e.message : String(e),
    })
    throw new IAResponseError('estimar', '', e)
  }

  const custo = calcularCusto(chamada.input_tokens, chamada.output_tokens)
  await registrarEventoIaCall({
    etapa: 'estimar',
    model: MODEL,
    concurso_id: ctx.concursoId,
    input_tokens: chamada.input_tokens,
    output_tokens: chamada.output_tokens,
    cost_usd: custo.cost_usd,
    cost_brl: custo.cost_brl,
    duracao_ms: chamada.duracao_ms,
    status: 'ok',
  })

  try {
    const json = JSON.parse(extrairJson(chamada.texto))
    const validated = HorasPorDisciplinaSchema.parse(json)
    return { horas: validated, custo: chamada }
  } catch (e) {
    throw new IAResponseError('estimar', chamada.texto, e)
  }
}

// ---------------------------------------------------------------------------
// Etapa 3 — Estruturar disciplina
// ---------------------------------------------------------------------------

export async function estruturarDisciplina(
  params: EstruturarDisciplinaParams,
  ctx?: { concursoId?: string },
): Promise<{ estruturada: DisciplinaEstruturada; custo: ChamadaClaudeResult }> {
  const prompt = buildEstruturarDisciplinaPrompt(params)

  let chamada: ChamadaClaudeResult
  try {
    chamada = await chamarClaude(prompt)
  } catch (e) {
    await registrarEventoIaCall({
      etapa: 'estruturar',
      model: MODEL,
      concurso_id: ctx?.concursoId,
      disciplina: params.concursoNome ? `${params.concursoNome}` : undefined,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      cost_brl: 0,
      duracao_ms: 0,
      status: 'erro',
      erro: e instanceof Error ? e.message : String(e),
    })
    throw new IAResponseError('estruturar', '', e, params.concursoNome)
  }

  const custo = calcularCusto(chamada.input_tokens, chamada.output_tokens)
  await registrarEventoIaCall({
    etapa: 'estruturar',
    model: MODEL,
    concurso_id: ctx?.concursoId,
    input_tokens: chamada.input_tokens,
    output_tokens: chamada.output_tokens,
    cost_usd: custo.cost_usd,
    cost_brl: custo.cost_brl,
    duracao_ms: chamada.duracao_ms,
    status: 'ok',
  })

  try {
    const json = JSON.parse(extrairJson(chamada.texto))
    const validated = DisciplinaEstruturadaSchema.parse(json)
    return { estruturada: validated, custo: chamada }
  } catch (e) {
    throw new IAResponseError('estruturar', chamada.texto, e, params.concursoNome)
  }
}

// ---------------------------------------------------------------------------
// Pipeline completo
// ---------------------------------------------------------------------------

export async function processarEdital(
  textoEdital: string,
  contexto: ContextoConcurso,
): Promise<ResultadoParseEdital> {
  const limit = pLimit(CONCORRENCIA_ESTRUTURAR)

  // Etapa 1 — dividir
  const { disciplinas: disciplinasBrutas, custo: c1 } = await dividirDisciplinas(
    textoEdital,
    { concursoId: contexto.concursoId },
  )

  // Etapa 2 — estimar horas
  const { horas: horasEstimadas, custo: c2 } = await estimarHoras(disciplinasBrutas, contexto)

  // Mapa nome → horas
  const horasPorNome = new Map<string, number>()
  for (const h of horasEstimadas) {
    horasPorNome.set(h.disciplina, h.horas)
  }
  // Fallback: divide igualmente quando IA não casa o nome
  const horasFallback =
    contexto.horasTotaisCronograma / Math.max(1, disciplinasBrutas.length)

  // Etapa 3 — estruturar em paralelo (p-limit 3)
  const tasks = disciplinasBrutas.map((d) =>
    limit(() =>
      estruturarDisciplina(
        {
          concursoNome: `${contexto.concursoNome} — ${d.nome_canonico}`,
          banca: contexto.banca,
          cargo: contexto.cargo,
          nivel: contexto.nivel,
          horasTotais: horasPorNome.get(d.nome_canonico) ?? horasFallback,
          textoDisciplina: d.texto_bruto,
        },
        { concursoId: contexto.concursoId },
      ).catch((e) => {
        // Bubble com contexto da disciplina pra UI poder permitir retry granular
        if (e instanceof IAResponseError) throw e
        throw new IAResponseError('estruturar', '', e, d.nome_canonico)
      }),
    ),
  )

  const results = await Promise.all(tasks)
  const disciplinasEstruturadas = results.map((r) => r.estruturada)

  // Soma custos
  const totalInput =
    c1.input_tokens +
    c2.input_tokens +
    results.reduce((s, r) => s + r.custo.input_tokens, 0)
  const totalOutput =
    c1.output_tokens +
    c2.output_tokens +
    results.reduce((s, r) => s + r.custo.output_tokens, 0)
  const custoTotal = calcularCusto(totalInput, totalOutput)

  // Agrega alertas
  const alertasGerais = disciplinasEstruturadas.flatMap((d) =>
    d.alertas_para_validacao_humana.map((a) => `[${d.disciplina}] ${a}`),
  )

  return {
    contexto,
    disciplinasBrutas,
    horasEstimadas,
    disciplinasEstruturadas,
    custoTotal: {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cost_usd: custoTotal.cost_usd,
      cost_brl: custoTotal.cost_brl,
    },
    alertasGerais,
  }
}
