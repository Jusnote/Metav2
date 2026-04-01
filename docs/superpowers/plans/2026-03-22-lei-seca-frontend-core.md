# Lei Seca Frontend v2 — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Lei Seca frontend to fetch from GraphQL API, render with React components (no TipTap), virtualize with react-virtuoso.

**Architecture:** Replace `useLeiContent` (Supabase) with urql hooks hitting the GraphQL API. Replace TipTap editor rendering with plain React components per dispositivo type. Virtualize with react-virtuoso + API pagination (100 per page). Sidebar keeps existing layout, just switches data source.

**Tech Stack:** urql 4, graphql 16, react-virtuoso 4, React 19, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-22-lei-seca-frontend-v2-design.md`

**API:** `http://xc8cg488gwco08gscwco8wo4.95.217.197.95.sslip.io/graphql` (production), `http://localhost:3001/graphql` (dev)

**Important codebase notes:**
- ESM project with Next.js 15, path alias `@/*` → `./src/*`
- Existing external store pattern: `src/stores/activeArtigoStore.ts` (useSyncExternalStore)
- Current context: `src/contexts/LeiSecaContext.tsx` (584 lines, wraps in App.tsx line 99)
- Routes: `/lei-seca`, `/lei-seca/:leiId`, `/lei-seca/:leiId/:slug`
- `@tanstack/react-virtual` is installed but we use react-virtuoso instead (auto-measures heights)
- shadcn/ui components in `src/components/ui/`, Tailwind v4 with `@tailwindcss/postcss`
- `dispositivos.tipo` is UPPERCASE in DB (ARTIGO, PARAGRAFO, INCISO, etc.)
- `hierarquia`, `anotacoes`, `links` are JSON scalars from API — TypeScript types are client-side assertions

---

## File Structure

```
src/
├── types/
│   └── lei-api.ts                          ← NEW: API types (Lei, Dispositivo, etc.)
├── lib/
│   ├── urql-client.ts                      ← NEW: urql Client singleton
│   └── lei-queries.ts                      ← NEW: GraphQL query strings
├── hooks/
│   └── useLeiApi.ts                        ← NEW: urql-based hooks (useLeis, useLei, useDispositivos, useBusca)
├── components/lei-seca/
│   ├── dispositivos/
│   │   ├── DispositivoList.tsx             ← NEW: react-virtuoso wrapper
│   │   ├── DispositivoRenderer.tsx         ← NEW: type switch component
│   │   ├── EstruturaHeader.tsx            ← NEW: PARTE, LIVRO, TITULO, etc.
│   │   ├── Artigo.tsx                     ← NEW: Art. X with border-left
│   │   ├── Paragrafo.tsx                  ← NEW: § X indented
│   │   ├── Inciso.tsx                     ← NEW: I - indented
│   │   ├── Alinea.tsx                     ← NEW: a) indented
│   │   ├── Epigrafe.tsx                   ← NEW: bold title
│   │   ├── Pena.tsx                       ← NEW: italic muted
│   │   ├── AnotacaoInline.tsx             ← NEW: gray italic (for inline anotações)
│   │   ├── RevogadoCollapsed.tsx          ← NEW: collapsed revoked item
│   │   └── GenericDispositivo.tsx         ← NEW: fallback
│   └── LeiSecaSidebar.tsx                 ← MODIFY: use new types
├── contexts/
│   └── LeiSecaContext.tsx                 ← REWRITE: urql hooks, new types
├── views/
│   └── LeiSecaPage.tsx                    ← REWRITE: react-virtuoso, no TipTap
├── App.tsx                                ← MODIFY: add urql Provider
└── package.json                           ← MODIFY: add deps
```

---

## Task 1: Install Dependencies + Types

**Files:**
- Modify: `package.json`
- Create: `src/types/lei-api.ts`

- [ ] **Step 1: Install urql, graphql, react-virtuoso**

```bash
cd "/d/meta novo/Metav2" && npm install urql graphql react-virtuoso
```

- [ ] **Step 2: Create src/types/lei-api.ts**

