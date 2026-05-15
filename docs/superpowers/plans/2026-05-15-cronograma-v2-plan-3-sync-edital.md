# Cronograma V2 — Sub-plan 3: SyncEditalService + TopicoDecomposer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a camada TypeScript que sincroniza o edital de um cargo (via GraphQL existente) e decompõe tópicos longos em subtópicos estruturados via **Claude Haiku 4.5**. Resultado vai pro `edital_cache` (criado em Sub-plan 1), compartilhado entre todos os users do mesmo cargo. Custo por edital: ~$0.15 amortizado para todos os usuários do cargo.

**Architecture:** Camada `src/lib/cronograma-v2/` com 5 módulos isolados (hash, edital-cache, topico-decomposer, sync-edital, errors). Dois endpoints Next.js Route Handlers (`/api/cronograma-v2/sync-edital` POST e `/api/cronograma-v2/decompose-topico` POST). Cache lookup primeiro; só chama IA em miss. Concurrency via `p-limit(3)`. Validação Zod estrita do output Claude. Fallback regex se IA falha. Hash composto (`MD5(disciplinas + topicos)`) detecta mudanças no edital.

**Tech Stack:**
- `@ai-sdk/anthropic` (já no projeto) com modelo `claude-haiku-4-5-20251001`
- `zod` (já no projeto) pra validação
- `p-limit` (instalar)
- `urql` + cliente existente `editaisClient`
- Supabase JS client (já no projeto) pra ler/gravar `edital_cache`
- `vitest` (verificar; senão usar `jest`/`node:test`)

**Spec ref:** seções 5.1-5.5 e §A do `docs/superpowers/specs/2026-05-14-cronograma-cargo-integration-design.md`.

**Premissas:**
- Sub-plan 1 done: `edital_cache` table existe (cargo_id INT, edital_id INT, payload_hash TEXT, decomposicao JSONB, ai_model TEXT, generated_at, last_validated_at)
- Sub-plan 2 done: RPCs `gerar_cronograma_v2` e `criar_plano_completo` vivos
- `ANTHROPIC_API_KEY` setado em env
- `editaisClient` urql funcional (já usado em `useEditais.ts`)

---

## File Structure

```
src/lib/cronograma-v2/
  index.ts                — public re-exports
  hash.ts                 — composite payload hash (Task 2)
  errors.ts               — typed errors (Task 1)
  schemas.ts              — Zod schemas (Task 3)
  topico-decomposer.ts    — Claude Haiku call (Task 4)
  edital-cache.ts         — Supabase access (Task 5)
  sync-edital.ts          — orchestrator (Task 6)
  __tests__/
    hash.test.ts          (Task 2)
    schemas.test.ts       (Task 3)
    topico-decomposer.test.ts  (Task 4)
    edital-cache.test.ts  (Task 5)
    sync-edital.test.ts   (Task 7)

src/app/api/cronograma-v2/
  sync-edital/
    route.ts              — POST endpoint (Task 8)
  decompose-topico/
    route.ts              — POST single topico (Task 9)

src/hooks/
  useSyncEdital.ts        — frontend hook (Task 10)

docs/cronograma-v2/
  sub-plan-3-applied.md   — final doc (Task 11)
```

---

## Pré-requisitos

- [ ] Sub-plans 1 & 2 verificados no Studio (32 checks PASS)
- [ ] `ANTHROPIC_API_KEY` no `.env.local` (já tem — usado em `/api/ai/explain-alternative`)
- [ ] Acesso à GraphQL editais (`NEXT_PUBLIC_EDITAIS_API_URL`)
- [ ] Branch `cargo-transition-v2`
- [ ] `p-limit` precisa ser instalado (provavelmente ainda não está)

---

### Task 0: Setup — pastas + dependências

**Files:**
- Create: `src/lib/cronograma-v2/.gitkeep` (placeholder pra criar dir)
- Modify: `package.json` (add `p-limit`)

- [ ] **Step 1: Criar diretórios**

```bash
cd "D:/meta novo/Metav2"
mkdir -p src/lib/cronograma-v2/__tests__ src/app/api/cronograma-v2/sync-edital src/app/api/cronograma-v2/decompose-topico
```

- [ ] **Step 2: Instalar p-limit**

```bash
cd "D:/meta novo/Metav2" && npm install p-limit
```

