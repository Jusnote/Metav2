# Cronograma V2 — Sub-plan 4: Setup flow refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar `CronogramaSetupPage` pra usar a infra V2 completa (Sub-plans 1-3): cargo da navbar como source of truth, decomposição IA do edital, RPC atômica `criar_plano_completo`, draft persistence, e feature flag pra rollout gradual. Resultado: wizard que produz cronogramas balanceados com tópicos reais do edital, sem 30 atividades numa semana.

**Architecture:** Endpoint TS `/api/cronograma/criar-plano` orquestra: (1) valida input via Zod, (2) checa feature flag por user, (3) sincroniza edital (via `syncEdital` do Sub-plan 3), (4) chama RPC `criar_plano_completo` (Sub-plan 2). Page lê `useCargoAtivo`, adiciona 3 novos steps (cargo, extras, material/horário), augmenta disciplinas step com nivel + ponto_fraco. Draft persistido a cada mudança (debounce 1s). Quando feature flag desligada, página continua com fluxo V1 atual.

**Tech Stack:** Next.js Route Handler, Zod, React Query mutation, `useDebouncedCallback` (lodash ou custom), Supabase JS, ai-sdk anthropic (já via Sub-plan 3).

**Spec ref:** §7.1-7.7 do `docs/superpowers/specs/2026-05-14-cronograma-cargo-integration-design.md`.

**Premissas:**
- Sub-plans 1-3 completos e verificados (54 commits acumulados)
- `criar_plano_completo` RPC vivo no remote
- `useSyncEdital` hook funcional + 2 API routes
- `useCargoAtivo` retorna `{ cargo: Carreira | null, setCargo, hydrated }` de `src/hooks/useCargoAtivo.ts`
- Feature flag `cronograma_v2_enabled` existe na tabela `feature_flags` (Sub-plan 1) — pode estar com `enabled=false`; precisa ser setada com `rollout_pct=100` ou via allowlist pro user testar
- `CronogramaSetupPage.tsx` atual: 1482 linhas, 7 steps (objetivo/data/horasUtil/fimDeSemana/estilo/disciplinas/reveal), `handleSubmit` em linha 380 faz raw inserts em planos_estudo + plano_config + plano_disciplinas (sem chamar `gerar_cronograma`)

---

## File Structure

```
src/app/api/cronograma/criar-plano/
  route.ts                          — orchestrator endpoint (Task 2)

src/hooks/
  useCriarPlano.ts                  — React Query mutation (Task 3)
  useSetupDraftPersistence.ts       — debounced save de rascunho (Task 9)

src/components/cronograma-v2/setup/
  CargoStep.tsx                     — Step 0 (Task 5)
  MaterialHorarioStep.tsx           — novo step (Task 7)
  ExtrasStep.tsx                    — novo step (Task 8)
  DisciplinaNivelChip.tsx           — sub-componente (Task 6)
  index.ts                          — re-exports

src/lib/cronograma-v2/
  setup-payload.ts                  — Zod schema do payload do endpoint (Task 1)

src/views/CronogramaSetupPage.tsx
  — refatorado (Tasks 4, 6, 10)

docs/cronograma-v2/
  sub-plan-4-applied.md             — doc resumo (Task 11)
```

---

## Pré-requisitos

- [ ] Sub-plans 1-3 verificados (33/33 checks no `verify_all_oneshot.sql` + 23/23 vitest)
- [ ] `feature_flags` table tem ou pode receber a row `cronograma_v2_enabled`
- [ ] `useCargoAtivo` retorna a `Carreira` esperada (id INT, nome string, etc.) — confirmar o shape em `src/types/carreira.ts` antes da Task 4
- [ ] Branch `cargo-transition-v2`

---

### Task 0: Setup — confirmar baseline + criar dirs

**Files:**
- Create: `src/components/cronograma-v2/setup/.gitkeep`

- [ ] **Step 1: Confirmar Sub-plans 1-3**

```bash
cd "D:/meta novo/Metav2" && git log --oneline -3 && \
ls src/lib/cronograma-v2/ && \
ls src/app/api/cronograma-v2/ && \
npx vitest run src/lib/cronograma-v2 2>&1 | tail -3
```

Expected: tip ≥ `2ec9153`; lib has 8 files (errors/hash/schemas/decomposer/cache/sync/index + tests dir); api has 2 dirs (sync-edital + decompose-topico); 23 tests passing.

- [ ] **Step 2: Confirmar shape de `Carreira`**

```bash
cd "D:/meta novo/Metav2" && cat src/types/carreira.ts 2>&1 | head -30
```

Confirmar campos: `id`, `nome`, e idealmente `edital_id` ou similar pra wire com syncEdital. Anotar.

- [ ] **Step 3: Confirmar feature flag**

Via Supabase Studio SQL Editor:
```sql
SELECT * FROM feature_flags WHERE flag_name = 'cronograma_v2_enabled';
```

