export { syncEdital, type SyncEditalOptions, type SyncEditalResult } from './sync-edital'
export { decomposeTopico, fallbackDecompose, type DecomposeOptions } from './topico-decomposer'
export {
  getCachedDecomposicao,
  upsertCachedDecomposicao,
  touchCacheValidation,
  type CachedEntry,
} from './edital-cache'
export { computeEditalPayloadHash } from './hash'
export {
  editalGraphQLSchema,
  topicoDecomposedSchema,
  editalDecomposicaoSchema,
  type EditalGraphQL,
  type TopicoDecomposed,
  type EditalDecomposicao,
  type SubtopicoDecomposed,
} from './schemas'
export {
  EditalNotFoundError,
  IADecompositionError,
  CacheCorruptionError,
  RateLimitExceededError,
} from './errors'
