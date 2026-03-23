# Lei Seca Frontend v2 — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Parent spec:** `2026-03-20-lei-seca-api-architecture-design.md`
**Scope:** Refactor Lei Seca frontend to consume GraphQL API, replace TipTap with React components, add UX features

## Overview

Refactor the existing Lei Seca frontend (Metav2) to fetch law data from the new GraphQL API instead of Supabase. Replace TipTap editor rendering with plain React components styled by dispositivo type. Add 5 UX features: Lei Seca toggle, busca with minimap, keyboard navigation, reading progress, and revogados toggle. Sidebar layout unchanged.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| GraphQL client | urql | 12KB, React hooks, document cache, SSR-ready. Sweet spot between fetch puro and Apollo |
| Type system | New types mirroring API | Clean, no adapter layer, prepared for React renderer |
| Rendering | React components (no TipTap) | Lighter, faster, no ProseMirror overhead for read-only content |
| Virtualization | react-virtuoso + API pagination | Auto-measures heights (no estimation), built-in endReached for infinite loading. Simpler than react-window for variable-size items |
| Layout | Keep current (B: sidebar + content) + immersive mode (A) | Toggle with Ctrl+\ collapses sidebar to icons |
| Ref cruzada | v2 (not in scope) | Needs link→lei_id mapping and more laws in DB |

## API Endpoint

```
Production: http://xc8cg488gwco08gscwco8wo4.95.217.197.95.sslip.io/graphql
Dev: http://localhost:3001/graphql
```

## New Types (src/types/lei-api.ts)

```typescript
export interface Lei {
  id: string              // "decreto-lei-2848-1940"
  titulo: string
  apelido: string | null  // "Código Penal"
  ementa: string | null
  tipo: string            // "DECRETO-LEI", "LEI"
  nivel: string           // "FEDERAL"
  data: string | null     // "1940-12-07"
  status: string          // "ATIVO"
  hierarquia: HierarquiaNode[]
  stats?: LeiStats
}

export interface LeiStats {
  totalDispositivos: number
  totalArtigos: number
  totalRevogados: number
}

export interface HierarquiaNode {
  tipo: string            // "parte", "livro", "titulo", "capitulo", "secao", "subsecao"
  descricao: string       // "TÍTULO I"
  subtitulo?: string      // "Da aplicação da lei penal"
  path: string            // "parte-geral/titulo-i"
  filhos: HierarquiaNode[]
}

export interface Dispositivo {
  id: string              // codeInt64 as string (GraphQL ID)
  tipo: string            // "ARTIGO", "PARAGRAFO", "INCISO", "ALINEA", etc.
  numero: string | null   // "121", "2º", "I", "a"
  texto: string
  epigrafe: string | null // "Homicídio simples"
  pena: string | null     // "Pena - reclusão, de seis a vinte anos."
  anotacoes: Anotacao[] | null
  links: ReferenciaCruzada[] | null
  revogado: boolean
  path: string | null     // "parte-especial/titulo-i/capitulo-i"
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
  highlight: string       // HTML with <mark> tags
  score: number
}
```

**Type alignment notes:**
- `apelido` is in the deployed API schema (added during implementation, see `src/schema.ts` in api-leis repo) and in the DB. The API spec will be updated to match.
- `hierarquia`, `anotacoes`, and `links` are returned as `JSON` scalar by the API (Mercurius). The TypeScript types above (`HierarquiaNode[]`, `Anotacao[]`, `ReferenciaCruzada[]`) are client-side assertions over the JSON. The data shape is guaranteed by `process.js` which structures it before upload. No runtime validation needed — the pipeline is the source of truth.
- `Dispositivo.tipo` is `String!` in the API (not enum) because some items may be `NAO_IDENTIFICADO`. The `DispositivoRenderer` includes a `GenericDispositivo` fallback for unrecognized types. `CAPUT` is in the API's `TipoDispositivo` enum (for input filtering) and in the DB data.
- `score` is a PostgreSQL `ts_rank` value (0–1 range float), not a Typesense relevance score.

## GraphQL Queries (src/lib/lei-queries.ts)