Se não existir, INSERT com `enabled=true, rollout_pct=100` ou com user allowlist do user de teste:
```sql
INSERT INTO feature_flags (flag_name, enabled, rollout_pct)
VALUES ('cronograma_v2_enabled', TRUE, 100)
ON CONFLICT (flag_name) DO UPDATE SET enabled=TRUE, rollout_pct=100;
```

- [ ] **Step 4: Criar dir e commit**

```bash
mkdir -p src/components/cronograma-v2/setup
touch src/components/cronograma-v2/setup/.gitkeep
git add src/components/cronograma-v2/setup/.gitkeep
git commit -m "chore(cronograma-v2): create setup components directory"
```

---

### Task 1: Zod schema do payload — `setup-payload.ts`

**Files:**
- Create: `src/lib/cronograma-v2/setup-payload.ts`

Schema rigoroso pra validar o request body do endpoint. Reflete shape de `criar_plano_completo` mas adiciona o `edital_payload` (passado opcionalmente; senão endpoint busca via GraphQL).

- [ ] **Step 1: Criar arquivo**

```typescript
import { z } from 'zod'
import { editalGraphQLSchema } from './schemas'

export const setupPayloadSchema = z.object({
  // Identificação do cargo (vem da navbar via useCargoAtivo)
  // Carreira.id é string no app (geralmente "42"); coerce pra INT pro RPC
  cargo_id: z.coerce.number().int().positive(),
  cargo_nome: z.string().min(1),

  // Datas
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD esperado'),
  data_prova: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD esperado'),

  // Capacidade
  weekday_minutes: z.number().int().min(30).max(720),
  weekend_minutes: z.number().int().min(0).max(720),
  block_duration_minutes: z.number().int().min(15).max(120).default(50),

  // Mix
  mix_ratio: z.object({
    teoria: z.number().min(0).max(1),
    questoes: z.number().min(0).max(1),
    revisao: z.number().min(0).max(1).default(0),
    flashcards: z.number().min(0).max(1).default(0),
  }).refine(
    (m) => Math.abs((m.teoria + m.questoes + m.revisao + m.flashcards) - 1) < 0.05,
    { message: 'mix_ratio deve somar ~1.0 (±0.05)' },
  ),

  // Extras
  simulados_freq: z.enum(['nenhum', 'mensal', 'quinzenal', 'semanal']).default('mensal'),
  tem_redacao: z.boolean().default(false),
  tipo_material: z.enum(['video', 'pdf', 'livro', 'questoes', 'misto']).default('misto'),
  horario_preferido: z.enum(['manha', 'tarde', 'noite', 'madrugada', 'flexivel']).default('flexivel'),

  // Disciplinas selecionadas
  disciplinas: z.array(z.object({
    disciplina_id: z.string().uuid(),
    peso: z.number().int().min(1).max(10).default(5),
    nivel_conhecimento: z.enum(['iniciante', 'intermediario', 'avancado']).default('intermediario'),
    is_ponto_fraco: z.boolean().default(false),
    excluded_subtopico_ids: z.array(z.string().uuid()).default([]),
  })).min(1).refine(
    (arr) => arr.filter(d => d.is_ponto_fraco).length <= 3,
    { message: 'Máximo 3 disciplinas marcadas como ponto fraco' },
  ),

  // Edital (opcional — se omitido, endpoint busca via GraphQL)
  edital_payload: editalGraphQLSchema.optional(),

  // Template opcional
  template_id: z.string().uuid().optional().nullable(),
})

export type SetupPayload = z.infer<typeof setupPayloadSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cronograma-v2/setup-payload.ts
git commit -m "feat(cronograma-v2): add Zod schema for criar-plano endpoint payload"
```

---

### Task 2: Endpoint `/api/cronograma/criar-plano`

**Files:**
- Create: `src/app/api/cronograma/criar-plano/route.ts`

POST endpoint que orquestra: (1) auth via Bearer, (2) parse Zod, (3) feature flag check, (4) opcional: syncEdital se `edital_payload` veio, (5) chama RPC `criar_plano_completo`, (6) retorna `{ plano_id, items_created, warnings }`.

