# Cronograma V2 — Sub-plan 5.5: Página dedicada de Curadoria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Página tree-first dedicada à curadoria de editais (`/moderacao/curadoria-editais`). Substitui o painel inline da Sub-plan 5 (que ficou enxertado no CRUD existente) por uma UX dedicada com sidebar de cargos + tree completa editável inline + ações de alto nível + origin tracking (IA vs manual). CRUD legado em `/moderacao/editais` continua intocado pra gerenciar dados brutos.

**Architecture:**
- Rota nova `/moderacao/curadoria-editais` (já tem `ModerationShell`)
- Layout 2 colunas: sidebar 320px com lista de cargos + filtros + main com tree
- Tree mescla `EditalGraphQL` (disciplinas + tópicos da API) com `edital_cache.decomposicao` (subtópicos da IA + manuais)
- Edição inline com autosave debounced 800ms via `useUpdateDecomposicao` (existente)
- Origin tracking: cada subtopico ganha `origin: 'ai'|'manual'` no JSONB
- Visual: pill verde published, amber draft, cinza archived; origin marcado com dot colorido
- Ações por nível: "Curar IA" no cargo, "Re-curar" na disciplina, "+ subtópico" no tópico

**Tech Stack:** React, React Query, Tailwind, shadcn, Zod (schema update pra origin), debouncedCallback, hooks da Sub-plan 5.

**Spec ref:** evolução natural da Sub-plan 5 — separa "ferramenta de curadoria" da "ferramenta de CRUD de editais".

**Premissas:**
- Sub-plan 5 inteiramente aplicado (migration + endpoints + hooks)
- `EditalCuradoriaPanel` continua existindo no caminho antigo (não removido) — admin pode escolher qual usa
- Hooks Sub-plan 5 reusados: `useListaEditaisCurados`, `useCurarEdital`, `usePublishEdital`, `useUnpublishEdital`, `useUpdateDecomposicao`
- `useDisciplinasApi` + `useTopicosApi` (existentes) reusados pra GraphQL

---

## File Structure

```
src/lib/cronograma-v2/
  schemas.ts                          — MODIFICADO: adiciona `origin` no SubtopicoDecomposed (Task 1)

src/hooks/moderation/
  useCuradoriaTree.ts                 — NOVO: tree merge (GraphQL + cache) (Task 2)
  useCargosCurados.ts                 — NOVO: lista de cargos com status (Task 3)

src/views/
  CuradoriaEditaisPage.tsx            — NOVA página /moderacao/curadoria-editais (Task 4)

src/components/moderation/curadoria/
  CargoListSidebar.tsx                — sidebar lista + filtros (Task 5)
  CargoListItem.tsx                   — row da sidebar (Task 5)
  CuradoriaTreeMain.tsx               — main panel (Task 6)
  DisciplinaSection.tsx               — section de uma disciplina (Task 7)
  TopicoSection.tsx                   — section de um topico (Task 7)
  SubtopicoRow.tsx                    — row inline editável (Task 7)
  CuradoriaActions.tsx                — top action bar (Task 8)
  OriginBadge.tsx                     — dot indicador IA/manual (Task 8)
  CuradoriaEmptyState.tsx             — quando não há cargo selecionado (Task 8)

src/App.tsx                           — adiciona rota (Task 9)
src/components/moderation/layout/ModerationShell.tsx  — link no menu lateral (Task 9)

docs/cronograma-v2/sub-plan-5-5-applied.md  — doc (Task 10)
```

---

## Pré-requisitos

- [ ] Sub-plan 5 aplicado completo (migration `edital_cache.status` no remote ✅)
- [ ] User logado tem role admin (`user_roles.role='admin'`)
- [ ] Pelo menos 1 edital com cache rodado (mesmo que draft) pra testar — senão Task 6 valida o empty state

---

### Task 1: Origin tracking no schema

**Files:**
- Modify: `src/lib/cronograma-v2/schemas.ts`

Adicionar `origin: 'ai' | 'manual'` no `SubtopicoDecomposed`. Default `'ai'` pra retrocompat (entries antigas viraram IA). Manuais sempre adicionados com `'manual'`.

- [ ] **Step 1: Modificar schema**