Confirma com `npm ls p-limit` (deve listar versão ^5 ou similar).

- [ ] **Step 3: Verificar vitest disponível**

```bash
cd "D:/meta novo/Metav2" && npx vitest --version 2>&1 | head -5
```

Se sair erro, registrar no commit message — o subagent precisa adaptar pra `jest` ou `node:test`. Se vitest existe, usá-lo.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(cronograma-v2): install p-limit for sync-edital concurrency control"
```

---

### Task 1: Errors tipados — `errors.ts`

**Files:**
- Create: `src/lib/cronograma-v2/errors.ts`

Erros nomeados (não strings) pra que callers possam diferenciar com `instanceof`.

- [ ] **Step 1: Criar arquivo**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cronograma-v2/errors.ts
git commit -m "feat(cronograma-v2): add typed errors for sync-edital subsystem"
```

---

### Task 2: Composite payload hash — `hash.ts` + tests

**Files:**
- Create: `src/lib/cronograma-v2/hash.ts`
- Create: `src/lib/cronograma-v2/__tests__/hash.test.ts`

Hash determinístico do payload do edital (disciplinas + tópicos). Mudança em qualquer nome invalida cache.

- [ ] **Step 1: Criar `hash.ts`**

```typescript
import { createHash } from 'node:crypto'

export type DisciplinaForHash = { id: string | number; nome: string }
export type TopicoForHash = { id: string | number; disciplina_id: string | number; nome: string }

/**
 * Hash composto do edital. Mesma entrada → mesmo hash. Ordem-independente.
 * Spec §5.3.
 */
export function computeEditalPayloadHash(input: {
  disciplinas: DisciplinaForHash[]
  topicos: TopicoForHash[]
}): string {
  const disciplinasPart = input.disciplinas
    .map(d => `${d.id}:${d.nome}`)
    .sort()
    .join('|')

  const topicosPart = input.topicos
    .map(t => `${t.id}:${t.disciplina_id}:${t.nome.slice(0, 50)}`)
    .sort()
    .join('|')

  return createHash('md5').update(`${disciplinasPart}||${topicosPart}`).digest('hex')
}
```

- [ ] **Step 2: Criar test**

```typescript
import { describe, it, expect } from 'vitest'
import { computeEditalPayloadHash } from '../hash'

describe('computeEditalPayloadHash', () => {
  it('produces deterministic output for the same input', () => {
    const input = {
      disciplinas: [{ id: 1, nome: 'Constitucional' }, { id: 2, nome: 'Administrativo' }],
      topicos: [{ id: 11, disciplina_id: 1, nome: 'Princípios' }],
    }
    expect(computeEditalPayloadHash(input)).toBe(computeEditalPayloadHash(input))
  })

  it('is order-independent for disciplinas', () => {
    const a = computeEditalPayloadHash({
      disciplinas: [{ id: 1, nome: 'Constitucional' }, { id: 2, nome: 'Administrativo' }],
      topicos: [],
    })
    const b = computeEditalPayloadHash({
      disciplinas: [{ id: 2, nome: 'Administrativo' }, { id: 1, nome: 'Constitucional' }],
      topicos: [],
    })
    expect(a).toBe(b)
  })

  it('changes when a discipline name changes', () => {
    const a = computeEditalPayloadHash({
      disciplinas: [{ id: 1, nome: 'Constitucional' }],
      topicos: [],
    })
    const b = computeEditalPayloadHash({
      disciplinas: [{ id: 1, nome: 'Constitucional II' }],
      topicos: [],
    })
    expect(a).not.toBe(b)
  })

  it('truncates topico nome to 50 chars (avoids hash explosions)', () => {
    const longName = 'A'.repeat(100)
    const a = computeEditalPayloadHash({
      disciplinas: [],
      topicos: [{ id: 1, disciplina_id: 1, nome: longName }],
    })
    const b = computeEditalPayloadHash({
      disciplinas: [],
      topicos: [{ id: 1, disciplina_id: 1, nome: longName + 'extra' }],
    })
    // Como os primeiros 50 chars são idênticos, hashes devem bater
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 3: Rodar tests**

```bash
cd "D:/meta novo/Metav2" && npx vitest run src/lib/cronograma-v2/__tests__/hash.test.ts
```

Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cronograma-v2/hash.ts src/lib/cronograma-v2/__tests__/hash.test.ts
git commit -m "feat(cronograma-v2): add composite payload hash with tests"
```