```graphql
# List all available laws (for sidebar selector)
query Leis {
  leis(limit: 200) {
    nodes { id titulo apelido tipo nivel }
    totalCount
  }
}

# Single law metadata + hierarchy (on law change)
query Lei($id: String!) {
  lei(id: $id) {
    id titulo apelido ementa tipo nivel data status
    hierarquia
    stats { totalDispositivos totalArtigos totalRevogados }
  }
}

# Paginated dispositivos (100 per page, loaded on scroll)
query Dispositivos($leiId: String!, $offset: Int!, $limit: Int!, $incluirRevogados: Boolean) {
  dispositivos(leiId: $leiId, offset: $offset, limit: $limit, incluirRevogados: $incluirRevogados) {
    nodes {
      id tipo numero texto epigrafe pena
      anotacoes links revogado path posicao
    }
    totalCount
  }
}

# Full-text search
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
```

## urql Setup (src/lib/urql-client.ts)

```typescript
import { Client, cacheExchange, fetchExchange } from 'urql'

const API_URL = process.env.NEXT_PUBLIC_LEI_API_URL
  ?? 'http://localhost:3001/graphql'

export const leiClient = new Client({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
})
```

Provider wraps lei-seca routes only (not the entire app) to avoid conflicts with existing React Query setup:

```tsx
// In LeiSecaPage or a route-level wrapper
import { Provider } from 'urql'
import { leiClient } from '@/lib/urql-client'

<Provider value={leiClient}>
  <LeiSecaContent />
</Provider>
```

## Component Architecture

### Rendering Components (src/components/lei-seca/dispositivos/)

Each dispositivo type maps to a React component. No TipTap.

```
DispositivoList                 ← react-virtuoso Virtuoso
  └── DispositivoRenderer       ← switches by tipo
        ├── EstruturaHeader     ← PARTE, LIVRO, TITULO, CAPITULO, SECAO, SUBSECAO
        ├── Epigrafe            ← bold, margin-top (e.g., "Homicídio simples")
        ├── Artigo              ← "Art. X" bold + texto, border-left accent
        ├── Paragrafo           ← "§ X" bold, indent level 1
        ├── Inciso              ← "I -" bold, indent level 2
        ├── Alinea              ← "a)" bold, indent level 3
        ├── Pena                ← italic, muted color
        ├── Anotacao            ← gray, italic, hidden in lei seca mode
        └── Revogado            ← collapsed by default, strikethrough on expand
```

**DispositivoRenderer** (the switch):

```tsx
function DispositivoRenderer({ item, leiSecaMode, showRevogados }: Props) {
  if (item.revogado && !showRevogados) return <RevogadoCollapsed item={item} />

  const STRUCTURAL = ['PARTE','LIVRO','TITULO','CAPITULO','SECAO','SUBSECAO']

  if (STRUCTURAL.includes(item.tipo)) return <EstruturaHeader item={item} />
  if (item.tipo === 'EPIGRAFE') return <Epigrafe item={item} />
  if (item.tipo === 'ARTIGO') return <Artigo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PARAGRAFO' || item.tipo === 'CAPUT') return <Paragrafo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'INCISO') return <Inciso item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'ALINEA') return <Alinea item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PENA') return <Pena item={item} />
  // Fallback for NAO_IDENTIFICADO etc.
  return <GenericDispositivo item={item} leiSecaMode={leiSecaMode} />
}
```

### Styling by tipo

| Tipo | Style |
|------|-------|
| PARTE, LIVRO, TITULO | text-center, uppercase, font-bold, text-lg |
| CAPITULO, SECAO | text-center, font-bold |
| SUBSECAO | text-center, italic |
| EPIGRAFE | font-bold, mt-5, text-accent |
| ARTIGO | ml-0, "Art. X" in bold accent, border-l-3 accent |
| PARAGRAFO, CAPUT | ml-6, "§ X" in bold accent |
| INCISO | ml-12, "I -" in bold accent |
| ALINEA | ml-18, "a)" in bold accent |
| PENA | italic, text-muted-foreground |
| ANOTACAO | text-muted, italic, hidden when leiSecaMode=true |
| REVOGADO | opacity-50, line-through, collapsed by default |

### Virtualization (react-virtuoso)

