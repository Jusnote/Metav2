// Smoke test seco (sem chamadas API) para os builders + schemas Zod.
// Roda via: node --experimental-strip-types src/v3/lib/anthropic/__smoke__/verify-prompts.ts
// (ou via npx tsx quando instalado)
//
// Garantias:
//   1. Os 3 prompt builders substituem os placeholders sem deixar {LACUNAS}.
//   2. Os schemas Zod aceitam o exemplo few-shot do doc 05.
//   3. Os schemas rejeitam payloads inválidos com mensagem útil.

// Extensões .ts explícitas: o smoke roda via `node --experimental-strip-types`
// (sem bundler/resolver custom). TypeScript ainda compila normal porque o
// resolution: bundler aceita ambas.
import { buildDividirDisciplinasPrompt } from '../prompts/dividir-disciplinas.ts'
import { buildEstimarHorasPrompt } from '../prompts/estimar-horas.ts'
import { buildEstruturarDisciplinaPrompt } from '../prompts/estruturar-disciplina.ts'
import {
  DisciplinaEstruturadaSchema,
  DisciplinasBrutasSchema,
  HorasPorDisciplinaSchema,
} from '../schemas.ts'

let falhas = 0
function teste(nome: string, fn: () => void) {
  try {
    fn()
    console.log(`  PASS  ${nome}`)
  } catch (e) {
    falhas++
    console.error(`  FAIL  ${nome}\n        ${e instanceof Error ? e.message : e}`)
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

console.log('\n[smoke] verify-prompts')

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n1) Builders substituem placeholders')

teste('dividir-disciplinas substitui {TEXTO_EDITAL}', () => {
  const p = buildDividirDisciplinasPrompt('TEXTO DE TESTE')
  assert(!p.includes('{TEXTO_EDITAL}'), 'placeholder não foi substituído')
  assert(p.includes('TEXTO DE TESTE'), 'texto não foi injetado')
})

teste('estruturar-disciplina substitui 6 placeholders', () => {
  const p = buildEstruturarDisciplinaPrompt({
    concursoNome: 'PF Agente',
    banca: 'Cebraspe',
    cargo: 'Agente',
    nivel: 'intermediario',
    horasTotais: 24,
    textoDisciplina: 'TRECHO',
  })
  for (const ph of [
    '{CONCURSO_NOME}',
    '{BANCA}',
    '{CARGO}',
    '{NIVEL}',
    '{HORAS_TOTAIS}',
    '{TEXTO_DISCIPLINA}',
  ]) {
    assert(!p.includes(ph), `placeholder ${ph} residual`)
  }
  assert(p.includes('Cebraspe'), 'banca não injetada')
})

teste('estimar-horas substitui 4 placeholders', () => {
  const p = buildEstimarHorasPrompt({
    banca: 'FGV',
    cargo: 'Auditor',
    disciplinas: [
      { nome_canonico: 'Direito Penal', texto_bruto: 'x'.repeat(2000) },
      { nome_canonico: 'Português', texto_bruto: 'y'.repeat(1500) },
    ],
    horasTotais: 200,
  })
  for (const ph of ['{BANCA}', '{CARGO}', '{LISTA_DISCIPLINAS}', '{HORAS_TOTAIS}']) {
    assert(!p.includes(ph), `placeholder ${ph} residual`)
  }
  assert(p.includes('Direito Penal'), 'disciplina não listada')
  assert(p.includes('200h'), 'horas totais não injetadas')
})

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2) Schemas aceitam output válido')

teste('DisciplinasBrutasSchema aceita lista válida', () => {
  const r = DisciplinasBrutasSchema.parse([
    {
      nome_canonico: 'Português',
      nome_original: 'LÍNGUA PORTUGUESA',
      texto_bruto: '1. Compreensão e interpretação...',
    },
  ])
  assert(r.length === 1, 'count errado')
})

teste('HorasPorDisciplinaSchema aceita lista válida', () => {
  const r = HorasPorDisciplinaSchema.parse([
    { disciplina: 'Direito Penal', horas: 60 },
    { disciplina: 'Português', horas: 40 },
  ])
  assert(r.length === 2, 'count errado')
})

teste('DisciplinaEstruturadaSchema aceita exemplo do doc 05', () => {
  const exemplo = {
    disciplina: 'Contabilidade Geral',
    horas_totais_sugeridas: 24,
    nivel: 'intermediario',
    observacoes_globais: ['Disciplina de peso médio.'],
    blocos: [
      {
        nome: 'Fundamentos',
        horas_bloco: 3,
        ordem: 1,
        topicos: [
          {
            nome: 'Conceitos',
            natureza: 'doutrina',
            peso_incidencia: 2,
            horas_sugeridas: 1.5,
            tipo_revisao: 'leitura_unica_mais_questoes',
            observacao: 'Introdutório.',
            ordem: 1,
            subtopicos: [],
          },
        ],
      },
    ],
    alertas_para_validacao_humana: ['Sem DFC explícito.'],
  }
  const r = DisciplinaEstruturadaSchema.parse(exemplo)
  assert(r.blocos[0].topicos[0].natureza === 'doutrina', 'natureza alterada')
})

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3) Schemas rejeitam payload inválido')

teste('DisciplinasBrutasSchema rejeita lista vazia', () => {
  const r = DisciplinasBrutasSchema.safeParse([])
  assert(!r.success, 'deveria rejeitar')
})

teste('DisciplinaEstruturadaSchema rejeita peso fora de [1,5]', () => {
  const bad = {
    disciplina: 'X',
    horas_totais_sugeridas: 10,
    nivel: 'basico',
    observacoes_globais: [],
    blocos: [
      {
        nome: 'B',
        ordem: 1,
        topicos: [
          {
            nome: 'T',
            natureza: 'doutrina',
            peso_incidencia: 7, // inválido
            horas_sugeridas: 1,
            tipo_revisao: 'x',
            ordem: 1,
            subtopicos: [],
          },
        ],
      },
    ],
    alertas_para_validacao_humana: [],
  }
  const r = DisciplinaEstruturadaSchema.safeParse(bad)
  assert(!r.success, 'deveria rejeitar peso 7')
})

teste('DisciplinaEstruturadaSchema rejeita natureza inválida', () => {
  const bad = {
    disciplina: 'X',
    horas_totais_sugeridas: 10,
    nivel: 'basico',
    observacoes_globais: [],
    blocos: [
      {
        nome: 'B',
        ordem: 1,
        topicos: [
          {
            nome: 'T',
            natureza: 'inventei', // inválido
            peso_incidencia: 3,
            horas_sugeridas: 1,
            tipo_revisao: 'x',
            ordem: 1,
            subtopicos: [],
          },
        ],
      },
    ],
    alertas_para_validacao_humana: [],
  }
  const r = DisciplinaEstruturadaSchema.safeParse(bad)
  assert(!r.success, 'deveria rejeitar natureza inventada')
})

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n[smoke] ${falhas === 0 ? 'OK' : falhas + ' FALHA(S)'}`)
if (falhas > 0) process.exit(1)