- [ ] **Step 1: Criar route**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setupPayloadSchema } from '@/lib/cronograma-v2/setup-payload'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  // 2. Parse body
  const body = await req.json().catch(() => null)
  const parsed = setupPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const payload = parsed.data

  // 3. Admin client (service role pra criar plano)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 })
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 4. Valida JWT do user
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  const userId = userData.user.id

  // 5. Feature flag check
  const { data: flagEnabled } = await adminClient
    .rpc('is_feature_enabled', { p_flag_name: 'cronograma_v2_enabled', p_user_id: userId })

  if (flagEnabled !== true) {
    return NextResponse.json(
      { error: 'Cronograma V2 não disponível pro seu usuário ainda', feature_flag: false },
      { status: 403 },
    )
  }

  // 6. Rate limit defensivo (max 5 planos/dia/user)
  const today = new Date().toISOString().slice(0, 10)
  const { count: planosHoje } = await adminClient
    .from('planos_estudo')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00Z`)

  if ((planosHoje ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Limite diário de 5 planos atingido' },
      { status: 429 },
    )
  }

  try {
    // 7. Sync edital (opcional — se payload veio)
    let editalDecomposicao = null
    if (payload.edital_payload) {
      const syncResult = await syncEdital(adminClient, payload.edital_payload, { forceRefresh: false })
      editalDecomposicao = syncResult.decomposicao
    }

    // 8. Chama RPC criar_plano_completo
    const cargoSnapshot = {
      nome: payload.cargo_nome,
      cargo_id: payload.cargo_id,
      ...(payload.edital_payload && {
        edital_id: payload.edital_payload.edital_id,
        qtd_disciplinas: payload.edital_payload.disciplinas.length,
      }),
    }

    const { data: rpcResult, error: rpcErr } = await adminClient.rpc('criar_plano_completo', {
      p_user_id: userId,
      p_cargo_id: payload.cargo_id,
      p_cargo_snapshot: cargoSnapshot,
      p_data_inicio: payload.data_inicio,
      p_data_prova: payload.data_prova,
      p_weekday_minutes: payload.weekday_minutes,
      p_weekend_minutes: payload.weekend_minutes,
      p_block_duration_minutes: payload.block_duration_minutes,
      p_mix_ratio: payload.mix_ratio,
      p_simulados_freq: payload.simulados_freq,
      p_tem_redacao: payload.tem_redacao,
      p_tipo_material: payload.tipo_material,
      p_horario_preferido: payload.horario_preferido,
      p_disciplinas: payload.disciplinas,
      p_template_id: payload.template_id ?? null,
    })

    if (rpcErr) {
      console.error('[criar-plano] RPC error:', rpcErr)
      return NextResponse.json(
        { error: rpcErr.message, code: rpcErr.code, details: rpcErr.details },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ...rpcResult,
      edital_synced: !!editalDecomposicao,
      decomposicao_summary: editalDecomposicao?.metadata,
    }, { status: 200 })

  } catch (err) {
    console.error('[criar-plano] unexpected:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cronograma/criar-plano/route.ts
git commit -m "feat(cronograma-v2): add POST /api/cronograma/criar-plano orchestrator endpoint"
```

---

### Task 3: Hook `useCriarPlano`

**Files:**
- Create: `src/hooks/useCriarPlano.ts`

React Query mutation que POSTa no endpoint. Retorna `{ plano_id, items_created, warnings, ... }` em sucesso.

- [ ] **Step 1: Criar hook**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { SetupPayload } from '@/lib/cronograma-v2/setup-payload'

export interface CriarPlanoResponse {
  plano_id: string
  items_created: number
  overflow_weeks: number
  warnings: Array<{ warning: string; msg: string; [k: string]: unknown }>
  edital_synced: boolean
  decomposicao_summary?: {
    ai_model: string
    total_topicos: number
    decomposed_count: number
    fallback_count: number
  }
}

export class CriarPlanoError extends Error {
  constructor(public readonly status: number, public readonly raw: unknown, message: string) {
    super(message)
    this.name = 'CriarPlanoError'
  }
}