```tsx
import { Virtuoso } from 'react-virtuoso'

<Virtuoso
  data={dispositivos}
  itemContent={(index, item) => (
    <DispositivoRenderer item={item} leiSecaMode={leiSecaMode} showRevogados={showRevogados} />
  )}
  endReached={loadMore}          // triggers next page fetch
  overscan={200}                 // pixels to pre-render
  isScrolling={setIsScrolling}   // for scroll spy optimization
/>
```

**Why react-virtuoso over react-window:**
- Auto-measures actual rendered heights (no estimation formulas)
- Built-in `endReached` callback for infinite loading (no sentinel/IntersectionObserver needed)
- Handles dynamic content (anotações expand/collapse) without `resetAfterIndex` hacks
- `scrollToIndex` for Ctrl+G navigation works with unloaded items (renders placeholder then scrolls)

**Pagination strategy:**
- Initial load: 100 dispositivos (offset 0)
- `endReached` callback: fetch next 100, append to flat array
- react-virtuoso renders only visible ~20 items, measures heights automatically
- `totalCount` from API used for progress bar percentage
- Scroll spy via `rangeChanged` callback (first visible index → update sidebar)

**urql cache note:** The default `cacheExchange` caches by query+variables. `dispositivos(offset:0)` and `dispositivos(offset:100)` are cached separately — it does NOT auto-merge pages. The `useDispositivos` hook accumulates pages manually in React state:

```typescript
// src/hooks/useLeiApi.ts (simplified)
function useDispositivos(leiId: string) {
  const [allDispositivos, setAll] = useState<Dispositivo[]>([])
  const [offset, setOffset] = useState(0)

  const [result] = useQuery({
    query: DISPOSITIVOS_QUERY,
    variables: { leiId, offset, limit: 100 },
  })

  useEffect(() => {
    if (result.data?.dispositivos.nodes) {
      setAll(prev => [...prev, ...result.data.dispositivos.nodes])
    }
  }, [result.data])

  const loadMore = () => setOffset(prev => prev + 100)
  const totalCount = result.data?.dispositivos.totalCount ?? 0

  return { dispositivos: allDispositivos, totalCount, loadMore, isLoading: result.fetching }
}
```

No `graphcache` or `simplePagination` needed — manual accumulation is simpler and avoids an extra dependency for this single use case.

## Data Flow

```
URL (/lei-seca/:leiId)
  → LeiSecaPage
    → urql Provider (leiClient)
      → useLeis() → sidebar lei selector
      → useLei(leiId) → hierarquia for sidebar tree + stats for footer
      → useDispositivos(leiId, offset) → paginated dispositivos
        → DispositivoList (react-virtuoso)
          → DispositivoRenderer per item
      → useBusca(termo, leiId) → search results (on demand)
```

### Context Refactor (src/contexts/LeiSecaContext.tsx)

Replace `useLeiContent` (Supabase) with urql queries. The context interface changes:

```typescript
interface LeiSecaContextType {
  // Data (from API)
  leis: Lei[]
  currentLei: Lei | null
  dispositivos: Dispositivo[]      // accumulated from paginated fetches
  totalDispositivos: number
  isLoadingMore: boolean

  // Navigation
  currentLeiId: string
  handleLeiChange: (id: string) => void

  // UI State
  leiSecaMode: boolean             // hide annotations
  toggleLeiSecaMode: () => void
  showRevogados: boolean           // show/hide revoked items
  toggleRevogados: () => void
  immersiveMode: boolean           // sidebar collapsed
  toggleImmersiveMode: () => void

  // Pagination
  loadMore: () => void             // fetch next 100 dispositivos

  // Search
  searchTerm: string
  setSearchTerm: (term: string) => void
  searchResults: BuscaHit[]
  searchTotal: number
  isSearching: boolean

  // Reading progress is NOT in this context — it lives in an external store
  // (src/stores/readingProgressStore.ts) to avoid scroll-driven re-renders
  // of the entire component tree. See UX Feature 4 below.
}
```