---

### Task 3: Zod schemas — `schemas.ts` + tests

**Files:**
- Create: `src/lib/cronograma-v2/schemas.ts`
- Create: `src/lib/cronograma-v2/__tests__/schemas.test.ts`

Schemas pra validar (a) input do GraphQL e (b) output do Claude.

- [ ] **Step 1: Criar `schemas.ts`**

```typescript
import { z } from 'zod'

// ============================================================================
// Input: o que vem do GraphQL editais
// ============================================================================

export const editalGraphQLSchema = z.object({
  cargo_id: z.number().int().positive(),
  edital_id: z.number().int().positive(),
  cargo_nome: z.string().min(1),
  disciplinas: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    nome: z.string().min(1),
  })),
  topicos: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    disciplina_id: z.union([z.string(), z.number()]),
    nome: z.string().min(1),
  })),
})
export type EditalGraphQL = z.infer<typeof editalGraphQLSchema>

// ============================================================================
// Output: o que esperamos do Claude (spec §B do apêndice)
// ============================================================================

export const subtopicoDecomposedSchema = z.object({
  nome: z.string().min(3).max(200),
  duracao_min: z.number().int().min(15).max(120),
  conceito_pai: z.string().min(1).max(80),
})
export type SubtopicoDecomposed = z.infer<typeof subtopicoDecomposedSchema>

export const topicoDecomposedSchema = z.object({
  nome_curto: z.string().min(2).max(60),
  conceitos_pai: z.array(z.string()).min(1).max(5),
  subtopicos: z.array(subtopicoDecomposedSchema).min(1).max(20),
  referencias_legais: z.array(z.string()).default([]),
})
export type TopicoDecomposed = z.infer<typeof topicoDecomposedSchema>

// Resultado da decomposição completa de um edital (gravado em edital_cache.decomposicao)
export const editalDecomposicaoSchema = z.object({
  by_topico: z.record(z.string(), topicoDecomposedSchema),  // chave = topico_id como string
  metadata: z.object({
    ai_model: z.string(),
    decomposed_at: z.string(),  // ISO datetime
    total_topicos: z.number(),
    decomposed_count: z.number(),
    fallback_count: z.number(),
  }),
})
export type EditalDecomposicao = z.infer<typeof editalDecomposicaoSchema>
```

- [ ] **Step 2: Criar test**

```typescript
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
```

- [ ] **Step 3: Rodar tests + commit**

```bash
npx vitest run src/lib/cronograma-v2/__tests__/schemas.test.ts
git add src/lib/cronograma-v2/schemas.ts src/lib/cronograma-v2/__tests__/schemas.test.ts
git commit -m "feat(cronograma-v2): add Zod schemas for edital + decomposition validation"
```

---

### Task 4: `topico-decomposer.ts` + tests com Claude Haiku mockado

**Files:**
- Create: `src/lib/cronograma-v2/topico-decomposer.ts`
- Create: `src/lib/cronograma-v2/__tests__/topico-decomposer.test.ts`

Função `decomposeTopico(topicoNome: string, options?)` que chama Claude Haiku, valida output via Zod, e retorna `TopicoDecomposed`. Fallback regex se IA falhar.

- [ ] **Step 1: Criar `topico-decomposer.ts`**

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { topicoDecomposedSchema, type TopicoDecomposed } from './schemas'
import { IADecompositionError } from './errors'

const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `Você é um especialista em editais de concurso. Dado o texto bruto de um tópico do edital, decomponha em:

1. nome_curto: nome resumido do tópico (3-6 palavras)
2. conceitos_pai: até 3 grupos conceituais (substantivos do tópico)
3. subtopicos: lista com formato "<Conceito-pai> - <Subtópico específico>"
4. referencias_legais: leis/decretos/súmulas extraídos
5. duracao_min: 25 a 75 minutos por subtópico (dependendo da densidade)

Regras estritas:
- Retorne APENAS JSON válido, sem prefácio nem comentários
- nome_curto: 2-60 caracteres
- conceitos_pai: 1 a 5 itens, cada um 1-80 chars
- subtopicos: 1 a 20 itens, nome formato "<Conceito-pai> - <Subtópico>"
- duracao_min: 15-120 minutos
- referencias_legais: array vazio se não houver

Esquema JSON:
{
  "nome_curto": string,
  "conceitos_pai": string[],
  "subtopicos": [
    { "nome": string, "duracao_min": number, "conceito_pai": string }
  ],
  "referencias_legais": string[]
}`