```typescript
// Types mirroring the GraphQL API responses
// API spec: docs/superpowers/specs/2026-03-22-api-leis-graphql-design.md

export interface Lei {
  id: string
  titulo: string
  apelido: string | null
  ementa: string | null
  tipo: string
  nivel: string
  data: string | null
  status: string
  hierarquia: HierarquiaNode[]
  stats?: LeiStats
}

export interface LeiStats {
  totalDispositivos: number
  totalArtigos: number
  totalRevogados: number
}

export interface HierarquiaNode {
  tipo: string
  descricao: string
  subtitulo?: string
  path: string
  filhos: HierarquiaNode[]
}

export interface Dispositivo {
  id: string
  tipo: string
  numero: string | null
  texto: string
  epigrafe: string | null
  pena: string | null
  anotacoes: Anotacao[] | null
  links: ReferenciaCruzada[] | null
  revogado: boolean
  path: string | null
  posicao: number
}

export interface Anotacao {
  tipo: string
  lei: string | null
  texto: string | null
}

export interface ReferenciaCruzada {
  href: string
  titulo: string
  textoAncora: string
  leiId: string | null
}

export interface BuscaHit {
  dispositivo: Dispositivo
  lei: Lei
  highlight: string
  score: number
}

export interface LeisConnection {
  nodes: Lei[]
  totalCount: number
}

export interface DispositivosConnection {
  nodes: Dispositivo[]
  totalCount: number
}

export interface BuscaResult {
  total: number
  hits: BuscaHit[]
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/types/lei-api.ts
git commit -m "feat: install urql + react-virtuoso, add API types"
```

---

## Task 2: urql Client + GraphQL Queries

**Files:**
- Create: `src/lib/urql-client.ts`
- Create: `src/lib/lei-queries.ts`

- [ ] **Step 1: Create src/lib/urql-client.ts**

```typescript
import { Client, cacheExchange, fetchExchange } from 'urql'

const API_URL = process.env.NEXT_PUBLIC_LEI_API_URL
  ?? 'http://localhost:3001/graphql'

export const leiClient = new Client({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
})
```

- [ ] **Step 2: Create src/lib/lei-queries.ts**

```typescript
export const LEIS_QUERY = `
  query Leis {
    leis(limit: 200) {
      nodes { id titulo apelido tipo nivel }
      totalCount
    }
  }
`

export const LEI_QUERY = `
  query Lei($id: String!) {
    lei(id: $id) {
      id titulo apelido ementa tipo nivel data status
      hierarquia
      stats { totalDispositivos totalArtigos totalRevogados }
    }
  }
`

export const DISPOSITIVOS_QUERY = `
  query Dispositivos($leiId: String!, $offset: Int!, $limit: Int!, $incluirRevogados: Boolean) {
    dispositivos(leiId: $leiId, offset: $offset, limit: $limit, incluirRevogados: $incluirRevogados) {
      nodes {
        id tipo numero texto epigrafe pena
        anotacoes links revogado path posicao
      }
      totalCount
    }
  }
`

export const BUSCA_QUERY = `
  query Busca($termo: String!, $leiId: String, $limit: Int) {
    busca(termo: $termo, leiId: $leiId, limit: $limit) {
      total
      hits {
        dispositivo { id tipo numero texto posicao }
        lei { id titulo }
        highlight
        score
      }
    }
  }
`
```

- [ ] **Step 3: Add env var to .env**

Add to `.env` (if not present):
```
NEXT_PUBLIC_LEI_API_URL=http://xc8cg488gwco08gscwco8wo4.95.217.197.95.sslip.io/graphql
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/urql-client.ts src/lib/lei-queries.ts
git commit -m "feat: urql client and GraphQL query definitions"
```

---

## Task 3: API Hooks (useLeiApi)

**Files:**
- Create: `src/hooks/useLeiApi.ts`

- [ ] **Step 1: Create src/hooks/useLeiApi.ts**