**Context migration notes — fields from current context:**
- **Kept (renamed):** `leis`, `currentLeiId`, `handleLeiChange`, `viewMode` (now `immersiveMode`)
- **Replaced:** `artigos`/`plateContent`/`allArtigos` → `dispositivos` (new types), `leiTreeData` → built from `lei.hierarquia`
- **Preserved externally:** `focusedProvision`, `companionTab`, `companionOpen`, `aiSelectedText`, `noteBarProvision` — these belong to the study companion panel (separate feature, not refactored here). They stay in their own context/stores.
- **Dropped (TipTap-specific):** `scrollToArtigoInEditor`, `pendingScrollRef`, `scrollTrigger` — replaced by react-virtuoso's `scrollToIndex`
- **Dropped (Supabase-specific):** `expandedSections`, `toggleSection` — sidebar tree now driven by `lei.hierarquia` directly

**localStorage key convention:** `lei-seca:{feature}:{leiId}` (e.g., `lei-seca:progress:decreto-lei-2848-1940`, `lei-seca:lei-seca-mode`, `lei-seca:immersive`)

## UX Features

### 1. Lei Seca Toggle

- Switch in toolbar: "Lei Seca" on/off
- When ON: all `Anotacao` components render `display:none`
- Keyboard shortcut: `L`
- State persisted in localStorage per lei
- Visual indicator in toolbar (highlighted when active)

### 2. Busca with Minimap (Ctrl+F)

- `Ctrl+F` opens search bar overlay (not browser find)
- **Must call `e.preventDefault()`** on the keydown event to suppress the browser's native Ctrl+F bar. Without this, both bars appear simultaneously.
- Types query → calls `busca()` API with `websearch_to_tsquery`
- **Debounce 500ms** on the search input — `ts_headline` is CPU-intensive on the server, firing on every keystroke ("h" → "ho" → "hom" → "homi"...) would hammer the API. Only fire the query after 500ms of no typing.
- Results shown as list below search bar (dispositivo texto + lei titulo + highlight)
- Click result → scroll to dispositivo in main view
- Minimap: colored dots on the scroll track showing where matches are in the document
- Supports `"exact phrase"` and `-exclude` syntax (websearch_to_tsquery)

### 3. Keyboard Navigation

| Key | Action |
|-----|--------|
| `J` | Next artigo (scroll to next ARTIGO type) |
| `K` | Previous artigo |
| `Ctrl+G` | Go to artigo by number (opens small input) |
| `Ctrl+\` | Toggle immersive mode |
| `L` | Toggle lei seca mode |
| `Ctrl+F` | Open search |
| `Esc` | Close search / exit immersive |

Only active when no input/textarea is focused.

### 4. Reading Progress

- Thin progress bar at top of content area (3px, gradient)
- Percentage = (index of topmost visible ARTIGO) / totalArtigos
- Persisted in localStorage: `lei-seca:progress:{leiId} → { posicao, percentage, timestamp }`
- On page load: if saved position exists, show "Continuar de onde parou" toast with scroll-to action
- Sidebar: subtle dot next to visited artigos (tracked in a Set in localStorage)

**Critical: external store, NOT React context.** Reading progress updates on every scroll event. If it lived in `LeiSecaContext`, every scroll pixel would re-render the entire dispositivo list + sidebar. Instead, use an external store following the existing `activeArtigoStore` pattern:

```typescript
// src/stores/readingProgressStore.ts
let progress = 0
let lastPosition: number | null = null
const listeners = new Set<() => void>()

