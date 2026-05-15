import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fallbackDecompose, decomposeTopico } from '../topico-decomposer'

// Mock @ai-sdk/anthropic + ai
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: (model: string) => ({ modelId: model }),
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

import { generateText } from 'ai'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fallbackDecompose', () => {
  it('returns single subtopico for short input', () => {
    const r = fallbackDecompose('Princípios fundamentais')
    expect(r.subtopicos).toHaveLength(1)
    expect(r.subtopicos[0].duracao_min).toBe(45)
    expect(r.nome_curto).toBe('Princípios fundamentais')
  })

  it('truncates long topic name to 60/200 chars', () => {
    const long = 'X'.repeat(300)
    const r = fallbackDecompose(long)
    expect(r.nome_curto.length).toBeLessThanOrEqual(60)
    expect(r.subtopicos[0].nome.length).toBeLessThanOrEqual(200)
  })
})

describe('decomposeTopico', () => {
  it('returns IA result on success', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({
        nome_curto: 'Licitações',
        conceitos_pai: ['Licitações'],
        subtopicos: [
          { nome: 'Licitações - Pregão', duracao_min: 50, conceito_pai: 'Licitações' },
          { nome: 'Licitações - RDC', duracao_min: 45, conceito_pai: 'Licitações' },
        ],
        referencias_legais: ['Lei 14.133/21'],
      }),
    } as any)

    const r = await decomposeTopico('Licitações e contratos administrativos')
    expect(r.usedFallback).toBe(false)
    expect(r.result.subtopicos).toHaveLength(2)
    expect(r.aiModel).toContain('haiku')
  })

  it('strips ```json fences from Claude output', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '```json\n{"nome_curto":"XX","conceitos_pai":["AA"],"subtopicos":[{"nome":"AA - sub","duracao_min":30,"conceito_pai":"AA"}],"referencias_legais":[]}\n```',
    } as any)

    const r = await decomposeTopico('Tópico teste')
    expect(r.usedFallback).toBe(false)
    expect(r.result.nome_curto).toBe('XX')
  })

  it('falls back when IA returns invalid JSON', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'not json' } as any)
    const r = await decomposeTopico('Tópico teste')
    expect(r.usedFallback).toBe(true)
    expect(r.aiModel).toBe('fallback-regex')
  })

  it('falls back when IA returns JSON failing schema', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"nome_curto":"X","conceitos_pai":[],"subtopicos":[],"referencias_legais":[]}',  // empty subtopicos = invalid
    } as any)
    const r = await decomposeTopico('Tópico teste')
    expect(r.usedFallback).toBe(true)
  })

  it('skipAI option uses fallback immediately', async () => {
    const r = await decomposeTopico('X', { skipAI: true })
    expect(r.usedFallback).toBe(true)
    expect(generateText).not.toHaveBeenCalled()
  })
})
