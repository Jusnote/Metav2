import { describe, it, expect } from 'vitest'
import {
  editalGraphQLSchema,
  topicoDecomposedSchema,
  subtopicoDecomposedSchema,
} from '../schemas'

describe('schemas', () => {
  it('rejects edital with empty disciplina name', () => {
    expect(() => editalGraphQLSchema.parse({
      cargo_id: 1, edital_id: 1, cargo_nome: 'X',
      disciplinas: [{ id: 1, nome: '' }],
      topicos: [],
    })).toThrow()
  })

  it('accepts valid subtopico', () => {
    expect(() => subtopicoDecomposedSchema.parse({
      nome: 'Licitações - Pregão',
      duracao_min: 50,
      conceito_pai: 'Licitações',
    })).not.toThrow()
  })

  it('rejects subtopico with duracao_min > 120', () => {
    expect(() => subtopicoDecomposedSchema.parse({
      nome: 'X',
      duracao_min: 999,
      conceito_pai: 'Y',
    })).toThrow()
  })

  it('topicoDecomposed needs at least 1 subtopico', () => {
    expect(() => topicoDecomposedSchema.parse({
      nome_curto: 'Test',
      conceitos_pai: ['A'],
      subtopicos: [],
      referencias_legais: [],
    })).toThrow()
  })
})