export function useCriarPlano() {
  const qc = useQueryClient()

  return useMutation<CriarPlanoResponse, CriarPlanoError, SetupPayload>({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new CriarPlanoError(401, null, 'Não autenticado')
      }

      const res = await fetch('/api/cronograma/criar-plano', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({ error: 'Falha ao parsear resposta' }))

      if (!res.ok) {
        throw new CriarPlanoError(
          res.status,
          json,
          json?.error ?? `HTTP ${res.status}`,
        )
      }

      return json as CriarPlanoResponse
    },
    onSuccess: () => {
      // Invalida queries que dependem do plano ativo
      qc.invalidateQueries({ queryKey: ['plano-ativo'] })
      qc.invalidateQueries({ queryKey: ['cronograma'] })
      qc.invalidateQueries({ queryKey: ['weekly-stats'] })
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCriarPlano.ts
git commit -m "feat(cronograma-v2): add useCriarPlano hook (React Query mutation)"
```

---

### Task 4: Integrar `useCargoAtivo` no setup

**Files:**
- Modify: `src/views/CronogramaSetupPage.tsx`

Adiciona import + hook + state derivado. Cargo da navbar entra no `Answers`. Não modifica steps existentes ainda — apenas torna `cargo` disponível no scope do componente.

- [ ] **Step 1: Modificar imports + estado**

Localizar imports topo do arquivo e adicionar:

```typescript
import { useCargoAtivo } from '@/hooks/useCargoAtivo'
import type { Carreira } from '@/types/carreira'
```

Localizar o estado em `CronogramaSetupPage()` e adicionar:

```typescript
const { cargo, hydrated: cargoHydrated } = useCargoAtivo()
```

Augmentar `interface Answers` (no top do arquivo, perto de outras types):

```typescript
interface Answers {
  // ... campos existentes ...
  cargo?: Carreira | null              // ⬅ novo: cargo selecionado pelo wizard ou herdado da navbar
  simulados_freq?: 'nenhum' | 'mensal' | 'quinzenal' | 'semanal'  // ⬅ novo
  tem_redacao?: boolean                                              // ⬅ novo
  tipo_material?: 'video' | 'pdf' | 'livro' | 'questoes' | 'misto'  // ⬅ novo
  horario_preferido?: 'manha' | 'tarde' | 'noite' | 'madrugada' | 'flexivel'  // ⬅ novo
  // Para cada disciplina selecionada, adicionar nivel + is_ponto_fraco
}
```

Augmentar `interface SelectedDisciplina`:

```typescript
interface SelectedDisciplina {
  id: string
  peso: number
  prioridade: Prioridade
  nivel_conhecimento?: 'iniciante' | 'intermediario' | 'avancado'  // ⬅ novo
  is_ponto_fraco?: boolean                                          // ⬅ novo
}
```

Inicializar `answers.cargo` com `cargo` da navbar quando `cargoHydrated`:

```typescript
useEffect(() => {
  if (cargoHydrated && cargo && !answers.cargo) {
    setAnswers(prev => ({ ...prev, cargo }))
  }
}, [cargoHydrated, cargo, answers.cargo])
```

- [ ] **Step 2: Commit**

```bash
git add src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): wire useCargoAtivo into setup page state"
```

---

### Task 5: Step 0 — Cargo

**Files:**
- Create: `src/components/cronograma-v2/setup/CargoStep.tsx`
- Modify: `src/views/CronogramaSetupPage.tsx` (adicionar step na sequência)

Componente que reusa `CargoSelectorContent` (já existe em `src/components/CargoSelector.tsx`). Skip step se já tem cargo via navbar.

- [ ] **Step 1: Criar `CargoStep.tsx`**

`CargoSelector.tsx` exporta `CargoSelectorCard`, `CargoSelectorExpansion`, `useCargoSelectorState` e o tipo `CargoSelectorContext`. Vamos compor esses ao invés de buscar um `CargoSelectorContent` que não existe.

```typescript
'use client'

import { useEffect } from 'react'
import {
  CargoSelectorCard,
  CargoSelectorExpansion,
  useCargoSelectorState,
} from '@/components/CargoSelector'
import { useCargoAtivo } from '@/hooks/useCargoAtivo'
import type { Carreira } from '@/types/carreira'

export interface CargoStepProps {
  onPicked: (cargo: Carreira) => void
}

export function CargoStep({ onPicked }: CargoStepProps) {
  const state = useCargoSelectorState()
  const { cargo } = useCargoAtivo()

  // Se o user salvou cargo via useCargoAtivo (ou via CargoSelectorExpansion), propaga
  useEffect(() => {
    if (cargo) onPicked(cargo)
  }, [cargo, onPicked])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <CargoSelectorCard state={state} />
      <CargoSelectorExpansion state={state} onAfterApply={() => { /* useCargoAtivo já atualizou */ }} />
    </div>
  )
}
```

> **Note:** Se compor esses 2 não der o resultado visual desejado (a UI de selector costuma esperar overlay/sheet), subagent pode optar por extrair a lógica relevante manualmente. Reportar a decisão.

- [ ] **Step 2: Adicionar step na sequência**

No `CronogramaSetupPage.tsx`, modificar `STEPS`:

```typescript
const STEPS: StepId[] = [
  'cargo',           // ⬅ novo (skip dinâmico se cargo ativo)
  'objetivo',
  'data',
  'horasUtil',
  'fimDeSemana',
  'estilo',
  'disciplinas',
  'extras',          // ⬅ novo
  'materialHorario', // ⬅ novo
  'reveal',
]
```

Atualizar `type StepId` correspondentemente. Atualizar `QUESTIONS` record com entradas pros novos steps.

Lógica condicional: se `answers.cargo` já definido no mount, pular `cargo` step automaticamente (avança stepIdx).

- [ ] **Step 3: Commit**

```bash
git add src/components/cronograma-v2/setup/CargoStep.tsx src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): add CargoStep (skipped when navbar has active cargo)"
```

---

### Task 6: Augmentar DisciplinasStep com nivel + ponto_fraco

**Files:**
- Create: `src/components/cronograma-v2/setup/DisciplinaNivelChip.tsx`
- Modify: `src/views/CronogramaSetupPage.tsx` (DisciplinaRow)

Cada disciplina selecionada ganha 2 controles extras: pill de nível (iniciante/intermediário/avançado) e checkbox "ponto fraco" (max 3 globalmente).

- [ ] **Step 1: Criar chip**

```typescript
'use client'

import type { ButtonHTMLAttributes } from 'react'

type Nivel = 'iniciante' | 'intermediario' | 'avancado'

const LABEL: Record<Nivel, string> = {
  iniciante: 'INI',
  intermediario: 'INT',
  avancado: 'AVA',
}
const TITLE: Record<Nivel, string> = {
  iniciante: 'Iniciante (+50% tempo)',
  intermediario: 'Intermediário (tempo base)',
  avancado: 'Avançado (-30% tempo)',
}