```typescript
import { useQuery } from 'urql'
import { useState, useEffect, useCallback, useRef } from 'react'
import { LEIS_QUERY, LEI_QUERY, DISPOSITIVOS_QUERY, BUSCA_QUERY } from '@/lib/lei-queries'
import type { Lei, Dispositivo, LeisConnection, DispositivosConnection, BuscaResult } from '@/types/lei-api'

// Hook: list all available laws
export function useLeis() {
  const [result] = useQuery<{ leis: LeisConnection }>({ query: LEIS_QUERY })
  return {
    leis: result.data?.leis.nodes ?? [],
    totalCount: result.data?.leis.totalCount ?? 0,
    isLoading: result.fetching,
    error: result.error,
  }
}

// Hook: single law metadata + hierarchy
export function useLei(id: string | null) {
  const [result] = useQuery<{ lei: Lei | null }>({
    query: LEI_QUERY,
    variables: { id },
    pause: !id,
  })
  return {
    lei: result.data?.lei ?? null,
    isLoading: result.fetching,
    error: result.error,
  }
}

// Hook: paginated dispositivos with manual accumulation
export function useDispositivos(leiId: string | null, incluirRevogados = false) {
  const [allDispositivos, setAll] = useState<Dispositivo[]>([])
  const [offset, setOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const prevLeiIdRef = useRef(leiId)
  const prevRevogadosRef = useRef(incluirRevogados)

  // Reset when lei or revogados filter changes
  useEffect(() => {
    if (leiId !== prevLeiIdRef.current || incluirRevogados !== prevRevogadosRef.current) {
      setAll([])
      setOffset(0)
      setTotalCount(0)
      prevLeiIdRef.current = leiId
      prevRevogadosRef.current = incluirRevogados
    }
  }, [leiId, incluirRevogados])

  const [result] = useQuery<{ dispositivos: DispositivosConnection }>({
    query: DISPOSITIVOS_QUERY,
    variables: { leiId, offset, limit: 100, incluirRevogados },
    pause: !leiId,
  })

  // Append new page to accumulated array
  useEffect(() => {
    if (result.data?.dispositivos) {
      const newNodes = result.data.dispositivos.nodes
      if (newNodes.length > 0) {
        setAll(prev => {
          // Avoid duplicates on re-render
          const existingIds = new Set(prev.map(d => d.id))
          const unique = newNodes.filter(n => !existingIds.has(n.id))
          return unique.length > 0 ? [...prev, ...unique] : prev
        })
        setTotalCount(result.data.dispositivos.totalCount)
      }
    }
  }, [result.data])

  const loadMore = useCallback(() => {
    if (!result.fetching && allDispositivos.length < totalCount) {
      setOffset(allDispositivos.length)
    }
  }, [result.fetching, allDispositivos.length, totalCount])

  const hasMore = allDispositivos.length < totalCount

  return {
    dispositivos: allDispositivos,
    totalCount,
    loadMore,
    hasMore,
    isLoading: result.fetching && allDispositivos.length === 0,
    isLoadingMore: result.fetching && allDispositivos.length > 0,
  }
}

// Hook: full-text search
// NOTE: Caller must debounce `termo` (500ms) before passing to this hook.
// ts_headline is CPU-intensive — firing on every keystroke will hammer the API.
// See spec UX Feature 2 for details.
export function useBusca(termo: string, leiId?: string) {
  const [result] = useQuery<{ busca: BuscaResult }>({
    query: BUSCA_QUERY,
    variables: { termo, leiId, limit: 50 },
    pause: termo.length < 2,
  })
  return {
    hits: result.data?.busca.hits ?? [],
    total: result.data?.busca.total ?? 0,
    isSearching: result.fetching,
    error: result.error,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLeiApi.ts
git commit -m "feat: urql-based API hooks (useLeis, useLei, useDispositivos, useBusca)"
```

---

## Task 4: Dispositivo Renderer Components

**Files:**
- Create: `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx`
- Create: `src/components/lei-seca/dispositivos/EstruturaHeader.tsx`
- Create: `src/components/lei-seca/dispositivos/Artigo.tsx`
- Create: `src/components/lei-seca/dispositivos/Paragrafo.tsx`
- Create: `src/components/lei-seca/dispositivos/Inciso.tsx`
- Create: `src/components/lei-seca/dispositivos/Alinea.tsx`
- Create: `src/components/lei-seca/dispositivos/Epigrafe.tsx`
- Create: `src/components/lei-seca/dispositivos/Pena.tsx`
- Create: `src/components/lei-seca/dispositivos/AnotacaoInline.tsx`
- Create: `src/components/lei-seca/dispositivos/RevogadoCollapsed.tsx`
- Create: `src/components/lei-seca/dispositivos/GenericDispositivo.tsx`

- [ ] **Step 1: Create EstruturaHeader.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'

const CENTERED_BOLD_LARGE = ['PARTE', 'LIVRO', 'TITULO']
const CENTERED_BOLD = ['CAPITULO', 'SECAO']