```typescript
export const subtopicoDecomposedSchema = z.object({
  nome: z.string().min(3).max(200),
  duracao_min: z.number().int().min(15).max(120),
  conceito_pai: z.string().min(1).max(80),
  origin: z.enum(['ai', 'manual']).default('ai'),  // ⬅ novo
})
```

Zod `.default('ai')` faz com que entries antigas sem o campo virem 'ai' no parse.

- [ ] **Step 2: Commit**

```bash
git add src/lib/cronograma-v2/schemas.ts
git commit -m "feat(cronograma-v2): add origin field to SubtopicoDecomposed (ai|manual)"
```

---

### Task 2: Hook `useCuradoriaTree`

**Files:**
- Create: `src/hooks/moderation/useCuradoriaTree.ts`

Mescla GraphQL (disciplinas + topicos do cargo) com `edital_cache.decomposicao` (subtopicos). Resultado: lista hierárquica pronta pra renderizar.

- [ ] **Step 1: Criar hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { editaisQuery } from '@/lib/editais-client'
import { supabase } from '@/integrations/supabase/client'
import {
  editalDecomposicaoSchema,
  type EditalDecomposicao,
  type SubtopicoDecomposed,
} from '@/lib/cronograma-v2/schemas'
import type { ApiDisciplina, ApiTopico } from '@/hooks/useEditaisData'

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id fonteId nome nomeEdital totalTopicos }
  }
`

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id fonteId nome ordem }
  }
`

export interface CuradoriaTreeNode {
  disciplinaId: number
  disciplinaNome: string
  topicos: Array<{
    topicoId: number
    topicoNome: string
    subtopicos: SubtopicoDecomposed[]   // do cache; vazio se nada curado ainda
  }>
}

export interface UseCuradoriaTreeResult {
  tree: CuradoriaTreeNode[]
  decomposicao: EditalDecomposicao | null
  status: 'no_cache' | 'draft' | 'published' | 'archived'
  cargoNome: string
  editalNome: string
  isLoading: boolean
  error: Error | null
}

