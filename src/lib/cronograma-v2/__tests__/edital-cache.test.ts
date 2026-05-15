import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCachedDecomposicao,
  upsertCachedDecomposicao,
} from '../edital-cache'
import { CacheCorruptionError } from '../errors'

function mockSupabase(impl: any) {
  return { from: vi.fn(() => impl) } as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCachedDecomposicao', () => {
  it('returns null when entry missing', async () => {
    const supa = mockSupabase({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    })
    const result = await getCachedDecomposicao(supa, 1, 1)
    expect(result).toBeNull()
  })

  it('throws CacheCorruptionError when decomposicao fails schema', async () => {
    const supa = mockSupabase({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                cargo_id: 1, edital_id: 1, payload_hash: 'abc',
                decomposicao: { invalid: 'data' },
                ai_model: 'x', generated_at: '2026-05-15', last_validated_at: '2026-05-15',
              },
              error: null,
            }),
          }),
        }),
      }),
    })
    await expect(getCachedDecomposicao(supa, 1, 1)).rejects.toThrow(CacheCorruptionError)
  })

  it('returns parsed entry on valid data', async () => {
    const validDecomp = {
      by_topico: {
        '11': {
          nome_curto: 'Princípios',
          conceitos_pai: ['Princípios'],
          subtopicos: [{ nome: 'Princípios - geral', duracao_min: 45, conceito_pai: 'Princípios' }],
          referencias_legais: [],
        },
      },
      metadata: {
        ai_model: 'claude-haiku-4-5-20251001',
        decomposed_at: '2026-05-15T12:00:00.000Z',
        total_topicos: 1,
        decomposed_count: 1,
        fallback_count: 0,
      },
    }
    const supa = mockSupabase({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                cargo_id: 1, edital_id: 1, payload_hash: 'abc',
                decomposicao: validDecomp,
                ai_model: 'claude-haiku-4-5-20251001',
                generated_at: '2026-05-15T12:00:00.000Z',
                last_validated_at: '2026-05-15T12:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    })
    const result = await getCachedDecomposicao(supa, 1, 1)
    expect(result?.payload_hash).toBe('abc')
    expect(Object.keys(result?.decomposicao.by_topico ?? {})).toHaveLength(1)
  })
})

describe('upsertCachedDecomposicao', () => {
  it('calls upsert with the right onConflict key', async () => {
    const upsert = vi.fn().mockReturnValue(Promise.resolve({ error: null }))
    const supa = mockSupabase({ upsert })
    await upsertCachedDecomposicao(supa, {
      cargoId: 1, editalId: 1, payloadHash: 'h', aiModel: 'm',
      decomposicao: {
        by_topico: {},
        metadata: { ai_model: 'm', decomposed_at: '2026-05-15', total_topicos: 0, decomposed_count: 0, fallback_count: 0 },
      },
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ cargo_id: 1, edital_id: 1, payload_hash: 'h' }),
      { onConflict: 'cargo_id,edital_id' },
    )
  })
})