export function DisciplinaNivelChip({
  current,
  onChange,
  disabled,
}: {
  current: Nivel
  onChange: (n: Nivel) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/60 p-0.5">
      {(['iniciante', 'intermediario', 'avancado'] as const).map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          title={TITLE[n]}
          className={`
            px-2.5 py-1 text-[10px] font-semibold rounded-full transition
            ${current === n
              ? 'bg-emerald-500 text-slate-900 shadow'
              : 'text-slate-400 hover:text-slate-200'}
          `}
        >
          {LABEL[n]}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Modificar `DisciplinaRow` no setup page**

Localizar `function DisciplinaRow(...)` no `CronogramaSetupPage.tsx` (~ linha 1064 atualmente) e:
1. Importar `DisciplinaNivelChip`
2. Adicionar próximo ao slider de intensidade: chip de nivel + checkbox "ponto fraco"
3. Atualizar handler que escreve em `answers.selectedDisciplinas` pra incluir os novos campos
4. Enforçar regra "máximo 3 pontos fracos" — desabilitar checkbox se já tem 3 marcados (e este não é um deles)

Pseudo-código pro hook de atualização:

```typescript
const setNivel = (id: string, nivel: Nivel) => {
  setAnswers(prev => {
    const map = new Map(prev.selectedDisciplinas ?? new Map())
    const cur = map.get(id) ?? { id, peso: 5, prioridade: 'media' }
    map.set(id, { ...cur, nivel_conhecimento: nivel })
    return { ...prev, selectedDisciplinas: map }
  })
}

const togglePontoFraco = (id: string) => {
  setAnswers(prev => {
    const map = new Map(prev.selectedDisciplinas ?? new Map())
    const cur = map.get(id)
    if (!cur) return prev
    const next = !cur.is_ponto_fraco
    // Enforce ≤3
    const total = Array.from(map.values()).filter(d => d.is_ponto_fraco).length
    if (next && total >= 3) return prev  // silent block
    map.set(id, { ...cur, is_ponto_fraco: next })
    return { ...prev, selectedDisciplinas: map }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cronograma-v2/setup/DisciplinaNivelChip.tsx src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): add nivel + ponto_fraco controls per disciplina"
```

---

### Task 7: Novo step — Material + Horário

**Files:**
- Create: `src/components/cronograma-v2/setup/MaterialHorarioStep.tsx`
- Modify: `src/views/CronogramaSetupPage.tsx` (adicionar render do step)

Step com 2 grupos: tipo de material (vídeo/pdf/livro/questões/misto) e horário preferido (manhã/tarde/noite/madrugada/flexível). UI: pills clicáveis.

- [ ] **Step 1: Criar componente**

```typescript
'use client'

type TipoMaterial = 'video' | 'pdf' | 'livro' | 'questoes' | 'misto'
type Horario = 'manha' | 'tarde' | 'noite' | 'madrugada' | 'flexivel'

const MATERIAL_LABEL: Record<TipoMaterial, string> = {
  video: 'Vídeo-aula',
  pdf: 'PDF / Apostila',
  livro: 'Livro',
  questoes: 'Resolução de questões',
  misto: 'Misto',
}
const HORARIO_LABEL: Record<Horario, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  madrugada: 'Madrugada',
  flexivel: 'Flexível',
}

export function MaterialHorarioStep({
  tipoMaterial,
  horario,
  onPickMaterial,
  onPickHorario,
}: {
  tipoMaterial: TipoMaterial | undefined
  horario: Horario | undefined
  onPickMaterial: (m: TipoMaterial) => void
  onPickHorario: (h: Horario) => void
}) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Tipo de material
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MATERIAL_LABEL) as TipoMaterial[]).map(m => (
            <Pill key={m} active={tipoMaterial === m} onClick={() => onPickMaterial(m)} label={MATERIAL_LABEL[m]} />
          ))}
        </div>
      </section>
      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Quando você costuma estudar
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HORARIO_LABEL) as Horario[]).map(h => (
            <Pill key={h} active={horario === h} onClick={() => onPickHorario(h)} label={HORARIO_LABEL[h]} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-2 rounded-full text-sm font-medium border transition
        ${active
          ? 'bg-emerald-500 text-slate-900 border-emerald-500'
          : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100'}
      `}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Integrar no setup page**

Adicionar render quando `currentStep === 'materialHorario'`:

```typescript
{currentStep === 'materialHorario' && (
  <MaterialHorarioStep
    tipoMaterial={answers.tipo_material}
    horario={answers.horario_preferido}
    onPickMaterial={(m) => { setAnswers(p => ({ ...p, tipo_material: m })); }}
    onPickHorario={(h) => { setAnswers(p => ({ ...p, horario_preferido: h })); }}
  />
)}
```

Enable "Próximo" só se ambos selecionados.

- [ ] **Step 3: Commit**

```bash
git add src/components/cronograma-v2/setup/MaterialHorarioStep.tsx src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): add MaterialHorarioStep (tipo material + horário preferido)"
```

---

### Task 8: Novo step — Extras (simulados + redação)

**Files:**
- Create: `src/components/cronograma-v2/setup/ExtrasStep.tsx`
- Modify: `src/views/CronogramaSetupPage.tsx`

Step final antes do reveal. Frequência de simulados (4 opções) + toggle redação.

- [ ] **Step 1: Criar componente**

```typescript
'use client'

type SimuladosFreq = 'nenhum' | 'mensal' | 'quinzenal' | 'semanal'

const FREQ_LABEL: Record<SimuladosFreq, { title: string; sub: string }> = {
  nenhum: { title: 'Não quero', sub: 'Só estudo regular' },
  mensal: { title: 'Mensal', sub: '1 a cada 4 semanas' },
  quinzenal: { title: 'Quinzenal', sub: '1 a cada 2 semanas' },
  semanal: { title: 'Semanal', sub: 'Todo fim de semana' },
}

export function ExtrasStep({
  simuladosFreq,
  temRedacao,
  onPickFreq,
  onToggleRedacao,
}: {
  simuladosFreq: SimuladosFreq | undefined
  temRedacao: boolean | undefined
  onPickFreq: (f: SimuladosFreq) => void
  onToggleRedacao: (v: boolean) => void
}) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-10">
      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Simulados periódicos
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(FREQ_LABEL) as SimuladosFreq[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => onPickFreq(f)}
              className={`
                text-left rounded-2xl border p-4 transition
                ${simuladosFreq === f
                  ? 'bg-emerald-500/10 border-emerald-400 ring-1 ring-emerald-400/40'
                  : 'border-slate-700 hover:border-slate-500'}
              `}
            >
              <div className="text-sm font-semibold text-slate-100">{FREQ_LABEL[f].title}</div>
              <div className="text-xs text-slate-400 mt-1">{FREQ_LABEL[f].sub}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Redação
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!temRedacao}
            onChange={(e) => onToggleRedacao(e.target.checked)}
            className="w-5 h-5 rounded accent-emerald-500"
          />
          <div>
            <div className="text-sm text-slate-100">Quero treinar redação semanalmente</div>
            <div className="text-xs text-slate-400 mt-0.5">Reserva ~1h por semana</div>
          </div>
        </label>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Integrar no setup page**

```typescript
{currentStep === 'extras' && (
  <ExtrasStep
    simuladosFreq={answers.simulados_freq}
    temRedacao={answers.tem_redacao}
    onPickFreq={(f) => { setAnswers(p => ({ ...p, simulados_freq: f })); }}
    onToggleRedacao={(v) => { setAnswers(p => ({ ...p, tem_redacao: v })); }}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cronograma-v2/setup/ExtrasStep.tsx src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): add ExtrasStep (simulados freq + redação toggle)"
```

---

### Task 9: Draft persistence

**Files:**
- Create: `src/hooks/useSetupDraftPersistence.ts`
- Modify: `src/views/CronogramaSetupPage.tsx`

Hook que serializa `answers` num row de `planos_estudo` com `status='rascunho'`. Debounce 1s. Mount: carrega rascunho existente do user (mais recente, último 7 dias) e oferece "Continuar?".

- [ ] **Step 1: Criar hook**

```typescript
import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

type AnswersBlob = Record<string, unknown>

export interface DraftState {
  existing: { plano_id: string; nome: string; updated_at: string } | null
  loading: boolean
  load: () => Promise<AnswersBlob | null>
  save: (answers: AnswersBlob, planoNome?: string) => Promise<void>
  discardAll: () => Promise<void>
}

const RASCUNHO_TTL_DAYS = 7
const DEBOUNCE_MS = 1000

/**
 * Persistência de rascunho no Supabase.
 * - `save` é debounced internamente. Caller pode chamar a cada keystroke sem worry.
 * - `existing` indica se há rascunho ≤7 dias do user.
 */
export function useSetupDraftPersistence(userId: string | null): DraftState {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const existingRef = useRef<DraftState['existing']>(null)
  // Para reagir a load
  const loadingRef = useRef(true)

  useEffect(() => {
    if (!userId) {
      loadingRef.current = false
      return
    }
    const cutoff = new Date(Date.now() - RASCUNHO_TTL_DAYS * 86400 * 1000).toISOString()
    supabase
      .from('planos_estudo')
      .select('id, nome, updated_at, cargo_snapshot')
      .eq('user_id', userId)
      .eq('status', 'rascunho')
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          existingRef.current = {
            plano_id: data.id,
            nome: data.nome,
            updated_at: data.updated_at,
          }
        }
        loadingRef.current = false
      })
  }, [userId])

  const save = useCallback(async (answers: AnswersBlob, planoNome?: string) => {
    if (!userId) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    debounceTimerRef.current = setTimeout(async () => {
      // cargo_snapshot serve como blob — guardamos answers serializado lá temporariamente
      const blob = { answers, draft_version: 1 }
      if (existingRef.current?.plano_id) {
        await supabase
          .from('planos_estudo')
          .update({
            cargo_snapshot: blob,
            nome: planoNome ?? existingRef.current.nome,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRef.current.plano_id)
      } else {
        const { data } = await supabase
          .from('planos_estudo')
          .insert({
            user_id: userId,
            nome: planoNome ?? 'Rascunho',
            status: 'rascunho',
            mode: 'edital',
            data_inicio: new Date().toISOString().slice(0, 10),
            data_prova: new Date(Date.now() + 60 * 86400 * 1000).toISOString().slice(0, 10),
            cargo_snapshot: blob,
          })
          .select('id, updated_at')
          .single()
        if (data) {
          existingRef.current = { plano_id: data.id, nome: planoNome ?? 'Rascunho', updated_at: data.updated_at }
        }
      }
    }, DEBOUNCE_MS)
  }, [userId])

  const load = useCallback(async (): Promise<AnswersBlob | null> => {
    if (!existingRef.current) return null
    const { data } = await supabase
      .from('planos_estudo')
      .select('cargo_snapshot')
      .eq('id', existingRef.current.plano_id)
      .maybeSingle()
    const blob = data?.cargo_snapshot as { answers?: AnswersBlob } | null
    return blob?.answers ?? null
  }, [])

  const discardAll = useCallback(async () => {
    if (!userId) return
    await supabase.from('planos_estudo').delete()
      .eq('user_id', userId).eq('status', 'rascunho')
    existingRef.current = null
  }, [userId])

  return {
    existing: existingRef.current,
    loading: loadingRef.current,
    load,
    save,
    discardAll,
  }
}
```

> **Note:** Esse hook usa `cargo_snapshot` como blob temporário pra answers do wizard. Não é ideal — semanticamente `cargo_snapshot` é pro snapshot do cargo, não pro wizard. Subagent pode optar por (a) usar `cargo_snapshot` como acordado aqui ou (b) sugerir uma migration pra adicionar coluna `wizard_state JSONB` em `planos_estudo`. Reportar a decisão.

- [ ] **Step 2: Integrar no setup page**

```typescript
const [userId, setUserId] = useState<string | null>(null)
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
}, [])

