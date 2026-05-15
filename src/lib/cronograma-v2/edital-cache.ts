import type { SupabaseClient } from '@supabase/supabase-js'
import { CacheCorruptionError } from './errors'
import {
  editalDecomposicaoSchema,
  type EditalDecomposicao,
} from './schemas'

export interface CachedEntry {
  cargo_id: number
  edital_id: number
  payload_hash: string
  decomposicao: EditalDecomposicao
  ai_model: string
  generated_at: string
  last_validated_at: string
}

/**
 * Lê uma entrada do cache. Retorna null se não existir.
 * Valida o JSONB via Zod — se corrompido, lança CacheCorruptionError
 * (caller decide se ignora cache e re-gera).
 */
export async function getCachedDecomposicao(
  supabase: SupabaseClient,
  cargoId: number,
  editalId: number,
): Promise<CachedEntry | null> {
  const { data, error } = await supabase
    .from('edital_cache')
    .select('*')
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const validated = editalDecomposicaoSchema.safeParse(data.decomposicao)
  if (!validated.success) {
    throw new CacheCorruptionError(
      `entry (cargo=${cargoId}, edital=${editalId}) failed schema: ${validated.error.message}`,
    )
  }

  return {
    cargo_id: data.cargo_id,
    edital_id: data.edital_id,
    payload_hash: data.payload_hash,
    decomposicao: validated.data,
    ai_model: data.ai_model,
    generated_at: data.generated_at,
    last_validated_at: data.last_validated_at,
  }
}

/**
 * Upsert na entrada do cache. Atomic — last_validated_at sempre = NOW().
 */
export async function upsertCachedDecomposicao(
  supabase: SupabaseClient,
  args: {
    cargoId: number
    editalId: number
    payloadHash: string
    decomposicao: EditalDecomposicao
    aiModel: string
  },
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .upsert({
      cargo_id: args.cargoId,
      edital_id: args.editalId,
      payload_hash: args.payloadHash,
      decomposicao: args.decomposicao,
      ai_model: args.aiModel,
      last_validated_at: new Date().toISOString(),
    }, { onConflict: 'cargo_id,edital_id' })

  if (error) throw error
}

/**
 * Atualiza só last_validated_at quando hash bate (revalida o cache).
 */
export async function touchCacheValidation(
  supabase: SupabaseClient,
  cargoId: number,
  editalId: number,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({ last_validated_at: new Date().toISOString() })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}
