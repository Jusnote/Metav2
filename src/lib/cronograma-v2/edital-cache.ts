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

export type CacheStatus = 'draft' | 'published' | 'archived'

export interface CachedEntryWithStatus extends CachedEntry {
  status: CacheStatus
  published_at: string | null
  published_by: string | null
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

// ============================================================================
// Status-aware helpers (curadoria admin — Sub-plan 5)
// ============================================================================

/**
 * Lê só entries publicados — usado pelo setup wizard.
 */
export async function getPublishedDecomposicao(
  supabase: SupabaseClient,
  cargoId: number,
  editalId: number,
): Promise<CachedEntry | null> {
  const { data, error } = await supabase
    .from('edital_cache')
    .select('*')
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const validated = editalDecomposicaoSchema.safeParse(data.decomposicao)
  if (!validated.success) throw new CacheCorruptionError(validated.error.message)
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
 * Lista todos cargos com status agregado (admin only).
 */
export async function listEditaisCurados(
  supabase: SupabaseClient,
): Promise<Array<{
  cargo_id: number
  edital_id: number
  status: CacheStatus
  generated_at: string
  last_validated_at: string
  published_at: string | null
  topicos_count: number
}>> {
  const { data, error } = await supabase
    .from('edital_cache')
    .select('cargo_id, edital_id, status, generated_at, last_validated_at, published_at, decomposicao')
    .order('last_validated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    cargo_id: row.cargo_id,
    edital_id: row.edital_id,
    status: row.status as CacheStatus,
    generated_at: row.generated_at,
    last_validated_at: row.last_validated_at,
    published_at: row.published_at ?? null,
    topicos_count: Object.keys(
      ((row.decomposicao as { by_topico?: Record<string, unknown> }) ?? {})?.by_topico ?? {},
    ).length,
  }))
}

/**
 * Marca um entry como published, gravando quem publicou e quando.
 */
export async function markCachePublished(
  supabase: SupabaseClient,
  cargoId: number,
  editalId: number,
  adminUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: adminUserId,
    })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}

/**
 * Arquiva um entry (remove da disponibilidade pública).
 */
export async function markCacheArchived(
  supabase: SupabaseClient,
  cargoId: number,
  editalId: number,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({ status: 'archived' })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}

/**
 * Salva edição manual do JSONB decomposicao (admin edita árvore inline).
 * Atualiza last_validated_at para refletir a revisão manual.
 */
export async function updateDecomposicao(
  supabase: SupabaseClient,
  cargoId: number,
  editalId: number,
  decomposicao: EditalDecomposicao,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({ decomposicao, last_validated_at: new Date().toISOString() })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}