export interface DecomposeOptions {
  /** Se TRUE, força fallback regex (não chama IA). Usado em ambiente de teste. */
  skipAI?: boolean
  /** Timeout em ms para a chamada Claude. Default 30s. */
  timeoutMs?: number
}

export async function decomposeTopico(
  topicoNome: string,
  options: DecomposeOptions = {},
): Promise<{ result: TopicoDecomposed; usedFallback: boolean; aiModel: string }> {
  if (options.skipAI) {
    return { result: fallbackDecompose(topicoNome), usedFallback: true, aiModel: 'fallback-regex' }
  }

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 30000)

    const { text } = await generateText({
      model: anthropic(CLAUDE_HAIKU_MODEL),
      system: SYSTEM_PROMPT,
      prompt: `TÓPICO DO EDITAL: <<<${topicoNome}>>>`,
      abortSignal: ctrl.signal,
    })

    clearTimeout(timeoutId)

    // Claude às vezes retorna JSON dentro de ```json fences — strip-as
    const cleaned = stripJsonFences(text)
    const parsed = JSON.parse(cleaned)
    const validated = topicoDecomposedSchema.parse(parsed)

    return { result: validated, usedFallback: false, aiModel: CLAUDE_HAIKU_MODEL }
  } catch (err) {
    // Fallback regex em qualquer falha (parse, validation, network, timeout)
    return {
      result: fallbackDecompose(topicoNome),
      usedFallback: true,
      aiModel: 'fallback-regex',
    }
  }
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

/** Decomposição "burra": trata o tópico inteiro como 1 subtópico de 45min. */
export function fallbackDecompose(topicoNome: string): TopicoDecomposed {
  const nomeCurto = topicoNome.slice(0, 60)
  return {
    nome_curto: nomeCurto,
    conceitos_pai: [nomeCurto],
    subtopicos: [{
      nome: topicoNome.slice(0, 200),
      duracao_min: 45,
      conceito_pai: nomeCurto,
    }],
    referencias_legais: [],
  }
}
```

- [ ] **Step 2: Criar test (mock Claude)**

```typescript
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
      text: '```json\n{"nome_curto":"X","conceitos_pai":["A"],"subtopicos":[{"nome":"A - sub","duracao_min":30,"conceito_pai":"A"}],"referencias_legais":[]}\n```',
    } as any)

    const r = await decomposeTopico('Tópico teste')
    expect(r.usedFallback).toBe(false)
    expect(r.result.nome_curto).toBe('X')
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
```

- [ ] **Step 3: Rodar tests + commit**

```bash
npx vitest run src/lib/cronograma-v2/__tests__/topico-decomposer.test.ts
git add src/lib/cronograma-v2/topico-decomposer.ts src/lib/cronograma-v2/__tests__/topico-decomposer.test.ts
git commit -m "feat(cronograma-v2): add topico-decomposer with Claude Haiku + Zod + fallback"
```

---

### Task 5: `edital-cache.ts` + tests

**Files:**
- Create: `src/lib/cronograma-v2/edital-cache.ts`
- Create: `src/lib/cronograma-v2/__tests__/edital-cache.test.ts`

Funções `getCachedDecomposicao(cargoId, editalId)` e `upsertCache(cargoId, editalId, payloadHash, decomposicao, aiModel)`. Usa cliente Supabase do projeto.

- [ ] **Step 1: Criar `edital-cache.ts`**

```typescript
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
```

- [ ] **Step 2: Criar test (mock Supabase)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCachedDecomposicao,
  upsertCachedDecomposicao,
  touchCacheValidation,
} from '../edital-cache'
import { CacheCorruptionError } from '../errors'

function mockSupabase(impl: any) {
  return { from: vi.fn(() => impl) } as any
}

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
```

- [ ] **Step 3: Rodar tests + commit**