export function EstruturaHeader({ item }: { item: Dispositivo }) {
  const isLarge = CENTERED_BOLD_LARGE.includes(item.tipo)
  const isBold = CENTERED_BOLD.includes(item.tipo)
  const isSubsecao = item.tipo === 'SUBSECAO'

  return (
    <div className="text-center py-3" data-posicao={item.posicao}>
      {isLarge && (
        <div className="text-xs uppercase tracking-widest text-red-400 font-bold">
          {item.texto}
        </div>
      )}
      {isBold && (
        <div className="text-sm font-bold text-slate-300">
          {item.texto}
        </div>
      )}
      {isSubsecao && (
        <div className="text-sm italic text-slate-400">
          {item.texto}
        </div>
      )}
      {item.epigrafe && (
        <div className="text-xs italic text-slate-500 mt-1">
          {item.epigrafe}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create Epigrafe.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'

export function Epigrafe({ item }: { item: Dispositivo }) {
  return (
    <div className="font-bold text-red-400 mt-5 mb-1 text-sm" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
```

- [ ] **Step 3: Create Artigo.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

interface ArtigoProps {
  item: Dispositivo
  leiSecaMode?: boolean
}

export function Artigo({ item, leiSecaMode }: ArtigoProps) {
  return (
    <div
      className="mb-4 py-2 pl-3 border-l-3 border-blue-900/50"
      data-id={item.id}
      data-posicao={item.posicao}
    >
      <div className="mb-1">
        <span className="font-bold text-red-400">
          {item.numero ? `Art. ${item.numero}.` : 'Art.'}
        </span>
        <span className="ml-1">{item.texto}</span>
      </div>

      {item.pena && (
        <div className="text-muted-foreground italic ml-4 mb-2 text-xs">
          {item.pena}
        </div>
      )}

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 space-y-1">
          {item.anotacoes.map((a, i) => (
            <AnotacaoInline key={i} anotacao={a} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create Paragrafo.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

interface ParagrafoProps {
  item: Dispositivo
  leiSecaMode?: boolean
}

export function Paragrafo({ item, leiSecaMode }: ParagrafoProps) {
  return (
    <div className="mb-2 ml-6 py-1" data-posicao={item.posicao}>
      <span className="font-bold text-red-400">
        {item.numero ? `§ ${item.numero}` : '§'}
      </span>
      <span className="ml-1">{item.texto}</span>

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {item.anotacoes.map((a, i) => (
            <AnotacaoInline key={i} anotacao={a} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create Inciso.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Inciso({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-1.5 ml-12 py-0.5" data-posicao={item.posicao}>
      <span className="font-bold text-red-400">
        {item.numero ? `${item.numero} -` : '-'}
      </span>
      <span className="ml-1">{item.texto}</span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create Alinea.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Alinea({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-1 ml-18 py-0.5" data-posicao={item.posicao}>
      <span className="font-bold text-red-400">
        {item.numero ? `${item.numero})` : ')'}
      </span>
      <span className="ml-1">{item.texto}</span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create Pena.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'

export function Pena({ item }: { item: Dispositivo }) {
  return (
    <div className="text-muted-foreground italic ml-4 mb-2 text-xs" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
```

- [ ] **Step 8: Create AnotacaoInline.tsx**

```tsx
import type { Anotacao } from '@/types/lei-api'

export function AnotacaoInline({ anotacao }: { anotacao: Anotacao }) {
  return (
    <div className="text-muted-foreground/50 italic text-[11px] bg-muted/10 px-2 py-0.5 rounded">
      {anotacao.texto ?? `(${anotacao.tipo})`}
    </div>
  )
}
```

- [ ] **Step 9: Create RevogadoCollapsed.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'

export function RevogadoCollapsed({ item }: { item: Dispositivo }) {
  return (
    <div className="opacity-40 ml-6 py-1 flex items-center gap-2" data-posicao={item.posicao}>
      <span className="text-red-500 text-[10px]">▶</span>
      <span className="line-through text-sm">{item.texto}</span>
      <span className="bg-red-950 text-red-300 text-[9px] px-1.5 py-0.5 rounded">
        Revogado
      </span>
    </div>
  )
}
```

- [ ] **Step 10: Create GenericDispositivo.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'

export function GenericDispositivo({ item }: { item: Dispositivo }) {
  return (
    <div className="mb-2 ml-6 py-1 text-muted-foreground" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
```

- [ ] **Step 11: Create DispositivoRenderer.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import { EstruturaHeader } from './EstruturaHeader'
import { Epigrafe } from './Epigrafe'
import { Artigo } from './Artigo'
import { Paragrafo } from './Paragrafo'
import { Inciso } from './Inciso'
import { Alinea } from './Alinea'
import { Pena } from './Pena'
import { RevogadoCollapsed } from './RevogadoCollapsed'
import { GenericDispositivo } from './GenericDispositivo'

const STRUCTURAL = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO']

interface Props {
  item: Dispositivo
  leiSecaMode?: boolean
  showRevogados?: boolean
}

export function DispositivoRenderer({ item, leiSecaMode, showRevogados }: Props) {
  if (item.revogado && !showRevogados) return <RevogadoCollapsed item={item} />

  if (STRUCTURAL.includes(item.tipo)) return <EstruturaHeader item={item} />
  if (item.tipo === 'EPIGRAFE') return <Epigrafe item={item} />
  if (item.tipo === 'ARTIGO') return <Artigo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PARAGRAFO' || item.tipo === 'CAPUT') return <Paragrafo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'INCISO') return <Inciso item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'ALINEA') return <Alinea item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PENA') return <Pena item={item} />
  if (item.tipo === 'EMENTA' || item.tipo === 'PREAMBULO') return <GenericDispositivo item={item} />

  return <GenericDispositivo item={item} />
}
```

- [ ] **Step 12: Commit**

```bash
git add src/components/lei-seca/dispositivos/
git commit -m "feat: dispositivo renderer components (React, no TipTap)"
```

---

## Task 5: DispositivoList (react-virtuoso)

**Files:**
- Create: `src/components/lei-seca/dispositivos/DispositivoList.tsx`

- [ ] **Step 1: Create DispositivoList.tsx**

```tsx
import { useRef, useCallback } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { Dispositivo } from '@/types/lei-api'
import { DispositivoRenderer } from './DispositivoRenderer'

interface DispositivoListProps {
  dispositivos: Dispositivo[]
  totalCount: number
  loadMore: () => void
  hasMore: boolean
  isLoadingMore: boolean
  leiSecaMode?: boolean
  showRevogados?: boolean
  onRangeChanged?: (startIndex: number, endIndex: number) => void
}

export function DispositivoList({
  dispositivos,
  totalCount,
  loadMore,
  hasMore,
  isLoadingMore,
  leiSecaMode,
  showRevogados,
  onRangeChanged,
}: DispositivoListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore()
    }
  }, [hasMore, isLoadingMore, loadMore])

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={dispositivos}
      endReached={handleEndReached}
      overscan={200}
      itemContent={(index, item) => (
        <DispositivoRenderer
          item={item}
          leiSecaMode={leiSecaMode}
          showRevogados={showRevogados}
        />
      )}
      rangeChanged={({ startIndex, endIndex }) => {
        onRangeChanged?.(startIndex, endIndex)
      }}
      components={{
        Footer: () =>
          isLoadingMore ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Carregando mais dispositivos...
            </div>
          ) : null,
      }}
      style={{ height: '100%' }}
    />
  )
}