const draft = useSetupDraftPersistence(userId)

// Cada vez que answers muda, salva
useEffect(() => {
  if (userId && Object.keys(answers).length > 0) {
    draft.save(answers as AnswersBlob)
  }
}, [answers, userId, draft])

// No mount, se há rascunho, oferece carregar
useEffect(() => {
  if (!draft.loading && draft.existing && Object.keys(answers).length === 0) {
    // Em vez de modal, simples confirm():
    if (window.confirm(`Você tem um rascunho de ${new Date(draft.existing.updated_at).toLocaleDateString()}. Carregar?`)) {
      draft.load().then((restored) => {
        if (restored) setAnswers(restored as Answers)
      })
    } else {
      draft.discardAll()
    }
  }
}, [draft.loading, draft.existing])
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSetupDraftPersistence.ts src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): add draft persistence (debounced + 7-day TTL)"
```

---

### Task 10: Substituir `handleSubmit` + feature flag check

**Files:**
- Modify: `src/views/CronogramaSetupPage.tsx`

Trocar inserts raw por chamada a `useCriarPlano`. Adicionar feature flag check: se V2 não está disponível, exibe banner e mantém comportamento V1 (handleSubmit antigo renomeado).

- [ ] **Step 1: Modificar `handleSubmit`**

Renomear o `handleSubmit` atual pra `handleSubmitV1` (preserva fallback). Adicionar novo:

```typescript
const criarPlano = useCriarPlano()

