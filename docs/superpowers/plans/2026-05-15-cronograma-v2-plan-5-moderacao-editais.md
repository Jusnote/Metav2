# Cronograma V2 — Sub-plan 5: Moderação de Editais (curadoria admin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover a decomposição IA do edital pra um workflow pré-curado por admin. Admin abre página → escolhe edital/cargo → dispara IA com progresso → revisa árvore editável (disciplinas → tópicos → subtópicos) → publica. Só cargos **publicados** ficam disponíveis no setup do V2. User não vê erro de IA, não espera 5min, não vê subtópico ruim. Setup vira instant lookup no cache.

**Architecture:**
- `edital_cache` ganha `status` (`draft`/`published`/`archived`)
- Página `/moderacao` (já existe) ganha aba/seção "Curadoria" no nível de cargo
- Botão "Curar com IA" dispara `syncEdital(skipAI:false)` e salva como `draft`
- Admin edita árvore inline, salva mudanças no `decomposicao` JSONB
- Botão "Publicar" muda status → published + grava `published_at` + `published_by`
- `/api/cronograma/criar-plano` deixa de rodar IA: lê do cache published; falha clara se cargo não tá publicado
- `useCargoEdital` filtra `published` antes de retornar

**Tech Stack:** Postgres (migration leve), React Query, NDJSON streaming (reusa padrão Sub-plan 4.6), shadcn DataTable + custom tree, Tailwind, Zod, existente `EditaisModerationPage`.

**Spec ref:** seção 5 (sync edital) + §12.5 ADRs (futura) do `docs/superpowers/specs/2026-05-14-cronograma-cargo-integration-design.md` — ADR retrocede: IA-em-runtime → pré-curado admin.

**Premissas:**
- Sub-plans 1-4.5 aplicados (66+ commits, hotfix completion_pct aplicado)
- `EditaisModerationPage.tsx` existe com nav hierárquica
- `useUserRole()` retorna `{ isAdmin }` (já usado pela página)
- `syncEdital` funcional (`src/lib/cronograma-v2/sync-edital.ts`)
- `edital_cache` existe (Sub-plan 1)

---

## File Structure

```
supabase/migrations/
  20260515130000_edital_cache_status.sql      — coluna status + audit (Task 1)

src/lib/cronograma-v2/
  edital-cache.ts                              — helpers status-aware (Task 2)
  schemas.ts                                   — adiciona schemas de tree edits (Task 2)

src/app/api/admin/editais/
  curate/route.ts                              — POST stream: dispara IA + salva draft (Task 3)
  publish/route.ts                             — POST: status → published (Task 4)
  unpublish/route.ts                           — POST: status → archived (Task 4)
  curated-list/route.ts                        — GET: lista cargos + status agregado (Task 5)
  update-decomposicao/route.ts                 — POST: salva edição do JSONB (Task 5)

src/app/api/cronograma/criar-plano/route.ts    — MODIFICADO: remove IA inline (Task 11)

src/hooks/moderation/
  useCurarEdital.ts                            — stream mutation (Task 6)
  useListaEditaisCurados.ts                    — query (Task 7)
  useUpdateDecomposicao.ts                     — mutation (Task 7)
  usePublishEdital.ts                          — mutation (Task 7)

src/components/moderation/editais/
  EditalCuradoriaPanel.tsx                     — host (botões + status) (Task 8)
  EditalCuradoriaTree.tsx                      — árvore editável (Task 9)
  EditalCuradoriaProgress.tsx                  — barra streaming IA (Task 9)
  EditalCuradoriaStatusBadge.tsx               — pill draft/published (Task 9)

src/hooks/useCargoEdital.ts                    — MODIFICADO: filtra published (Task 12)

docs/cronograma-v2/sub-plan-5-applied.md       — Task 13
```

---

## Pré-requisitos

- [ ] Sub-plans 1-4.5 + hotfix aplicados (verificado por user)
- [ ] `useUserRole` retorna `isAdmin` corretamente (já em uso)
- [ ] Branch `cargo-transition-v2`
- [ ] Seu usuário tem role admin (necessário pra testar moderação)

