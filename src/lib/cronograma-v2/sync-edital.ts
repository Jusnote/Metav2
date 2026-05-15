import pLimit from 'p-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCachedDecomposicao,
  upsertCachedDecomposicao,
  touchCacheValidation,
} from './edital-cache'
import { computeEditalPayloadHash } from './hash'
import { decomposeTopico, fallbackDecompose } from './topico-decomposer'
import {
  type EditalGraphQL,
  type EditalDecomposicao,
  type TopicoDecomposed,
} from './schemas'

const SHOULD_DECOMPOSE_THRESHOLD_CHARS = 200
const SHOULD_DECOMPOSE_THRESHOLD_KEYWORDS = 3
const MAX_PARALLEL_AI_CALLS = 3

const DECOMPOSE_KEYWORDS = [' e ', ',', ';', ':', ' - ', '/']

function shouldDecomposeWithAI(topicoNome: string): boolean {
  if (topicoNome.length >= SHOULD_DECOMPOSE_THRESHOLD_CHARS) return true
  const matches = DECOMPOSE_KEYWORDS.filter(k => topicoNome.includes(k)).length
  return matches >= SHOULD_DECOMPOSE_THRESHOLD_KEYWORDS
}

export interface SyncEditalOptions {
  /** Força refresh ignorando cache. */
  forceRefresh?: boolean
  /** Força fallback sem chamar IA (testes, ou quando cap diário foi atingido). */
  skipAI?: boolean
  /** Callback de progresso (útil pra UI). */
  onProgress?: (done: number, total: number) => void
}

export interface SyncEditalResult {
  cacheHit: boolean
  decomposicao: EditalDecomposicao
  payload_hash: string
  decomposed_topicos: number
  fallback_topicos: number
  total_topicos: number
}

export async function syncEdital(
  supabase: SupabaseClient,
  edital: EditalGraphQL,
  options: SyncEditalOptions = {},
): Promise<SyncEditalResult> {
  // 1. Hash composto
  const currentHash = computeEditalPayloadHash({
    disciplinas: edital.disciplinas,
    topicos: edital.topicos,
  })

  // 2. Cache lookup
  if (!options.forceRefresh) {
    const cached = await getCachedDecomposicao(supabase, edital.cargo_id, edital.edital_id)
      .catch(() => null)  // CacheCorruptionError → refaz

    if (cached && cached.payload_hash === currentHash) {
      await touchCacheValidation(supabase, edital.cargo_id, edital.edital_id).catch(() => {})
      return {
        cacheHit: true,
        decomposicao: cached.decomposicao,
        payload_hash: cached.payload_hash,
        decomposed_topicos: cached.decomposicao.metadata.decomposed_count,
        fallback_topicos: cached.decomposicao.metadata.fallback_count,
        total_topicos: cached.decomposicao.metadata.total_topicos,
      }
    }
  }

  // 3. Decompose miss: paraleliza com p-limit
  const limit = pLimit(MAX_PARALLEL_AI_CALLS)
  let decomposedCount = 0
  let fallbackCount = 0
  const totalTopicos = edital.topicos.length
  let processed = 0

  const results = await Promise.all(
    edital.topicos.map(t => limit(async () => {
      let result: TopicoDecomposed

      if (shouldDecomposeWithAI(t.nome) && !options.skipAI) {
        const decomp = await decomposeTopico(t.nome)
        result = decomp.result
        if (decomp.usedFallback) fallbackCount++; else decomposedCount++
      } else {
        result = fallbackDecompose(t.nome)
        fallbackCount++
      }

      processed++
      options.onProgress?.(processed, totalTopicos)

      return [String(t.id), result] as const
    })),
  )

  const byTopico = Object.fromEntries(results)

  const decomposicao: EditalDecomposicao = {
    by_topico: byTopico,
    metadata: {
      ai_model: options.skipAI ? 'fallback-regex' : 'claude-haiku-4-5-20251001',
      decomposed_at: new Date().toISOString(),
      total_topicos: totalTopicos,
      decomposed_count: decomposedCount,
      fallback_count: fallbackCount,
    },
  }

  // 4. Upsert cache
  await upsertCachedDecomposicao(supabase, {
    cargoId: edital.cargo_id,
    editalId: edital.edital_id,
    payloadHash: currentHash,
    decomposicao,
    aiModel: decomposicao.metadata.ai_model,
  })

  return {
    cacheHit: false,
    decomposicao,
    payload_hash: currentHash,
    decomposed_topicos: decomposedCount,
    fallback_topicos: fallbackCount,
    total_topicos: totalTopicos,
  }
}