```bash
npx vitest run src/lib/cronograma-v2/__tests__/edital-cache.test.ts
git add src/lib/cronograma-v2/edital-cache.ts src/lib/cronograma-v2/__tests__/edital-cache.test.ts
git commit -m "feat(cronograma-v2): add edital-cache read/upsert with schema validation"
```

---

### Task 6: `sync-edital.ts` orchestrator

**Files:**
- Create: `src/lib/cronograma-v2/sync-edital.ts`

Função `syncEdital(supabase, editalGraphQL, options?)` que: (1) calcula hash, (2) lê cache, (3) se hash bate → touch + retorna, (4) senão decompõe tópicos longos em paralelo (p-limit 3) + upsert cache.

- [ ] **Step 1: Criar arquivo**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cronograma-v2/sync-edital.ts
git commit -m "feat(cronograma-v2): add syncEdital orchestrator (cache + hash + AI decompose)"
```

---

### Task 7: Test do `sync-edital.ts` orchestrator

**Files:**
- Create: `src/lib/cronograma-v2/__tests__/sync-edital.test.ts`

Cobre: cache hit (sem chamar IA), cache miss (decompõe todos), forceRefresh (ignora cache), skipAI (só fallback).

- [ ] **Step 1: Criar test**

```typescript
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
    // Patch hash to match
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
```

- [ ] **Step 2: Rodar + commit**

```bash
npx vitest run src/lib/cronograma-v2/__tests__/sync-edital.test.ts
git add src/lib/cronograma-v2/__tests__/sync-edital.test.ts
git commit -m "test(cronograma-v2): sync-edital orchestrator (cache hit/miss/force/skipAI)"
```

---

### Task 8: API Route `/api/cronograma-v2/sync-edital`

**Files:**
- Create: `src/app/api/cronograma-v2/sync-edital/route.ts`

POST endpoint que recebe `{cargo_id, edital_id, edital_payload}` e chama `syncEdital`. Auth via Supabase session (mesmo padrão do `explain-alternative`).

- [ ] **Step 1: Criar route**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'
import { editalGraphQLSchema } from '@/lib/cronograma-v2/schemas'
import { z } from 'zod'

const requestSchema = z.object({
  edital_payload: editalGraphQLSchema,
  force_refresh: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  // Auth header (Bearer JWT from supabase session)
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 })
  }

  // Cliente autenticado como o user (RLS aplica em edital_cache — mas a tabela é pública pra read; gravação só service_role)
  // Pra upsert no cache precisamos do service role.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Validar o JWT do user antes de prosseguir (defesa em profundidade)
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  try {
    const result = await syncEdital(adminClient, parsed.data.edital_payload, {
      forceRefresh: parsed.data.force_refresh,
    })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('[sync-edital] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cronograma-v2/sync-edital/route.ts
git commit -m "feat(cronograma-v2): add POST /api/cronograma-v2/sync-edital endpoint"
```

---

### Task 9: API Route `/api/cronograma-v2/decompose-topico` (debug/single)

**Files:**
- Create: `src/app/api/cronograma-v2/decompose-topico/route.ts`

Endpoint pra decomposição single (útil pra debug/admin/UI mostrar preview).

- [ ] **Step 1: Criar route**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { decomposeTopico } from '@/lib/cronograma-v2/topico-decomposer'
import { z } from 'zod'