export const readingProgressStore = {
  get: () => ({ progress, lastPosition }),
  set: (p: number, pos: number) => {
    progress = p
    lastPosition = pos
    listeners.forEach(fn => fn())
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

// ReadingProgressBar subscribes directly (useSyncExternalStore)
// No context re-render. Only the 3px bar updates.
```

### 5. Revogados Toggle

- Default: revogados hidden (`incluirRevogados: false` in API query)
- Toggle in toolbar: "Mostrar Revogados"
- When shown: revogado items render with `opacity-50`, `line-through`, and `(Revogado)` badge
- Collapsed by default even when shown — click to expand full text

### Immersive Mode (A)

- Sidebar collapses to 48px icon strip (hamburger, search, index, settings)
- Content area centers with `max-width: 680px` for comfortable reading
- Minimap bar on right edge shows position in document
- `Ctrl+\` or click hamburger to toggle
- State persisted in localStorage

## Files to Create/Modify

### New Files
- `src/types/lei-api.ts` — API types
- `src/lib/urql-client.ts` — urql client singleton
- `src/lib/lei-queries.ts` — GraphQL query strings
- `src/components/lei-seca/dispositivos/DispositivoList.tsx` — virtualized list
- `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx` — type switch
- `src/components/lei-seca/dispositivos/EstruturaHeader.tsx`
- `src/components/lei-seca/dispositivos/Artigo.tsx`
- `src/components/lei-seca/dispositivos/Paragrafo.tsx`
- `src/components/lei-seca/dispositivos/Inciso.tsx`
- `src/components/lei-seca/dispositivos/Alinea.tsx`
- `src/components/lei-seca/dispositivos/Epigrafe.tsx`
- `src/components/lei-seca/dispositivos/Pena.tsx`
- `src/components/lei-seca/dispositivos/Anotacao.tsx`
- `src/components/lei-seca/dispositivos/RevogadoCollapsed.tsx`
- `src/components/lei-seca/dispositivos/GenericDispositivo.tsx`
- `src/components/lei-seca/LeiSearchBar.tsx` — Ctrl+F search overlay
- `src/components/lei-seca/LeiToolbar.tsx` — toggles (lei seca, revogados, immersive)
- `src/components/lei-seca/ReadingProgressBar.tsx`
- `src/hooks/useLeiApi.ts` — urql-based hooks (useLeis, useLei, useDispositivos, useBusca)
- `src/hooks/useKeyboardNav.ts` — keyboard shortcuts
- `src/hooks/useReadingProgress.ts` — localStorage persistence + useSyncExternalStore
- `src/stores/readingProgressStore.ts` — external store (no context re-renders)

### Modified Files
- `src/contexts/LeiSecaContext.tsx` — replace useLeiContent with urql hooks
- `src/views/LeiSecaPage.tsx` — new renderer, remove TipTap import
- `src/components/lei-seca/LeiSecaSidebar.tsx` — use new types for tree
- `src/components/AppSidebar.tsx` — pass immersive mode state
- `package.json` — add urql, react-virtuoso dependencies
- `.env.example` — add NEXT_PUBLIC_LEI_API_URL

### Removed Dependencies (after migration)
- TipTap imports in lei-seca components (editor, toolbar, extensions)
- `useLeiContent` hook (replaced by useLeiApi)
- Supabase queries for lei data

## Environment Variables

```env
# Add to .env / .env.example
NEXT_PUBLIC_LEI_API_URL=http://xc8cg488gwco08gscwco8wo4.95.217.197.95.sslip.io/graphql
```

## Dependencies to Add

```json
{
  "urql": "^4",
  "graphql": "^16",
  "react-virtuoso": "^4"
}
```

## Error Handling

- **API unreachable:** urql's `error` state triggers a banner: "API indisponível. Verifique sua conexão." with retry button.
- **Partial failures:** Each query is independent. If `busca` fails but `dispositivos` works, only the search shows error state.
- **Stale cache:** urql's document cache auto-invalidates. No manual cache busting needed for v1.
- **Empty results:** "Nenhum dispositivo encontrado" placeholder for empty queries.

## Ctrl+G Implementation

`Ctrl+G` opens a small modal input ("Ir para artigo nº..."). On submit:
1. Search loaded `dispositivos` array for matching `numero`
2. If found → `virtuosoRef.scrollToIndex({ index, align: 'start' })`
3. If not found (not yet loaded) → fetch `dispositivos(leiId, tipos: [ARTIGO], limit: 1, offset: 0)` with a filter workaround: binary search the paginated API to find the target posicao, load that page, then scroll
4. Simpler v1 approach: load ALL artigo positions upfront (just `id`, `numero`, `posicao` — lightweight query) as an index, then scroll to the right offset

## v2 Roadmap (not in scope)

- Referência cruzada inline (tooltip on hover for cross-references)
- Sistema de grifos (getSelection → Supabase)
- Workspace mode (three-column with annotations panel)
- Flashcard creation from selected text
- Offline cache (urql offline exchange)