---

### Task 0: Setup — confirmar baseline + dirs

**Files:**
- Create: `src/app/api/admin/editais/.gitkeep`

- [ ] **Step 1:** confirmar tip e existência de `EditaisModerationPage`

```bash
cd "D:/meta novo/Metav2" && git log --oneline -3 && ls src/components/moderation/editais/
```

- [ ] **Step 2:** criar dir + commit

```bash
mkdir -p src/app/api/admin/editais
touch src/app/api/admin/editais/.gitkeep
git add src/app/api/admin/editais/.gitkeep
git commit -m "chore(cronograma-v2): create admin/editais API dir"
```

---

### Task 1: Migration — `edital_cache.status`

**Files:**
- Create: `supabase/migrations/20260515130000_edital_cache_status.sql`

Adiciona `status TEXT NOT NULL DEFAULT 'draft' CHECK (...)` + `published_at TIMESTAMPTZ` + `published_by UUID REFERENCES auth.users(id)` + índice.

- [ ] **Step 1: Criar migração**

```sql
-- UP: adiciona status + audit em edital_cache (workflow de curadoria)
-- DOWN: ALTER TABLE ... DROP COLUMN status, published_at, published_by;

ALTER TABLE edital_cache
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_edital_cache_status
  ON edital_cache(status, last_validated_at DESC);

COMMENT ON COLUMN edital_cache.status IS
  'Workflow de curadoria: draft (IA rodou, admin não revisou ainda), published (validado, disponível pro V2), archived (não usar).';
COMMENT ON COLUMN edital_cache.published_at IS
  'Quando passou pra published. NULL enquanto draft.';
COMMENT ON COLUMN edital_cache.published_by IS
  'Admin que publicou. Null se gerado por seed/auto.';
```

- [ ] **Step 2:** Aplicar via Supabase Studio SQL Editor (paste + run). Registrar no `schema_migrations`:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260515130000', 'edital_cache_status', ARRAY['ALTER TABLE edital_cache ...']);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515130000_edital_cache_status.sql
git commit -m "feat(cronograma-v2): add status workflow to edital_cache (draft/published/archived)"
```

---

### Task 2: Helpers em `edital-cache.ts` + schemas

**Files:**
- Modify: `src/lib/cronograma-v2/edital-cache.ts`
- Modify: `src/lib/cronograma-v2/schemas.ts`

Helpers status-aware + Zod schema pra updates parciais do tree.

- [ ] **Step 1: Adicionar em `edital-cache.ts`**

```typescript
export type CacheStatus = 'draft' | 'published' | 'archived'

export interface CachedEntryWithStatus extends CachedEntry {
  status: CacheStatus
  published_at: string | null
  published_by: string | null
}

/** Lê só entries publicados — usado pelo setup wizard. */
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
    cargo_id: data.cargo_id, edital_id: data.edital_id, payload_hash: data.payload_hash,
    decomposicao: validated.data, ai_model: data.ai_model,
    generated_at: data.generated_at, last_validated_at: data.last_validated_at,
  }
}

/** Lista todos cargos + status agregado (admin only). */
export async function listEditaisCurados(supabase: SupabaseClient): Promise<Array<{
  cargo_id: number; edital_id: number; status: CacheStatus;
  generated_at: string; last_validated_at: string; published_at: string | null;
  topicos_count: number;
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
    published_at: row.published_at,
    topicos_count: Object.keys((row.decomposicao as { by_topico?: Record<string, unknown> })?.by_topico ?? {}).length,
  }))
}

export async function markCachePublished(
  supabase: SupabaseClient,
  cargoId: number, editalId: number, adminUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({ status: 'published', published_at: new Date().toISOString(), published_by: adminUserId })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}

export async function markCacheArchived(
  supabase: SupabaseClient,
  cargoId: number, editalId: number,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({ status: 'archived' })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}