export function useCuradoriaTree(
  cargoId: number | null,
  editalId: number | null,
  cargoNome: string | null,
  editalNome: string | null,
): UseCuradoriaTreeResult {
  // 1. Cache row (status + decomposicao)
  const cacheQuery = useQuery({
    queryKey: ['edital-cache-row', cargoId, editalId],
    queryFn: async () => {
      if (!cargoId || !editalId) return null
      const { data } = await supabase
        .from('edital_cache')
        .select('status, decomposicao, published_at')
        .eq('cargo_id', cargoId)
        .eq('edital_id', editalId)
        .maybeSingle()
      return data
    },
    enabled: !!cargoId && !!editalId,
    staleTime: 10_000,
  })

  // 2. GraphQL disciplinas + topicos
  const graphQuery = useQuery({
    queryKey: ['curadoria-graph', cargoId],
    queryFn: async () => {
      if (!cargoId) return { disciplinas: [], topicos: [] as ApiTopico[] }
      const { data: dd } = await editaisQuery<{ disciplinas: ApiDisciplina[] }>(
        DISCIPLINAS_QUERY, { cargoId },
      )
      const disciplinas = dd?.disciplinas ?? []
      const topicosArrays = await Promise.all(
        disciplinas.map(async (d) => {
          const { data: td } = await editaisQuery<{ topicos: ApiTopico[] }>(
            TOPICOS_QUERY, { disciplinaId: d.id },
          )
          return (td?.topicos ?? []).map((t) => ({ ...t, disciplina_id: d.id }))
        }),
      )
      return { disciplinas, topicos: topicosArrays.flat() }
    },
    enabled: !!cargoId,
    staleTime: 5 * 60 * 1000,
  })

  // 3. Merge
  const decomposicao = cacheQuery.data?.decomposicao
    ? editalDecomposicaoSchema.safeParse(cacheQuery.data.decomposicao).data ?? null
    : null

  const tree: CuradoriaTreeNode[] = (graphQuery.data?.disciplinas ?? []).map((d) => {
    const topicos = (graphQuery.data?.topicos ?? [])
      .filter((t) => Number(t.disciplina_id) === d.id)
      .map((t) => {
        const decomp = decomposicao?.by_topico[String(t.id)]
        return {
          topicoId: t.id,
          topicoNome: t.nome,
          subtopicos: decomp?.subtopicos ?? [],
        }
      })
    return { disciplinaId: d.id, disciplinaNome: d.nome, topicos }
  })

  const status = cacheQuery.data?.status as UseCuradoriaTreeResult['status'] ?? 'no_cache'

  return {
    tree,
    decomposicao,
    status,
    cargoNome: cargoNome ?? '',
    editalNome: editalNome ?? '',
    isLoading: cacheQuery.isLoading || graphQuery.isLoading,
    error: (cacheQuery.error ?? graphQuery.error) as Error | null,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/moderation/useCuradoriaTree.ts
git commit -m "feat(cronograma-v2): useCuradoriaTree merging GraphQL + cache"
```

---

### Task 3: Hook `useCargosCurados`

**Files:**
- Create: `src/hooks/moderation/useCargosCurados.ts`

Lista de cargos da API com seus status agregados via cache. Resultado: array `[{cargoId, cargoNome, editalId, editalNome, status, lastValidatedAt}]`.

- [ ] **Step 1: Criar hook**

```typescript
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { editaisQuery } from '@/lib/editais-client'
import { useListaEditaisCurados } from './useListaEditaisCurados'

const CARGOS_ALL_QUERY = `
  query CargosAll($pagina: Int!, $porPagina: Int!) {
    editais(filtro: { ativo: true }, pagina: $pagina, porPagina: $porPagina) {
      dados { id nome }
    }
  }
`

const CARGOS_BY_EDITAL = `
  query CargosByEdital($editalId: Int!) {
    cargos(editalId: $editalId) { id nome }
  }
`

export interface CargoCurado {
  cargoId: number
  cargoNome: string
  editalId: number
  editalNome: string
  status: 'no_cache' | 'draft' | 'published' | 'archived'
  lastValidatedAt: string | null
  topicosCount: number
}

export function useCargosCurados() {
  const cacheList = useListaEditaisCurados()

  const cargosQuery = useQuery({
    queryKey: ['curadoria-cargos-all'],
    queryFn: async () => {
      const { data: ld } = await editaisQuery<{
        editais: { dados: Array<{ id: number; nome: string }> }
      }>(CARGOS_ALL_QUERY, { pagina: 1, porPagina: 200 })
      const editais = ld?.editais?.dados ?? []
      const all = await Promise.all(
        editais.map(async (e) => {
          const { data: cd } = await editaisQuery<{ cargos: Array<{ id: number; nome: string }> }>(
            CARGOS_BY_EDITAL, { editalId: e.id },
          )
          return (cd?.cargos ?? []).map((c) => ({
            cargoId: c.id, cargoNome: c.nome, editalId: e.id, editalNome: e.nome,
          }))
        }),
      )
      return all.flat()
    },
    staleTime: 30 * 60 * 1000,
  })

  return useMemo<{ items: CargoCurado[]; isLoading: boolean; error: Error | null }>(() => {
    const items: CargoCurado[] = (cargosQuery.data ?? []).map((c) => {
      const cached = cacheList.data?.find(
        (x) => x.cargo_id === c.cargoId && x.edital_id === c.editalId,
      )
      return {
        ...c,
        status: (cached?.status ?? 'no_cache') as CargoCurado['status'],
        lastValidatedAt: cached?.last_validated_at ?? null,
        topicosCount: cached?.topicos_count ?? 0,
      }
    })
    return {
      items,
      isLoading: cargosQuery.isLoading || cacheList.isLoading,
      error: (cargosQuery.error ?? cacheList.error) as Error | null,
    }
  }, [cargosQuery.data, cargosQuery.isLoading, cargosQuery.error, cacheList.data, cacheList.isLoading, cacheList.error])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/moderation/useCargosCurados.ts
git commit -m "feat(cronograma-v2): useCargosCurados aggregating cargos + cache status"
```

---

### Task 4: Página `CuradoriaEditaisPage`

**Files:**
- Create: `src/views/CuradoriaEditaisPage.tsx`

Layout 2 colunas + state de cargo selecionado.

- [ ] **Step 1: Criar página**

```tsx
'use client'

import { useState } from 'react'
import { useUserRole } from '@/hooks/moderation/useUserRole'
import { CargoListSidebar } from '@/components/moderation/curadoria/CargoListSidebar'
import { CuradoriaTreeMain } from '@/components/moderation/curadoria/CuradoriaTreeMain'
import { CuradoriaEmptyState } from '@/components/moderation/curadoria/CuradoriaEmptyState'

export default function CuradoriaEditaisPage() {
  const { isAdmin, isLoading } = useUserRole()
  const [selected, setSelected] = useState<{
    cargoId: number
    editalId: number
    cargoNome: string
    editalNome: string
  } | null>(null)

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Carregando…</div>
  if (!isAdmin) {
    return (
      <div className="p-8 text-sm text-rose-600">
        Acesso restrito. Você precisa de role admin.
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex bg-slate-50">
      <aside className="w-[340px] border-r border-slate-200 bg-white overflow-y-auto">
        <CargoListSidebar
          selectedKey={selected ? `${selected.cargoId}-${selected.editalId}` : null}
          onSelect={(c) => setSelected(c)}
        />
      </aside>
      <main className="flex-1 overflow-y-auto">
        {selected ? (
          <CuradoriaTreeMain
            cargoId={selected.cargoId}
            editalId={selected.editalId}
            cargoNome={selected.cargoNome}
            editalNome={selected.editalNome}
          />
        ) : (
          <CuradoriaEmptyState />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/CuradoriaEditaisPage.tsx
git commit -m "feat(cronograma-v2): CuradoriaEditaisPage shell (sidebar + main)"
```

---

### Task 5: `CargoListSidebar` + `CargoListItem`

**Files:**
- Create: `src/components/moderation/curadoria/CargoListSidebar.tsx`
- Create: `src/components/moderation/curadoria/CargoListItem.tsx`

Sidebar com search + filtro por status + lista de cargos. Cada item mostra nome, edital, status pill, count de tópicos.

- [ ] **Step 1: Criar `CargoListItem.tsx`**

```tsx
import { cn } from '@/lib/utils'
import type { CargoCurado } from '@/hooks/moderation/useCargosCurados'

const STATUS_COLOR: Record<CargoCurado['status'], { bg: string; text: string; label: string }> = {
  no_cache:  { bg: 'bg-slate-100',    text: 'text-slate-600',    label: 'Sem cache' },
  draft:     { bg: 'bg-amber-100',    text: 'text-amber-800',    label: 'Em curadoria' },
  published: { bg: 'bg-emerald-100',  text: 'text-emerald-800',  label: 'Publicado' },
  archived:  { bg: 'bg-slate-200',    text: 'text-slate-500',    label: 'Arquivado' },
}

export function CargoListItem({
  cargo, selected, onClick,
}: {
  cargo: CargoCurado
  selected: boolean
  onClick: () => void
}) {
  const c = STATUS_COLOR[cargo.status]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-slate-100 transition',
        selected ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{cargo.cargoNome}</div>
          <div className="text-xs text-slate-500 truncate mt-0.5">{cargo.editalNome}</div>
        </div>
        <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full whitespace-nowrap', c.bg, c.text)}>
          {c.label}
        </span>
      </div>
      {cargo.topicosCount > 0 && (
        <div className="text-[10px] text-slate-400 mt-1">
          {cargo.topicosCount} tópicos curados
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Criar `CargoListSidebar.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useCargosCurados, type CargoCurado } from '@/hooks/moderation/useCargosCurados'
import { CargoListItem } from './CargoListItem'

type FiltroStatus = 'todos' | CargoCurado['status']

export function CargoListSidebar({
  selectedKey, onSelect,
}: {
  selectedKey: string | null
  onSelect: (c: { cargoId: number; editalId: number; cargoNome: string; editalNome: string }) => void
}) {
  const { items, isLoading } = useCargosCurados()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')

  const filtered = useMemo(() => {
    const b = busca.toLowerCase().trim()
    return items
      .filter((c) => filtro === 'todos' || c.status === filtro)
      .filter((c) =>
        !b || c.cargoNome.toLowerCase().includes(b) || c.editalNome.toLowerCase().includes(b),
      )
      .sort((a, b) => {
        // Prioriza não-publicados (mais ação necessária)
        const order = { draft: 0, no_cache: 1, archived: 2, published: 3 }
        return order[a.status] - order[b.status] || a.cargoNome.localeCompare(b.cargoNome)
      })
  }, [items, busca, filtro])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 space-y-2 sticky top-0 bg-white z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cargo ou edital"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['todos', 'no_cache', 'draft', 'published', 'archived'] as FiltroStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`text-[10px] uppercase font-semibold px-2 py-1 rounded-full transition ${
                filtro === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'no_cache' ? 'Sem cache' : f === 'draft' ? 'Curadoria' : f === 'published' ? 'Publicado' : 'Arquivado'}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-400">{filtered.length} cargos</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Nenhum cargo bate com o filtro.</div>
        ) : (
          filtered.map((c) => {
            const key = `${c.cargoId}-${c.editalId}`
            return (
              <CargoListItem
                key={key}
                cargo={c}
                selected={selectedKey === key}
                onClick={() => onSelect({ cargoId: c.cargoId, editalId: c.editalId, cargoNome: c.cargoNome, editalNome: c.editalNome })}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/curadoria/CargoListSidebar.tsx src/components/moderation/curadoria/CargoListItem.tsx
git commit -m "feat(cronograma-v2): CargoListSidebar + Item (filter + search)"
```

---

### Task 6: `CuradoriaTreeMain`

**Files:**
- Create: `src/components/moderation/curadoria/CuradoriaTreeMain.tsx`

Main panel: header (cargo nome + status + ações) + tree de disciplinas.

- [ ] **Step 1: Criar componente**

```tsx
'use client'

import { useState } from 'react'
import { useCuradoriaTree } from '@/hooks/moderation/useCuradoriaTree'
import { CuradoriaActions } from './CuradoriaActions'
import { DisciplinaSection } from './DisciplinaSection'
import { useUpdateDecomposicao } from '@/hooks/moderation/useUpdateDecomposicao'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'  // Task 7 cria isso se não existe
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export function CuradoriaTreeMain({
  cargoId, editalId, cargoNome, editalNome,
}: {
  cargoId: number; editalId: number; cargoNome: string; editalNome: string
}) {
  const tree = useCuradoriaTree(cargoId, editalId, cargoNome, editalNome)
  const updateMut = useUpdateDecomposicao()
  const [localDecomp, setLocalDecomp] = useState<EditalDecomposicao | null>(null)
  const decomp = localDecomp ?? tree.decomposicao

  const debouncedSave = useDebouncedCallback((next: EditalDecomposicao) => {
    updateMut.mutate({ cargo_id: cargoId, edital_id: editalId, decomposicao: next })
  }, 800)

  const handleChange = (next: EditalDecomposicao) => {
    setLocalDecomp(next)
    debouncedSave(next)
  }

  // Reset local on cargo change
  if (tree.decomposicao && !localDecomp) {
    // ok use directly
  }

  if (tree.isLoading) return <div className="p-8 text-slate-500">Carregando…</div>
  if (tree.error) return <div className="p-8 text-rose-600">Erro: {tree.error.message}</div>

  return (
    <div>
      <header className="sticky top-0 bg-white border-b border-slate-200 z-10 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{cargoNome}</h1>
          <span className="text-xs text-slate-500">{editalNome}</span>
        </div>
        <CuradoriaActions
          cargoId={cargoId}
          editalId={editalId}
          cargoNome={cargoNome}
          status={tree.status}
          editalPayload={{
            cargo_id: cargoId,
            edital_id: editalId,
            cargo_nome: cargoNome,
            disciplinas: tree.tree.map((d) => ({ id: d.disciplinaId, nome: d.disciplinaNome })),
            topicos: tree.tree.flatMap((d) =>
              d.topicos.map((t) => ({ id: t.topicoId, disciplina_id: d.disciplinaId, nome: t.topicoNome })),
            ),
          }}
        />
      </header>

      <div className="px-6 py-6 space-y-4">
        {tree.tree.length === 0 && (
          <div className="text-sm text-slate-500">Nenhuma disciplina encontrada no GraphQL.</div>
        )}
        {tree.tree.map((d) => (
          <DisciplinaSection
            key={d.disciplinaId}
            disciplina={d}
            decomposicao={decomp}
            readOnly={tree.status === 'published'}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/curadoria/CuradoriaTreeMain.tsx
git commit -m "feat(cronograma-v2): CuradoriaTreeMain with header + autosaved tree"
```

---

### Task 7: Tree sections (DisciplinaSection + TopicoSection + SubtopicoRow) + useDebouncedCallback

**Files:**
- Create: `src/hooks/useDebouncedCallback.ts` (se não existir)
- Create: `src/components/moderation/curadoria/DisciplinaSection.tsx`
- Create: `src/components/moderation/curadoria/TopicoSection.tsx`
- Create: `src/components/moderation/curadoria/SubtopicoRow.tsx`

3 componentes recursivos com edição inline.

- [ ] **Step 1:** `useDebouncedCallback` (pequeno hook):

```typescript
import { useEffect, useRef } from 'react'

export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void, delay: number,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn }, [fn])

  return (...args: Args) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fnRef.current(...args), delay)
  }
}
```

- [ ] **Step 2:** `SubtopicoRow.tsx` — row editável (nome + duracao + delete + origin badge):

```tsx
import { Trash2 } from 'lucide-react'
import { OriginBadge } from './OriginBadge'
import type { SubtopicoDecomposed } from '@/lib/cronograma-v2/schemas'

export function SubtopicoRow({
  sub, readOnly, onChange, onDelete,
}: {
  sub: SubtopicoDecomposed
  readOnly: boolean
  onChange: (next: SubtopicoDecomposed) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-slate-50 rounded-lg">
      <OriginBadge origin={sub.origin ?? 'ai'} />
      <input
        type="text"
        value={sub.nome}
        disabled={readOnly}
        onChange={(e) => onChange({ ...sub, nome: e.target.value })}
        className="flex-1 text-sm bg-transparent border-none focus:outline-none focus:bg-white focus:px-2 focus:rounded disabled:cursor-not-allowed"
      />
      <input
        type="number"
        value={sub.duracao_min}
        disabled={readOnly}
        min={15} max={120}
        onChange={(e) => onChange({ ...sub, duracao_min: Number(e.target.value) || 45 })}
        className="w-16 text-xs text-right bg-transparent border-none focus:outline-none focus:bg-white focus:rounded disabled:cursor-not-allowed"
      />
      <span className="text-[10px] text-slate-400">min</span>
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-300 hover:text-rose-500 transition"
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3:** `TopicoSection.tsx`:

```tsx
import { Plus } from 'lucide-react'
import { SubtopicoRow } from './SubtopicoRow'
import type { SubtopicoDecomposed, EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export function TopicoSection({
  topicoId, topicoNome, decomp, readOnly, onChange,
}: {
  topicoId: number
  topicoNome: string
  decomp: EditalDecomposicao | null
  readOnly: boolean
  onChange: (next: EditalDecomposicao) => void
}) {
  const subtopicos: SubtopicoDecomposed[] = decomp?.by_topico[String(topicoId)]?.subtopicos ?? []

  const updateSub = (i: number, next: SubtopicoDecomposed) => {
    if (!decomp) return
    const cloned = structuredClone(decomp)
    if (!cloned.by_topico[String(topicoId)]) return
    cloned.by_topico[String(topicoId)].subtopicos[i] = next
    onChange(cloned)
  }

  const deleteSub = (i: number) => {
    if (!decomp) return
    const cloned = structuredClone(decomp)
    cloned.by_topico[String(topicoId)].subtopicos.splice(i, 1)
    onChange(cloned)
  }

  const addSub = () => {
    if (!decomp) return
    const cloned = structuredClone(decomp)
    if (!cloned.by_topico[String(topicoId)]) {
      cloned.by_topico[String(topicoId)] = {
        nome_curto: topicoNome.slice(0, 60),
        conceitos_pai: [],
        subtopicos: [],
        referencias_legais: [],
      }
    }
    cloned.by_topico[String(topicoId)].subtopicos.push({
      nome: 'Novo subtópico',
      duracao_min: 45,
      conceito_pai: topicoNome,
      origin: 'manual',
    })
    onChange(cloned)
  }

  return (
    <div className="ml-6 py-2 border-l-2 border-slate-100 pl-4">
      <div className="text-xs font-medium text-slate-600 mb-1">{topicoNome}</div>
      <div>
        {subtopicos.length === 0 && (
          <div className="text-[11px] text-slate-400 italic py-1 px-3">Sem subtópicos ainda.</div>
        )}
        {subtopicos.map((sub, i) => (
          <SubtopicoRow
            key={i}
            sub={sub}
            readOnly={readOnly}
            onChange={(next) => updateSub(i, next)}
            onDelete={() => deleteSub(i)}
          />
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={addSub}
            className="text-[11px] text-emerald-600 hover:text-emerald-700 px-3 py-1.5 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar subtópico
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4:** `DisciplinaSection.tsx`:

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TopicoSection } from './TopicoSection'
import type { CuradoriaTreeNode } from '@/hooks/moderation/useCuradoriaTree'
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export function DisciplinaSection({
  disciplina, decomposicao, readOnly, onChange,
}: {
  disciplina: CuradoriaTreeNode
  decomposicao: EditalDecomposicao | null
  readOnly: boolean
  onChange: (next: EditalDecomposicao) => void
}) {
  const [open, setOpen] = useState(true)
  const totalSubtopicos = disciplina.topicos.reduce((sum, t) => sum + t.subtopicos.length, 0)

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
          <h3 className="font-medium text-slate-900">{disciplina.disciplinaNome}</h3>
        </div>
        <div className="text-xs text-slate-500">
          {disciplina.topicos.length} tópicos · {totalSubtopicos} subtópicos
        </div>
      </button>
      {open && (
        <div className="pb-3">
          {disciplina.topicos.map((t) => (
            <TopicoSection
              key={t.topicoId}
              topicoId={t.topicoId}
              topicoNome={t.topicoNome}
              decomp={decomposicao}
              readOnly={readOnly}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDebouncedCallback.ts src/components/moderation/curadoria/DisciplinaSection.tsx src/components/moderation/curadoria/TopicoSection.tsx src/components/moderation/curadoria/SubtopicoRow.tsx
git commit -m "feat(cronograma-v2): tree sections with inline editing (disciplina/topico/subtopico)"
```

---

### Task 8: Actions + OriginBadge + EmptyState

**Files:**
- Create: `src/components/moderation/curadoria/CuradoriaActions.tsx`
- Create: `src/components/moderation/curadoria/OriginBadge.tsx`
- Create: `src/components/moderation/curadoria/CuradoriaEmptyState.tsx`

- [ ] **Step 1:** `OriginBadge` (dot + tooltip):

```tsx
export function OriginBadge({ origin }: { origin: 'ai' | 'manual' }) {
  return (
    <span
      title={origin === 'ai' ? 'Gerado por IA' : 'Adicionado manualmente'}
      className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
        origin === 'ai' ? 'bg-emerald-500' : 'bg-slate-400'
      }`}
    />
  )
}
```

- [ ] **Step 2:** `CuradoriaActions` (top bar com botões dependentes do status):

```tsx
'use client'

import { Sparkles, CheckCircle, Archive, RefreshCw, AlertTriangle } from 'lucide-react'
import { useCurarEdital } from '@/hooks/moderation/useCurarEdital'
import { usePublishEdital } from '@/hooks/moderation/usePublishEdital'
import { useUnpublishEdital } from '@/hooks/moderation/useUnpublishEdital'
import type { EditalGraphQL } from '@/lib/cronograma-v2/schemas'

export function CuradoriaActions({
  cargoId, editalId, cargoNome, status, editalPayload,
}: {
  cargoId: number
  editalId: number
  cargoNome: string
  status: 'no_cache' | 'draft' | 'published' | 'archived'
  editalPayload: EditalGraphQL
}) {
  const curar = useCurarEdital()
  const publish = usePublishEdital()
  const unpublish = useUnpublishEdital()

  const handleCurar = () => {
    if (status !== 'no_cache') {
      const ok = window.confirm(
        `Re-curar "${cargoNome}" vai sobrescrever a decomposição atual (incluindo edições manuais). Tem certeza?`,
      )
      if (!ok) return
    }
    curar.mutate(editalPayload)
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      {curar.isPending ? (
        <div className="flex items-center gap-3">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
          <span className="text-sm text-slate-600">
            {curar.progress?.message ?? 'Iniciando…'}
            {curar.progress?.total ? ` (${curar.progress.done}/${curar.progress.total})` : ''}
          </span>
          {curar.progress?.total && (
            <div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.round((curar.progress.done ?? 0) / curar.progress.total * 100)}%` }} />
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleCurar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Sparkles className="h-4 w-4" />
            {status === 'no_cache' ? 'Curar com IA' : 'Re-curar com IA'}
          </button>
          {status === 'draft' && (
            <button
              type="button"
              onClick={() => publish.mutate({ cargo_id: cargoId, edital_id: editalId })}
              disabled={publish.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Publicar
            </button>
          )}
          {status === 'published' && (
            <button
              type="button"
              onClick={() => unpublish.mutate({ cargo_id: cargoId, edital_id: editalId })}
              disabled={unpublish.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              Arquivar
            </button>
          )}
        </>
      )}
      {curar.isError && (
        <div className="flex items-center gap-1.5 text-rose-600 text-sm">
          <AlertTriangle className="h-4 w-4" />
          {curar.error?.message ?? 'Erro'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3:** `CuradoriaEmptyState`:

```tsx
import { BookOpen } from 'lucide-react'

export function CuradoriaEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <BookOpen className="h-12 w-12 text-slate-300" />
      <h2 className="text-lg font-semibold text-slate-700 mt-4">Selecione um cargo</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        Escolha um cargo na lista à esquerda pra revisar a decomposição do edital,
        editar subtópicos manualmente e publicar pra liberar no V2 do cronograma.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/moderation/curadoria/CuradoriaActions.tsx src/components/moderation/curadoria/OriginBadge.tsx src/components/moderation/curadoria/CuradoriaEmptyState.tsx
git commit -m "feat(cronograma-v2): top actions + origin badge + empty state"
```

---

### Task 9: Rota + link no shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/moderation/layout/ModerationShell.tsx`

- [ ] **Step 1:** Adicionar import + rota em App.tsx (procurar onde outras rotas `/moderacao/*` ficam):

```tsx
import CuradoriaEditaisPage from './views/CuradoriaEditaisPage'

// Dentro do bloco moderacao:
<Route path="curadoria-editais" element={<CuradoriaEditaisPage />} />
```

- [ ] **Step 2:** Adicionar item no menu do `ModerationShell` (procurar onde outros itens estão linkados):

```tsx
// Adicionar item na nav lateral, perto de "Editais":
<NavLink to="/moderacao/curadoria-editais" ...>
  <Sparkles className="h-4 w-4" />
  Curadoria
</NavLink>
```

> Subagent: localize o padrão exato dos NavLinks existentes (ícone, classes, label) e replique.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/moderation/layout/ModerationShell.tsx
git commit -m "feat(cronograma-v2): wire /moderacao/curadoria-editais route + nav link"
```

---

### Task 10: Doc

**Files:**
- Create: `docs/cronograma-v2/sub-plan-5-5-applied.md`

Documenta workflow novo, diff vs Sub-plan 5, próximos passos.

- [ ] **Step 1:** Doc com commit chain real (via `git log --oneline <prev-tip>..HEAD`)
- [ ] **Step 2: Commit**

```bash
git add docs/cronograma-v2/sub-plan-5-5-applied.md
git commit -m "docs(cronograma-v2): summary of sub-plan 5.5 (curadoria dedicada)"
```

---

## Self-Review

**Cobertura das features pedidas:**
- ✅ Sidebar com cargos filtráveis
- ✅ Tree completa editável inline (disciplina → tópico → subtópico)
- ✅ Status pill por cargo
- ✅ Origin badge (IA vs manual)
- ✅ Ações: curar / re-curar (com confirm) / publicar / arquivar
- ✅ Autosave debounced
- ⚠️ **Não cobre**: versionamento/histórico (futuro), bulk select (futuro), preview do user-side (futuro)
- ⚠️ **Não cobre**: diff visual antes/depois ao re-curar (complexo, deferido)

**Risk register:**
- `useCuradoriaTree` faz N+1 queries pra topicos (uma por disciplina). Pra cargos com 15+ disciplinas é lento. Mitigação futura: novo endpoint GraphQL `topicos_by_cargo(cargoId)`.
- Autosave dispara mutation a cada edit → muita request. 800ms debounce + React Query mutation queue ajudam mas podem haver corridas.
- Tree não virtualizada — 200+ subtopicos abertos podem laggar. Aceitar pra MVP.

---

## Pré-execução checklist

- [ ] Sub-plan 5 migration aplicada (`edital_cache.status` existe)
- [ ] Seu user tem `role='admin'`
- [ ] Branch `cargo-transition-v2`

---

## Plan complete. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-5-5-curadoria-dedicada.md`.

**Duas opções:** Subagent-Driven (padrão) ou Inline.