const handleSubmitV2 = async () => {
  setSubmitError(null)
  setSubmitting(true)
  try {
    if (!answers.cargo) throw new Error('Cargo não selecionado')

    const disciplinas = Array.from((answers.selectedDisciplinas ?? new Map()).values()).map(s => ({
      disciplina_id: s.id,
      peso: s.peso,
      nivel_conhecimento: s.nivel_conhecimento ?? 'intermediario',
      is_ponto_fraco: s.is_ponto_fraco ?? false,
      excluded_subtopico_ids: [] as string[],
    }))

    const payload = {
      cargo_id: answers.cargo.id,
      cargo_nome: answers.cargo.nome,
      data_inicio: computed.dataInicio,
      data_prova: computed.dataProva,
      weekday_minutes: computed.weekdayMinutes,
      weekend_minutes: computed.weekendMinutes,
      block_duration_minutes: 50,
      mix_ratio: {
        teoria: computed.mix.teoria / 100,
        questoes: computed.mix.questoes / 100,
        revisao: computed.mix.revisao / 100,
        flashcards: computed.mix.flashcards / 100,
      },
      simulados_freq: answers.simulados_freq ?? 'mensal',
      tem_redacao: answers.tem_redacao ?? false,
      tipo_material: answers.tipo_material ?? 'misto',
      horario_preferido: answers.horario_preferido ?? 'flexivel',
      disciplinas,
      // edital_payload: undefined,  // TODO: passar quando hook de edital estiver disponível
    }

    const result = await criarPlano.mutateAsync(payload)

    // Limpa rascunho ao criar plano definitivo
    await draft.discardAll().catch(() => {})

    // Sucesso → navega pro cronograma
    navigate('/cronograma')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setSubmitError(msg)
  } finally {
    setSubmitting(false)
  }
}