const requestSchema = z.object({
  topico_nome: z.string().min(3).max(2000),
  skip_ai: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const r = await decomposeTopico(parsed.data.topico_nome, { skipAI: parsed.data.skip_ai })
    return NextResponse.json(r, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cronograma-v2/decompose-topico/route.ts
git commit -m "feat(cronograma-v2): add POST /api/cronograma-v2/decompose-topico single endpoint"
```

---

### Task 10: Hook `useSyncEdital` no frontend

**Files:**
- Create: `src/hooks/useSyncEdital.ts`

Hook React que faz POST no endpoint, com mutation pattern do React Query.

- [ ] **Step 1: Criar hook**

```typescript
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EditalGraphQL } from '@/lib/cronograma-v2/schemas'

export interface SyncEditalResponse {
  cacheHit: boolean
  decomposicao: {
    by_topico: Record<string, {
      nome_curto: string
      conceitos_pai: string[]
      subtopicos: Array<{ nome: string; duracao_min: number; conceito_pai: string }>
      referencias_legais: string[]
    }>
    metadata: {
      ai_model: string
      decomposed_at: string
      total_topicos: number
      decomposed_count: number
      fallback_count: number
    }
  }
  payload_hash: string
  decomposed_topicos: number
  fallback_topicos: number
  total_topicos: number
}

export function useSyncEdital() {
  return useMutation<SyncEditalResponse, Error, { edital: EditalGraphQL; forceRefresh?: boolean }>({
    mutationFn: async ({ edital, forceRefresh = false }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const res = await fetch('/api/cronograma-v2/sync-edital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ edital_payload: edital, force_refresh: forceRefresh }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha desconhecida' }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      return res.json()
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSyncEdital.ts
git commit -m "feat(cronograma-v2): add useSyncEdital hook (React Query mutation)"
```

---

### Task 11: Public index + doc

**Files:**
- Create: `src/lib/cronograma-v2/index.ts`
- Create: `docs/cronograma-v2/sub-plan-3-applied.md`

- [ ] **Step 1: Criar `index.ts`**

```typescript
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
```

- [ ] **Step 2: Criar doc**

```markdown
# Sub-plan 3 — SyncEditalService + TopicoDecomposer (applied)

## Estrutura

- `src/lib/cronograma-v2/` — biblioteca core (errors, schemas, hash, decomposer, cache, sync)
- `src/app/api/cronograma-v2/sync-edital` — POST endpoint (full edital)
- `src/app/api/cronograma-v2/decompose-topico` — POST endpoint (single, debug)
- `src/hooks/useSyncEdital` — React Query hook

## Como usar

```ts
import { useSyncEdital } from '@/hooks/useSyncEdital'

const { mutate, isPending, data } = useSyncEdital()
mutate({ edital: editalFromGraphQL })  // data.decomposicao.by_topico[topicoId]
```

## Testes

```bash
npx vitest run src/lib/cronograma-v2
```

## Commit chain

[Real chain from `git log --oneline`]

## Known limitations

- Daily AI spend cap (spec §5.5) **not implemented** — natural throttle by p-limit(3) only.
  Future: tabela `daily_ai_spend` ou usar `app_settings` quando criado.
- Warming cron (`sync_edital_warmer`) **not implemented** — deferred to Sub-plan 6.

## Próximo passo

Sub-plan 4 — Refactor do setup flow (CronogramaSetupPage) usando `useSyncEdital` + chamando `criar_plano_completo`.
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cronograma-v2/index.ts docs/cronograma-v2/sub-plan-3-applied.md
git commit -m "docs(cronograma-v2): public index + sub-plan 3 summary"
```

---

## Self-Review

**Spec coverage:**
- §5.1 flow → Tasks 4 (decomposer), 5 (cache), 6 (orchestrator) ✅
- §5.2 prompt → embed in Task 4 ✅
- §5.3 hash → Task 2 ✅
- §5.4 cost/perf → covered by p-limit + caching design (no daily cap impl — flagged) ⚠️
- §5.5 rate limit → p-limit ✅; daily cap deferred ⚠️

**Placeholder scan:** none. All code blocks are concrete.

**Type consistency:** `EditalGraphQL`, `TopicoDecomposed`, `EditalDecomposicao` defined in `schemas.ts` and reused everywhere. ✅

**Scope check:** Sub-plan 3 stays in TS lib + API + 1 hook. No UI work (deferred to Sub-plan 4). No SQL changes (Sub-plan 1 was enough for `edital_cache`).

**Known gap (kept conscious):**
- Daily AI spend cap not enforced. Risk: if a malicious user POSTs many force_refresh, we burn IA budget. Mitigation: rate limit at endpoint level via `feature_flags` ou tabela auxiliar — deferred. For now, p-limit(3) bounds parallelism.

---

## Pré-execução checklist

- [ ] `ANTHROPIC_API_KEY` em `.env.local` (já está, usado em `explain-alternative`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` em env (necessária pro upsert no cache) — confirmar
- [ ] `vitest` instalado (rodar `npx vitest --version` antes da Task 2)
- [ ] `p-limit` instalado (Task 0)

---

## Plan complete. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-3-sync-edital.md`.

**Two execution options:**
1. **Subagent-Driven** (recommended)
2. **Inline Execution**

Which approach?
