import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncEdital } from '../sync-edital'
import * as cacheMod from '../edital-cache'
import * as decomposerMod from '../topico-decomposer'

vi.mock('../edital-cache')
vi.mock('../topico-decomposer')

const validDecomp = (n = 1) => ({
  by_topico: Object.fromEntries(Array.from({ length: n }, (_, i) => [
    String(i + 1),
    {
      nome_curto: `T${i}`,
      conceitos_pai: ['c'],
      subtopicos: [{ nome: 'c - s', duracao_min: 30, conceito_pai: 'c' }],
      referencias_legais: [],
    },
  ])),
  metadata: {
    ai_model: 'claude-haiku-4-5-20251001',
    decomposed_at: '2026-05-15',
    total_topicos: n,
    decomposed_count: n,
    fallback_count: 0,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('syncEdital', () => {
  const baseEdital = {
    cargo_id: 1,
    edital_id: 1,
    cargo_nome: 'Test',
    disciplinas: [{ id: 1, nome: 'X' }],
    topicos: [
      { id: 1, disciplina_id: 1, nome: 'Tópico curto' },
      { id: 2, disciplina_id: 1, nome: 'Tópico longo, com e várias, ideias' },
    ],
  }

  it('returns cached result when hash matches', async () => {
    const cached = {
      cargo_id: 1, edital_id: 1, payload_hash: 'whatever',
      decomposicao: validDecomp(2),
      ai_model: 'claude-haiku-4-5-20251001',
      generated_at: '2026-05-15', last_validated_at: '2026-05-15',
    }
    // Patch hash to match the cached entry's hash
    vi.spyOn(await import('../hash'), 'computeEditalPayloadHash').mockReturnValue('whatever')
    vi.mocked(cacheMod.getCachedDecomposicao).mockResolvedValue(cached as any)
    vi.mocked(cacheMod.touchCacheValidation).mockResolvedValue()

    const r = await syncEdital({} as any, baseEdital)
    expect(r.cacheHit).toBe(true)
    expect(cacheMod.touchCacheValidation).toHaveBeenCalled()
    expect(decomposerMod.decomposeTopico).not.toHaveBeenCalled()
  })

  it('decomposes when cache misses', async () => {
    vi.mocked(cacheMod.getCachedDecomposicao).mockResolvedValue(null)
    vi.mocked(cacheMod.upsertCachedDecomposicao).mockResolvedValue()
    vi.mocked(decomposerMod.decomposeTopico).mockResolvedValue({
      result: validDecomp(1).by_topico['1'],
      usedFallback: false,
      aiModel: 'claude-haiku-4-5-20251001',
    })
    vi.mocked(decomposerMod.fallbackDecompose).mockReturnValue(validDecomp(1).by_topico['1'])

    const r = await syncEdital({} as any, baseEdital)
    expect(r.cacheHit).toBe(false)
    expect(cacheMod.upsertCachedDecomposicao).toHaveBeenCalled()
  })

  it('forceRefresh bypasses cache lookup', async () => {
    vi.mocked(cacheMod.upsertCachedDecomposicao).mockResolvedValue()
    vi.mocked(decomposerMod.fallbackDecompose).mockReturnValue(validDecomp(1).by_topico['1'])

    await syncEdital({} as any, baseEdital, { forceRefresh: true, skipAI: true })
    expect(cacheMod.getCachedDecomposicao).not.toHaveBeenCalled()
    expect(cacheMod.upsertCachedDecomposicao).toHaveBeenCalled()
  })

  it('skipAI uses fallback for all topicos', async () => {
    vi.mocked(cacheMod.getCachedDecomposicao).mockResolvedValue(null)
    vi.mocked(cacheMod.upsertCachedDecomposicao).mockResolvedValue()
    vi.mocked(decomposerMod.fallbackDecompose).mockReturnValue(validDecomp(1).by_topico['1'])

    const r = await syncEdital({} as any, baseEdital, { skipAI: true })
    expect(decomposerMod.decomposeTopico).not.toHaveBeenCalled()
    expect(r.fallback_topicos).toBe(2)
    expect(r.decomposed_topicos).toBe(0)
  })
})