// Export ref type for parent components
export type { VirtuosoHandle }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoList.tsx
git commit -m "feat: virtualized dispositivo list with react-virtuoso"
```

---

## Task 6: urql Provider in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Must be done BEFORE Task 7 (Context Rewrite) — urql hooks require a Provider ancestor.**

- [ ] **Step 1: Add urql Provider wrapping lei-seca routes**

The implementer should:
1. Read `src/App.tsx`
2. Import `Provider` from `urql` and `leiClient` from `@/lib/urql-client`
3. Wrap the lei-seca route group with `<Provider value={leiClient}>`
4. The Provider should wrap the `LeiSecaProvider`

```tsx
import { Provider as UrqlProvider } from 'urql'
import { leiClient } from '@/lib/urql-client'

// In the route definition, wrap lei-seca routes:
<Route path="/lei-seca" element={
  <UrqlProvider value={leiClient}>
    <LeiSecaProvider>
      <Outlet />
    </LeiSecaProvider>
  </UrqlProvider>
}>
  <Route index element={<LeiSecaPage />} />
  <Route path=":leiId" element={<LeiSecaPage />} />
  <Route path=":leiId/:slug" element={<LeiSecaPage />} />
</Route>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add urql Provider for lei-seca routes"
```

---

## Task 7: LeiSecaContext Rewrite

**Files:**
- Rewrite: `src/contexts/LeiSecaContext.tsx`

This is the biggest task. The current context is 584 lines with Supabase integration, TipTap scroll handling, and study companion state. We rewrite it to use urql hooks, keeping study companion fields untouched (they stay as-is for now).

- [ ] **Step 1: Rewrite src/contexts/LeiSecaContext.tsx**

Key changes:
- Replace `useLeiContent` with `useLeis`, `useLei`, `useDispositivos` from `useLeiApi`
- Remove TipTap-related refs (`pendingScrollRef`, `scrollTrigger`, `scrollToArtigoInEditor`)
- Remove `plateContent`, `allArtigos` (replaced by `dispositivos`)
- Keep study companion state (`focusedProvision`, `companionTab`, `companionOpen`, `aiSelectedText`, `noteBarProvision`)
- Build sidebar tree from `lei.hierarquia` instead of computing from artigos

The implementer should:
1. Read the current file fully: `src/contexts/LeiSecaContext.tsx`
2. Keep the study companion state fields and their setters
3. Replace data fetching with the urql hooks from `useLeiApi.ts`
4. Update the context interface to match the spec's `LeiSecaContextType`
5. Use `useLocation` and `useNavigate` from react-router-dom (existing pattern)
6. Remove all Supabase imports and `useLeiContent` usage

The new context interface:
```typescript
interface LeiSecaContextType {
  // Data (from API)
  leis: Lei[]
  currentLeiId: string
  currentLei: Lei | null
  dispositivos: Dispositivo[]
  totalDispositivos: number
  isLoading: boolean
  isLoadingMore: boolean
  error: any