// Switch: feature flag controla qual handler usa
const [v2Enabled, setV2Enabled] = useState<boolean | null>(null)
useEffect(() => {
  // Quick probe — calls is_feature_enabled RPC
  supabase
    .rpc('is_feature_enabled', { p_flag_name: 'cronograma_v2_enabled', p_user_id: userId })
    .then(({ data }) => setV2Enabled(data === true))
    .catch(() => setV2Enabled(false))
}, [userId])

const handleSubmit = v2Enabled ? handleSubmitV2 : handleSubmitV1
```

- [ ] **Step 2: UI banner (opcional)**

Adicionar pequeno indicador no header quando V2 está ativo:

```typescript
{v2Enabled === true && (
  <div className="text-[9px] tracking-widest uppercase text-emerald-400 font-semibold">
    V2
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): wire useCriarPlano into handleSubmit + feature flag gate"
```

---

### Task 11: Docs

**Files:**
- Create: `docs/cronograma-v2/sub-plan-4-applied.md`

- [ ] **Step 1: Criar doc**

```markdown
# Sub-plan 4 — Setup flow refactor (applied)

## Mudanças

- Endpoint: `POST /api/cronograma/criar-plano` (orquestrador atomic)
- Hook: `useCriarPlano` (React Query mutation)
- 3 novos step components: CargoStep, MaterialHorarioStep, ExtrasStep
- DisciplinaRow ganhou controles nivel + ponto_fraco (max 3)
- Draft persistence: debounced 1s, TTL 7 dias
- Feature flag `cronograma_v2_enabled` gating V1/V2

## Commit chain

[Real chain from `git log --oneline 22d6f13..HEAD`]

## Como ativar V2 pro seu usuário

```sql
INSERT INTO feature_flags (flag_name, enabled, rollout_pct)
VALUES ('cronograma_v2_enabled', TRUE, 100)
ON CONFLICT (flag_name) DO UPDATE SET enabled=TRUE, rollout_pct=100;
```

Ou por allowlist específica (mais seguro pra testes):

```sql
UPDATE feature_flags
SET enabled=TRUE, user_allowlist = ARRAY['<seu-user-uuid>'::UUID]
WHERE flag_name = 'cronograma_v2_enabled';
```

## Known limitations

- Sugestões IA durante wizard (§7.3 da spec) **não implementadas**
- Mobile bottom-sheet layout (§7.7) **não testado** — pode quebrar em <768px
- `edital_payload` no `criar_plano_completo` ainda não é passado pelo wizard — RPC vai usar apenas disciplinas locais do user, não decompõe edital. Próximo sub-plan endereça isso.

## Próximo passo

Sub-plan 5 — Event loop + handlers reativos (FSRS, item.completed, week.completed).
```

- [ ] **Step 2: Commit**

```bash
git add docs/cronograma-v2/sub-plan-4-applied.md
git commit -m "docs(cronograma-v2): summary of sub-plan 4 (setup flow)"
```

---

## Self-Review

**Spec coverage:**
- §7.1 estados de entrada → parcial (rascunho via Task 9; plano ativo modal NÃO implementado, gap aceito)
- §7.2 steps wizard → cargo + extras + material/horário adicionados; objetivo/data/horas/weekend/estilo/disciplinas mantidos; conferência reusa reveal atual ✅
- §7.3 sugestões IA → **gap conhecido**, deferido
- §7.4 orquestrador → Task 2 ✅
- §7.5 RPC criar_plano_completo → integrado em Task 10 ✅
- §7.6 drafts → Task 9 ✅
- §7.7 a11y/mobile → **gap conhecido**, não testado

**Placeholder scan:** Task 5 referencia `CargoSelectorContent` que pode ou não ser exportado. Instrução explícita ao subagent pra adaptar. ✅

**Type consistency:** `SelectedDisciplina` augmentada em Task 4 e usada em Task 6 e Task 10. `SetupPayload` definida em Task 1, consumida em Tasks 2 e 3. ✅

**Scope check:** Não inclui sugestões IA em-wizard (defer), nem mobile-otimizado (defer). Inclui o core: endpoint + 3 steps novos + draft + flag + integração. ✅

**Risk register:**
- Task 4 modifica file de 1482 linhas — diff fica grande, reviewer precisa ler com calma
- Task 9 usa `cargo_snapshot` como blob temporário — semanticamente impuro, flagged. Mitigação: subagent pode propor migration nova
- Task 10 mantém `handleSubmitV1` como fallback — risco baixo de regressão V1

---

## Pré-execução checklist

- [ ] Confirmar shape de `Carreira` em `src/types/carreira.ts` (id é INT? UUID?)
- [ ] Confirmar se `CargoSelectorContent` é exportado de `src/components/CargoSelector.tsx` ou só `CargoSelector` é
- [ ] Garantir que `feature_flags` tem a row `cronograma_v2_enabled` (ou flag desliga V2 silently)

---

## Plan complete. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-4-setup-flow.md`.

**Duas opções de execução:**

1. **Subagent-Driven** (continuar padrão)
2. **Inline Execution**

Qual abordagem?