export async function updateDecomposicao(
  supabase: SupabaseClient,
  cargoId: number, editalId: number,
  decomposicao: EditalDecomposicao,
): Promise<void> {
  const { error } = await supabase
    .from('edital_cache')
    .update({ decomposicao, last_validated_at: new Date().toISOString() })
    .eq('cargo_id', cargoId)
    .eq('edital_id', editalId)
  if (error) throw error
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cronograma-v2/edital-cache.ts
git commit -m "feat(cronograma-v2): add status-aware cache helpers (published/draft/archived)"
```

---

### Task 3: Endpoint `/api/admin/editais/curate` (streaming)

**Files:**
- Create: `src/app/api/admin/editais/curate/route.ts`

POST recebe `{ cargo_id, edital_id, cargo_nome, disciplinas, topicos }` (mesmo shape de `EditalGraphQL`). Verifica isAdmin via service role. Roda `syncEdital(skipAI:false)` streamando progress. Salva como `draft`. Mesmo padrão NDJSON da `criar-plano`.

- [ ] **Step 1: Criar route**

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'
import { editalGraphQLSchema } from '@/lib/cronograma-v2/schemas'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  const body = await req.json().catch(() => null)
  const parsed = editalGraphQLSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 })
  }
  const edital = parsed.data

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  const userId = userData.user.id

  // Gate: só admin
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (roleData?.role !== 'admin' && roleData?.role !== 'moderator') {
    return NextResponse.json({ error: 'Acesso negado (admin only)' }, { status: 403 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
      try {
        send({ type: 'progress', stage: 'sync', message: `Iniciando IA (${edital.topicos.length} tópicos)...`, done: 0, total: edital.topicos.length })

        const result = await syncEdital(adminClient, edital, {
          skipAI: false,
          forceRefresh: true,
          onProgress: (done, total) => send({
            type: 'progress', stage: 'sync',
            message: `Decompondo tópicos (${done}/${total})...`, done, total,
          }),
        })

        // syncEdital já gravou em edital_cache com status default 'draft'
        send({
          type: 'done',
          cargo_id: edital.cargo_id,
          edital_id: edital.edital_id,
          decomposed_topicos: result.decomposed_topicos,
          fallback_topicos: result.fallback_topicos,
          total_topicos: result.total_topicos,
          status: 'draft',
        })
        controller.close()
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Erro' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
```

> **Pre-flight subagent:** confirmar que `user_roles` tabela e schema existem (a página `EditaisModerationPage` já usa `useUserRole` — então provavelmente sim). Se for tabela diferente, ajustar.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/editais/curate/route.ts
git commit -m "feat(cronograma-v2): admin endpoint POST /admin/editais/curate (streaming IA)"
```

---

### Task 4: Endpoints publish + unpublish

**Files:**
- Create: `src/app/api/admin/editais/publish/route.ts`
- Create: `src/app/api/admin/editais/unpublish/route.ts`

Ambos: auth + role check + body `{ cargo_id, edital_id }` → `markCachePublished` / `markCacheArchived`.

- [ ] **Step 1: Criar publish route**

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { markCachePublished } from '@/lib/cronograma-v2/edital-cache'
import { z } from 'zod'

const bodySchema = z.object({
  cargo_id: z.number().int().positive(),
  edital_id: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  // ... auth + role check igual Task 3 ...
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })

  try {
    await markCachePublished(adminClient, parsed.data.cargo_id, parsed.data.edital_id, userId)
    return NextResponse.json({ ok: true, published_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Criar unpublish route** (igual mas chama `markCacheArchived` e não passa userId)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/editais/publish/route.ts src/app/api/admin/editais/unpublish/route.ts
git commit -m "feat(cronograma-v2): admin endpoints publish + unpublish for edital cache"
```

---

### Task 5: Endpoint `curated-list` + `update-decomposicao`

**Files:**
- Create: `src/app/api/admin/editais/curated-list/route.ts`
- Create: `src/app/api/admin/editais/update-decomposicao/route.ts`

Listagem + edição da árvore.

- [ ] **Step 1: curated-list (GET)** — chama `listEditaisCurados` e retorna array
- [ ] **Step 2: update-decomposicao (POST)** — body `{cargo_id, edital_id, decomposicao}` validado contra `editalDecomposicaoSchema`, chama `updateDecomposicao`
- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/editais/curated-list/route.ts src/app/api/admin/editais/update-decomposicao/route.ts
git commit -m "feat(cronograma-v2): admin endpoints list curated + update tree decomposicao"
```

---

### Task 6: Hook `useCurarEdital` (stream)

**Files:**
- Create: `src/hooks/moderation/useCurarEdital.ts`

React Query mutation que faz POST streaming pra `/api/admin/editais/curate`. Reuso do padrão do `useCriarPlano` (Sub-plan 4.6): expõe `progress` state, retorna `done` event.

- [ ] **Step 1:** copiar estrutura do `useCriarPlano.ts`, trocar URL e payload type, simplificar response shape.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/moderation/useCurarEdital.ts
git commit -m "feat(cronograma-v2): useCurarEdital hook (streaming progress)"
```

---

### Task 7: Hooks de leitura + ações simples

**Files:**
- Create: `src/hooks/moderation/useListaEditaisCurados.ts`
- Create: `src/hooks/moderation/usePublishEdital.ts`
- Create: `src/hooks/moderation/useUpdateDecomposicao.ts`

3 hooks pequenos:
- `useListaEditaisCurados()` — useQuery GET, retorna array de status agregado
- `usePublishEdital()` — useMutation POST publish; invalida lista
- `useUpdateDecomposicao()` — useMutation POST update-decomposicao; invalida lista

Commit único.

```bash
git add src/hooks/moderation/useListaEditaisCurados.ts src/hooks/moderation/usePublishEdital.ts src/hooks/moderation/useUpdateDecomposicao.ts
git commit -m "feat(cronograma-v2): hooks for lista/publish/update of curated editais"
```

---

### Task 8: Component `EditalCuradoriaPanel`

**Files:**
- Create: `src/components/moderation/editais/EditalCuradoriaPanel.tsx`

Painel principal. Recebe `cargoId, editalId, cargoNome` via props. Comportamento:

1. Carrega status atual via `useListaEditaisCurados` (filtrado)
2. Se **sem cache**: botão "Iniciar curadoria com IA" → dispara `useCurarEdital(payload)`
3. Durante streaming: mostra `EditalCuradoriaProgress` com barra
4. Se **draft**: mostra `EditalCuradoriaTree` (editável) + botão "Publicar" (chama `usePublishEdital`)
5. Se **published**: mostra `EditalCuradoriaTree` (read-only) + botões "Re-curar" e "Arquivar"
6. Status badge no topo (`EditalCuradoriaStatusBadge`)

- [ ] **Step 1: Criar componente** (boilerplate)

Estrutura esquemática:
```tsx
export function EditalCuradoriaPanel({ cargoId, editalId, cargoNome, editalPayload }: Props) {
  const lista = useListaEditaisCurados()
  const curarMut = useCurarEdital()
  const publishMut = usePublishEdital()
  const updateMut = useUpdateDecomposicao()

  const status = lista.data?.find(x => x.cargo_id === cargoId && x.edital_id === editalId)?.status
    ?? 'no_cache'

  if (curarMut.isPending) return <EditalCuradoriaProgress progress={curarMut.progress} />
  if (status === 'no_cache') return <CuradoriaCallToAction onStart={() => curarMut.mutate(editalPayload)} />
  return (
    <div>
      <EditalCuradoriaStatusBadge status={status} />
      <EditalCuradoriaTree
        decomposicao={lista.data?.find(...)?.decomposicao}
        readOnly={status === 'published'}
        onChange={(newDecomp) => updateMut.mutate({ cargoId, editalId, decomposicao: newDecomp })}
      />
      {status === 'draft' && <button onClick={() => publishMut.mutate({ cargoId, editalId })}>Publicar</button>}
      {status === 'published' && <button onClick={() => unpublishMut.mutate({ cargoId, editalId })}>Arquivar</button>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/editais/EditalCuradoriaPanel.tsx
git commit -m "feat(cronograma-v2): EditalCuradoriaPanel (host pra workflow admin)"
```

---

### Task 9: Tree component + Progress + Badge

**Files:**
- Create: `src/components/moderation/editais/EditalCuradoriaTree.tsx`
- Create: `src/components/moderation/editais/EditalCuradoriaProgress.tsx`
- Create: `src/components/moderation/editais/EditalCuradoriaStatusBadge.tsx`

**Tree**: árvore expandível 3-nível (decomp.by_topico → conceitos_pai → subtopicos). Cada subtopico tem input pra `nome` e `duracao_min`, botão delete (X). Botão "+" pra adicionar subtopico. Em `readOnly` desabilita inputs. Emite `onChange(newDecomposicao)` debounced.

**Progress**: barra emerald + mensagem + done/total + percent (reusa padrão do RevealActions).

**Badge**: pill colorida — `draft` amber, `published` emerald, `archived` slate, `no_cache` outline.

- [ ] **Step 1:** Tree (mais complexo, ~150 LOC)

Estrutura:
```tsx
export function EditalCuradoriaTree({ decomposicao, readOnly, onChange }: Props) {
  const [local, setLocal] = useState(decomposicao)
  const debouncedSync = useDebouncedCallback(onChange, 800)
  
  const updateSubtopico = (topicoId, subIndex, patch) => {
    setLocal(prev => {
      const next = structuredClone(prev)
      next.by_topico[topicoId].subtopicos[subIndex] = { ...next.by_topico[topicoId].subtopicos[subIndex], ...patch }
      return next
    })
    debouncedSync(next)
  }
  // ... renderiza accordions por topico, dentro cada subtopico vira <div> com inputs
}
```

- [ ] **Step 2:** Progress (~30 LOC, copiar de RevealActions)

- [ ] **Step 3:** Badge (~20 LOC)

- [ ] **Step 4: Commit**

```bash
git add src/components/moderation/editais/EditalCuradoriaTree.tsx src/components/moderation/editais/EditalCuradoriaProgress.tsx src/components/moderation/editais/EditalCuradoriaStatusBadge.tsx
git commit -m "feat(cronograma-v2): tree + progress + status badge components"
```

---

### Task 10: Integrar `EditalCuradoriaPanel` em `EditaisModerationPage`

**Files:**
- Modify: `src/components/moderation/editais/EditaisModerationPage.tsx`

Quando admin tá no nível 'cargo' (breadcrumb com edital → cargo selecionado), aparece o painel de curadoria abaixo do drawer/data table existente. Buscar topicos+disciplinas pelo GraphQL ANTES de passar pro panel.

- [ ] **Step 1:** localizar onde nível 'cargo' é renderizado, adicionar `<EditalCuradoriaPanel cargoId=... editalId=... />` quando há cargo selecionado.

Pode precisar de um novo hook `useEditalGraphQLPayload(cargoId, editalId)` que monta o `EditalGraphQL` shape (disciplinas + topicos) — espelhar `useCargoEdital` mas sem fetch de tudo.

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/editais/EditaisModerationPage.tsx
git commit -m "feat(cronograma-v2): integrate EditalCuradoriaPanel into moderation page"
```

---

### Task 11: Refator `/api/cronograma/criar-plano` — remove IA inline

**Files:**
- Modify: `src/app/api/cronograma/criar-plano/route.ts`

Substituir o `syncEdital(skipAI:false, forceRefresh)` inline (que tá demorando 5min) por **leitura simples do cache published**:

```typescript
// Antes: syncEdital com IA
// Depois:
const cached = await getPublishedDecomposicao(adminClient, cargoId, editalId)
if (!cached) {
  send({ type: 'error', message: `Cargo "${cargoNome}" ainda não foi curado pelo admin — V2 indisponível.` })
  return
}
editalDecomposicao = cached.decomposicao
```

Remove o codepath de IA (fica só na rota admin). Endpoint do user fica rápido (sub-1s).

- [ ] **Step 1: Modificar route**
- [ ] **Step 2: Commit**

```bash
git add src/app/api/cronograma/criar-plano/route.ts
git commit -m "refactor(cronograma-v2): remove inline IA from criar-plano, require published cache"
```

---

### Task 12: Filtrar cargos publicados no setup

**Files:**
- Modify: `src/hooks/useCargoEdital.ts`

`useCargoEdital(nomeCargo)` hoje busca em todos os editais. Adicionar uma 2ª query que checa `edital_cache.status='published'` pro (cargoId, editalId) do match — só retorna `data` se published; senão `notFound=true`.

- [ ] **Step 1: Modificar hook**

```typescript
// Depois do match GraphQL, adicionar:
const publishedCheck = useQuery({
  queryKey: ['edital-published-check', match?.cargoId, match?.editalId],
  queryFn: async () => {
    const supabase = await import('@/integrations/supabase/client').then(m => m.supabase)
    const { data } = await supabase.from('edital_cache')
      .select('status').eq('cargo_id', match!.cargoId).eq('edital_id', match!.editalId)
      .eq('status', 'published').maybeSingle()
    return !!data
  },
  enabled: !!match,
})

// retornar notFound=true se !publishedCheck.data
```

- [ ] **Step 2:** Adicionar banner mais claro na UI do setup: "Cargo ainda não disponível no V2 — peça pra admin curar"

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCargoEdital.ts src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): only expose published cargos to setup wizard"
```

---

### Task 13: Doc

**Files:**
- Create: `docs/cronograma-v2/sub-plan-5-applied.md`

Documentar: workflow novo (admin cura → user usa cache), endpoints, status table, rationale do trade-off (qualidade > velocidade até admin processar).

- [ ] **Step 1:** Doc com commit chain real
- [ ] **Step 2: Commit**

```bash
git add docs/cronograma-v2/sub-plan-5-applied.md
git commit -m "docs(cronograma-v2): summary of sub-plan 5 (moderacao editais)"
```

---

## Self-Review

**Cobertura da nova arquitetura:**
- Status workflow → Task 1 ✅
- Admin endpoints (curate, publish, list, update) → Tasks 3-5 ✅
- UI curadoria → Tasks 8-10 ✅
- User-side gating (só published) → Tasks 11-12 ✅
- Remoção da IA inline do hot path → Task 11 ✅

**Risk register:**
- **`user_roles` schema desconhecido**: subagent deve confirmar via SELECT no Studio antes da Task 3. Se nome de tabela for outro (ex: `usuarios.role`), adaptar.
- **Tree edit conflicts**: dois admins editando ao mesmo tempo → last-write-wins. Aceitável pra MVP. Futuro: optimistic lock via `last_validated_at`.
- **Tree muito grande na UI**: 100+ tópicos × 5+ subtópicos = 500 inputs. Pode lagar. Virtualize se vier feedback.
- **Re-curadoria substitui draft**: Task 3 usa `forceRefresh:true` → sobrescreve cache atual. Se admin já editou um draft, re-curar perde edições. Mitigação: confirm dialog "Vai sobrescrever — tem certeza?" no botão "Re-curar". Subagent adiciona.

**Spec alignment:**
- ADR não escrita ainda — Sub-plan 5 *é* a ADR-001 do app (V2 muda de IA-em-runtime pra pré-curado).

---

## Pré-execução checklist

- [ ] Confirmar tabela `user_roles` (ou onde isAdmin checa)
- [ ] Confirmar seu user_id tem `role='admin'` (senão Task 8 não testa)
- [ ] Sub-plan 4.5 hotfix `completion_pct` aplicado no Studio (já feito)

---

## Plan complete. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-5-moderacao-editais.md`.

**Duas opções:** Subagent-Driven (padrão) ou Inline.