  // Navigation
  handleLeiChange: (id: string) => void
  loadMore: () => void
  hasMore: boolean

  // UI State
  leiSecaMode: boolean
  toggleLeiSecaMode: () => void
  showRevogados: boolean
  toggleRevogados: () => void
  // IMPORTANT: pass showRevogados as incluirRevogados to useDispositivos():
  //   const { dispositivos, ... } = useDispositivos(currentLeiId, showRevogados)

  // Immersive mode stub (no-op in Plan A, implemented in Plan B)
  immersiveMode: boolean
  toggleImmersiveMode: () => void

  // Study companion (kept from current context)
  focusedProvision: any
  setFocusedProvision: (p: any) => void
  companionTab: string
  setCompanionTab: (t: string) => void
  companionOpen: boolean
  setCompanionOpen: (o: boolean) => void
  aiSelectedText: string
  setAiSelectedText: (t: string) => void
  noteBarProvision: any
  openNoteBar: (p: any) => void
  closeNoteBar: () => void
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/d/meta novo/Metav2" && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/LeiSecaContext.tsx
git commit -m "feat: rewrite LeiSecaContext with urql hooks (no Supabase)"
```

---

## Task 8: LeiSecaPage Rewrite

**Files:**
- Rewrite: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Rewrite src/views/LeiSecaPage.tsx**

Key changes:
- Remove TipTap editor import and rendering
- Remove infinite scroll sentinel (react-virtuoso handles it)
- Use `DispositivoList` component
- Use `useLeiSeca()` context for data
- Keep study companion panel integration

The implementer should:
1. Read the current file: `src/views/LeiSecaPage.tsx`
2. Replace the TipTap editor with `<DispositivoList />` from `src/components/lei-seca/dispositivos/DispositivoList.tsx`
3. Remove the sentinel-based infinite scroll logic
4. Keep the study companion panel rendering (right side)
5. Keep the comments panel if it exists
6. Use `onRangeChanged` from DispositivoList to update `activeArtigoStore`

Basic structure:
```tsx
import { DispositivoList } from '@/components/lei-seca/dispositivos/DispositivoList'
import { useLeiSeca } from '@/contexts/LeiSecaContext'
import { activeArtigoStore } from '@/stores/activeArtigoStore'

export default function LeiSecaPage() {
  const {
    dispositivos, totalDispositivos, loadMore, hasMore,
    isLoading, isLoadingMore, leiSecaMode, showRevogados,
  } = useLeiSeca()

  if (isLoading) return <div className="flex-1 flex items-center justify-center">Carregando...</div>

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DispositivoList
          dispositivos={dispositivos}
          totalCount={totalDispositivos}
          loadMore={loadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          leiSecaMode={leiSecaMode}
          showRevogados={showRevogados}
          onRangeChanged={(start) => {
            if (dispositivos[start]) {
              activeArtigoStore.setActiveArtigoIndex(start)
            }
          }}
        />
      </div>
      {/* Study companion panel stays — render as before */}
    </div>
  )
}
```

- [ ] **Step 2: Verify page renders**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Open `http://localhost:3000/lei-seca/decreto-lei-2848-1940` — should show Código Penal dispositivos rendered with React components.

- [ ] **Step 3: Commit**

```bash
git add src/views/LeiSecaPage.tsx
git commit -m "feat: rewrite LeiSecaPage with react-virtuoso (no TipTap)"
```

---

## Task 9: Sidebar Adaptation

**Files:**
- Modify: `src/components/lei-seca/LeiSecaSidebar.tsx`

- [ ] **Step 1: Adapt sidebar to use new types**

The implementer should:
1. Read `src/components/lei-seca/LeiSecaSidebar.tsx`
2. The sidebar uses `useLeiSecaOptional()` for data and `useActiveArtigoIndex()` for scroll position
3. Update the tree building to use `lei.hierarquia` (HierarquiaNode[]) from context instead of computing from artigos
4. Update the lei selector dropdown to use `leis` from context (Lei[] type)
5. Update the footer stats to use `lei.stats` from context
6. Keep the existing tree component (`lei-tree.tsx`) — just pass new data shape

Key changes:
- Lei selector: `leis.map(l => ({ value: l.id, label: l.apelido ?? l.titulo }))`
- Tree data: use `currentLei.hierarquia` directly (already a tree)
- Footer: `${lei.stats.totalArtigos} artigos · ${lei.stats.totalDispositivos} dispositivos`

- [ ] **Step 2: Verify sidebar renders with API data**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Navigate to `/lei-seca/decreto-lei-2848-1940` — sidebar should show Código Penal hierarchy.

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/LeiSecaSidebar.tsx
git commit -m "feat: adapt sidebar to use API types and hierarquia"
```

---

## Task 10: Integration Test + Cleanup

- [ ] **Step 1: Test full flow**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Open `http://localhost:3000/lei-seca` and verify:
1. Lei selector shows CC + CP
2. Selecting CP loads dispositivos
3. Scrolling loads more pages (check network tab for offset=100, offset=200...)
4. Sidebar tree shows hierarchy
5. Artigos render with correct styling (Art. bold, § indented, etc.)
6. Revogados show collapsed
7. No TipTap errors in console

- [ ] **Step 2: Verify build**

```bash
cd "/d/meta novo/Metav2" && npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Clean up unused TipTap imports**

Remove TipTap imports from lei-seca components that no longer use them. Do NOT delete TipTap files — they may be used elsewhere (flashcard editor, notes). Only remove imports in files that were rewritten.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: integration test pass, cleanup unused TipTap imports"
```

---

## Implementation Notes

### Scaling to 1M+ Laws (future considerations, not blocking Plan A)

1. **COUNT(*) OVER() killer** — With 1M leis, the window function scans the full table before LIMIT. Replace with `pg_class.reltuples` estimate or a cached count resolver when scaling. Current 2 laws = no issue.

2. **Sidebar limit:200** — With 1M laws, the sidebar lei selector needs an autocomplete search, not a flat list. Plan A already has the search input in the sidebar. Wire it to the API `busca` or a new `leis(query)` filter when scaling.

3. **GIN index on bulk insert** — When uploading 1M+ laws via `upload.js`, DROP the GIN indexes first, bulk insert, then CREATE INDEX. GIN rebalancing on every INSERT makes bulk uploads take weeks.

### Ctrl+G with react-virtuoso (for Plan B)
When implementing Ctrl+G navigation to an artigo that isn't loaded yet:
1. Clear the current `dispositivos` array
2. Fetch the target page: `dispositivos(leiId, offset: targetPosicao - 50, limit: 100)`
3. Set `firstItemIndex={targetPosicao - 50}` on Virtuoso so scrollbar adjusts
4. Scrolling up triggers `startReached` → fetch previous page

### Study Companion Panel
The study companion panel (`focusedProvision`, `companionTab`, `companionOpen`) is preserved in the context but not connected to the new dispositivo components. Connecting text selection from the new React components to the companion panel is a Plan B task.
