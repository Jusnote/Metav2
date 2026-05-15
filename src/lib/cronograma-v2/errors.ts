// Erros do sub-sistema sync-edital + decomposição IA

export class EditalNotFoundError extends Error {
  constructor(cargoId: number, editalId: number) {
    super(`Edital ${editalId} do cargo ${cargoId} não encontrado no GraphQL`)
    this.name = 'EditalNotFoundError'
  }
}

export class IADecompositionError extends Error {
  constructor(
    public readonly topicoNome: string,
    public readonly cause: unknown,
  ) {
    super(`Falha ao decompor tópico "${topicoNome}": ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'IADecompositionError'
  }
}

export class CacheCorruptionError extends Error {
  constructor(message: string) {
    super(`Cache corrompido: ${message}`)
    this.name = 'CacheCorruptionError'
  }
}

export class RateLimitExceededError extends Error {
  constructor(public readonly action: string, public readonly retryAfterSeconds: number) {
    super(`Rate limit excedido para "${action}". Tente novamente em ${retryAfterSeconds}s`)
    this.name = 'RateLimitExceededError'
  }
}
