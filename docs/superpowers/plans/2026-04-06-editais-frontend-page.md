# Editais Frontend Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/editais` page that lists concursos from the API GraphQL, with search, esfera filter, accordion cards showing cargos, and navigation to `/documents-organization`.

**Architecture:** URQL client connects to `editais.projetopapiro.com.br/graphql`. A custom hook manages search/filter/pagination state and fires GraphQL queries. The page renders a hero + search bar + card list with accordion-expanded cargos. Purple accent palette (#6c63ff) differentiates from the Royal Sapphire app theme.

**Tech Stack:** React, TypeScript, URQL (GraphQL), Tailwind CSS, Framer Motion, Tabler Icons, react-router-dom

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/editais-client.ts` | URQL client for editais API |
| Create | `src/types/editais.ts` | TypeScript types matching GraphQL schema |
| Create | `src/hooks/useEditais.ts` | Hook: search, filter, pagination, GraphQL queries |
| Create | `src/views/EditaisPage.tsx` | Page component: hero, search, cards, accordion |
| Modify | `src/App.tsx` | Add `/editais` route + import |
| Modify | `src/components/AppSidebar.tsx` | Add "Editais" nav item |

---

### Task 1: URQL Client for Editais API

**Files:**
- Create: `src/lib/editais-client.ts`

- [ ] **Step 1: Create the URQL client**

```typescript
// src/lib/editais-client.ts
import { Client, cacheExchange, fetchExchange } from 'urql'

const EDITAIS_API_URL = process.env.NEXT_PUBLIC_EDITAIS_API_URL
  ?? 'https://editais.projetopapiro.com.br/graphql'

export const editaisClient = new Client({
  url: EDITAIS_API_URL,
  exchanges: [cacheExchange, fetchExchange],
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editais-client.ts
git commit -m "feat(editais): add URQL client for editais API"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/editais.ts`

- [ ] **Step 1: Create types matching the GraphQL schema**

```typescript
// src/types/editais.ts

export interface EditalResumo {
  id: number
  nome: string
  sigla: string | null
  esfera: string | null
  tipo: string | null
  totalCargos: number
  totalDisciplinas: number
  totalTopicos: number
}

export interface PaginaInfo {
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

export interface EditaisPaginados {
  dados: EditalResumo[]
  paginacao: PaginaInfo
}

export interface Cargo {
  id: number
  nome: string
  vagas: number | null
  remuneracao: number | null
  qtdDisciplinas: number | null
  qtdTopicos: number | null
}

export interface Edital extends EditalResumo {
  descricao: string | null
  dataPublicacao: string | null
  link: string | null
  cargos: Cargo[]
}

export type EsferaFilter = 'todos' | 'federal' | 'estadual' | 'municipal'
```

- [ ] **Step 2: Commit**

```bash
git add src/types/editais.ts
git commit -m "feat(editais): add TypeScript types for editais"
```

---

### Task 3: useEditais Hook

**Files:**
- Create: `src/hooks/useEditais.ts`

- [ ] **Step 1: Create the hook with search, filter, pagination, and cargo expansion**

This hook manages:
- `busca`: debounced search text
- `esfera`: filter by esfera (todos/federal/estadual/municipal)
- Pagination via URQL query
- `expandEdital(id)`: fetches full edital with cargos on expand
- Caches expanded editais to avoid refetch

```typescript
// src/hooks/useEditais.ts
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useQuery } from 'urql'
import { editaisClient } from '@/lib/editais-client'
import type { EditaisPaginados, Edital, EsferaFilter } from '@/types/editais'

const EDITAIS_LIST_QUERY = `
  query EditaisList($filtro: EditalFiltro, $pagina: Int, $porPagina: Int) {
    editais(filtro: $filtro, pagina: $pagina, porPagina: $porPagina) {
      dados {
        id
        nome
        sigla
        esfera
        tipo
        totalCargos
        totalDisciplinas
        totalTopicos
      }
      paginacao {
        total
        pagina
        porPagina
        totalPaginas
      }
    }
  }
`

const EDITAL_DETAIL_QUERY = `
  query EditalDetail($id: Int!) {
    edital(id: $id) {
      id
      nome
      sigla
      esfera
      tipo
      totalCargos
      totalDisciplinas
      totalTopicos
      cargos {
        id
        nome
        vagas
        remuneracao
        qtdDisciplinas
        qtdTopicos
      }
    }
  }
`

export function useEditais() {
  const [busca, setBusca] = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')
  const [esfera, setEsfera] = useState<EsferaFilter>('todos')
  const [pagina, setPagina] = useState(1)
  const [openEditalId, setOpenEditalId] = useState<number | null>(null)
  const [expandedCache, setExpandedCache] = useState<Record<number, Edital>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)
  const porPagina = 20

  // Debounce search
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedBusca(busca)
      setPagina(1)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [busca])

  // Build filter
  const filtro = useMemo(() => {
    const f: Record<string, unknown> = { ativo: true }
    if (debouncedBusca) f.busca = debouncedBusca
    if (esfera !== 'todos') f.esfera = esfera
    return f
  }, [debouncedBusca, esfera])

  // List query
  const [listResult] = useQuery({
    query: EDITAIS_LIST_QUERY,
    variables: { filtro, pagina, porPagina },
    context: useMemo(() => ({ url: editaisClient.url }), []),
  })

  const editaisPaginados: EditaisPaginados | null =
    listResult.data?.editais ?? null

  // Toggle expand + fetch cargos
  const toggleEdital = useCallback(async (id: number) => {
    if (openEditalId === id) {
      setOpenEditalId(null)
      return
    }
    setOpenEditalId(id)

    if (expandedCache[id]) return

    setLoadingDetail(true)
    try {
      const result = await editaisClient.query(EDITAL_DETAIL_QUERY, { id }).toPromise()
      if (result.data?.edital) {
        setExpandedCache(prev => ({ ...prev, [id]: result.data.edital }))
      }
    } finally {
      setLoadingDetail(false)
    }
  }, [openEditalId, expandedCache])

  const handleEsferaChange = useCallback((e: EsferaFilter) => {
    setEsfera(e)
    setPagina(1)
  }, [])

  return {
    // State
    busca,
    esfera,
    pagina,
    openEditalId,
    loadingDetail,

    // Data
    editais: editaisPaginados?.dados ?? [],
    paginacao: editaisPaginados?.paginacao ?? null,
    isLoading: listResult.fetching,
    error: listResult.error?.message ?? null,
    expandedEdital: openEditalId ? expandedCache[openEditalId] ?? null : null,

    // Actions
    setBusca,
    setEsfera: handleEsferaChange,
    setPagina,
    toggleEdital,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEditais.ts
git commit -m "feat(editais): add useEditais hook with search, filter, pagination"
```

---

### Task 4: EditaisPage Component

**Files:**
- Create: `src/views/EditaisPage.tsx`

- [ ] **Step 1: Create the full page component**

The page has 4 sections:
1. **Hero** — title + subtitle + 3 stat counters
2. **Search row** — search input + esfera segmented control
3. **Card list** — edital cards with accordion for cargos
4. **Pagination** — previous/next buttons

Purple accent palette from the approved mockup: `#6c63ff` (primary), `#9b8afb` (light), `#eeecfb` (bg), `#f5f3ff` (hover).

```typescript
// src/views/EditaisPage.tsx
"use client"

import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { IconSearch, IconChevronRight, IconLoader2 } from "@tabler/icons-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { useEditais } from "@/hooks/useEditais"
import type { EditalResumo, EsferaFilter } from "@/types/editais"

// --- Esfera badge colors ---
const esferaColors: Record<string, { bg: string; text: string }> = {
  federal: { bg: "bg-[#eeecfb]", text: "text-[#6c63ff]" },
  estadual: { bg: "bg-[#e8f1fd]", text: "text-[#4a8fe7]" },
  municipal: { bg: "bg-[#e4f8f0]", text: "text-[#2da87a]" },
}

function getEsferaStyle(esfera: string | null) {
  if (!esfera) return esferaColors.federal
  const key = esfera.toLowerCase()
  return esferaColors[key] ?? esferaColors.federal
}

// --- Format large numbers ---
function formatTopicos(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".", ",") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ".") + ""
  return String(n)
}

// --- Segmented control ---
const esferaOptions: { value: EsferaFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "federal", label: "Federal" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
]

export default function EditaisPage() {
  const navigate = useNavigate()
  const {
    busca, esfera, openEditalId, loadingDetail,
    editais, paginacao, isLoading, error, expandedEdital,
    setBusca, setEsfera, setPagina, toggleEdital,
  } = useEditais()

  const handleGoToCargo = useCallback((editalId: number, cargoId: number) => {
    navigate(`/documents-organization?editalId=${editalId}&cargoId=${cargoId}`)
  }, [navigate])

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-[900px] w-full mx-auto px-6 py-9 pb-20">

        {/* ---- Hero ---- */}
        <div className="flex justify-between items-end mb-7">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight mb-1.5">
              Editais{" "}
              <span className="bg-gradient-to-r from-[#6c63ff] to-[#9b8afb] bg-clip-text text-transparent">
                verticalizados
              </span>
            </h1>
            <p className="text-sm text-[#9994a8] max-w-[400px] leading-relaxed">
              Selecione um concurso, escolha seu cargo e estude o conteúdo programático completo.
            </p>
          </div>
          {paginacao && (
            <div className="flex gap-5">
              <HeroStat value={paginacao.total} label="Editais" />
            </div>
          )}
        </div>

        {/* ---- Search + Filter ---- */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#c4c0ce]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, sigla ou órgão..."
              className="w-full bg-white border-[1.5px] border-[#eae8ee] rounded-xl py-[11px] pl-10 pr-4 text-sm text-[#1a1a1a] outline-none transition-all font-[inherit] placeholder:text-[#c4c0ce] focus:border-[#6c63ff] focus:shadow-[0_0_0_4px_rgba(108,99,255,0.06)]"
            />
          </div>
          <div className="inline-flex bg-[#f0eff2] rounded-[10px] p-[3px]">
            {esferaOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setEsfera(opt.value)}
                className={cn(
                  "px-[15px] py-[7px] rounded-lg text-xs font-medium cursor-pointer transition-all select-none",
                  esfera === opt.value
                    ? "bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-[#9994a8] hover:text-[#6c63ff]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Section title ---- */}
        <div className="text-xs font-bold text-[#b0adb8] uppercase tracking-wider mb-3">
          {esfera === "todos" ? "Todos os editais" : `Editais — ${esfera}`}
        </div>

        {/* ---- Loading ---- */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <IconLoader2 className="h-6 w-6 text-[#6c63ff] animate-spin" />
          </div>
        )}

        {/* ---- Error ---- */}
        {error && !isLoading && (
          <div className="text-center py-20 text-sm text-red-400">
            Erro ao carregar editais: {error}
          </div>
        )}

        {/* ---- Empty ---- */}
        {!isLoading && !error && editais.length === 0 && (
          <div className="text-center py-20 text-sm text-[#b0adb8]">
            Nenhum edital encontrado.
          </div>
        )}

        {/* ---- Card list ---- */}
        {!isLoading && !error && editais.length > 0 && (
          <div className="flex flex-col gap-2">
            {editais.map(ed => (
              <EditalCard
                key={ed.id}
                edital={ed}
                isOpen={openEditalId === ed.id}
                onToggle={() => toggleEdital(ed.id)}
                expandedCargos={openEditalId === ed.id ? expandedEdital?.cargos ?? null : null}
                loadingCargos={openEditalId === ed.id && loadingDetail}
                onGoToCargo={(cargoId) => handleGoToCargo(ed.id, cargoId)}
              />
            ))}
          </div>
        )}

        {/* ---- Pagination ---- */}
        {paginacao && paginacao.totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              disabled={paginacao.pagina <= 1}
              onClick={() => setPagina(paginacao.pagina - 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6c63ff] hover:bg-[#f5f3ff] disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-[#b0adb8] tabular-nums">
              {paginacao.pagina} / {paginacao.totalPaginas}
            </span>
            <button
              disabled={paginacao.pagina >= paginacao.totalPaginas}
              onClick={() => setPagina(paginacao.pagina + 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6c63ff] hover:bg-[#f5f3ff] disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <div className="text-[22px] font-extrabold tabular-nums tracking-tight">
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-[11px] text-[#b0adb8]">{label}</div>
    </div>
  )
}

interface EditalCardProps {
  edital: EditalResumo
  isOpen: boolean
  onToggle: () => void
  expandedCargos: { id: number; nome: string; qtdDisciplinas: number | null; qtdTopicos: number | null }[] | null
  loadingCargos: boolean
  onGoToCargo: (cargoId: number) => void
}

function EditalCard({ edital, isOpen, onToggle, expandedCargos, loadingCargos, onGoToCargo }: EditalCardProps) {
  const esferaStyle = getEsferaStyle(edital.esfera)

  return (
    <div
      className={cn(
        "bg-white border-[1.5px] rounded-[13px] transition-all overflow-hidden",
        isOpen
          ? "border-[#6c63ff] shadow-[0_4px_20px_rgba(108,99,255,0.08)]"
          : "border-[#eae8ee] hover:border-[#d4d0f0] hover:shadow-[0_2px_10px_rgba(108,99,255,0.05)] cursor-pointer"
      )}
    >
      {/* Main row */}
      <div
        className="flex items-center px-5 py-3.5 gap-4"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onToggle()}
      >
        {/* Avatar */}
        <div className={cn(
          "w-[38px] h-[38px] rounded-[9px] flex items-center justify-center text-[11px] font-bold shrink-0",
          esferaStyle.bg, esferaStyle.text
        )}>
          {edital.sigla ?? "?"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-[#1a1a1a] truncate">
            {edital.nome}
          </div>
          <div className="text-[11.5px] text-[#b0adb8]">
            {edital.esfera ?? "—"}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-5 shrink-0">
          <CardStat value={edital.totalCargos} label="Cargos" />
          <CardStat value={edital.totalDisciplinas} label="Disc" />
          <CardStat value={formatTopicos(edital.totalTopicos)} label="Tópicos" />
        </div>

        {/* Arrow */}
        <IconChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform text-[#d4d0de]",
            isOpen && "rotate-90 text-[#6c63ff]"
          )}
        />
      </div>

      {/* Cargos accordion */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pl-[74px]">
              <div className="h-px bg-[#f0eff2] mb-3" />

              {loadingCargos && !expandedCargos && (
                <div className="flex items-center gap-2 py-3 text-xs text-[#b0adb8]">
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando cargos...
                </div>
              )}

              {expandedCargos?.map(cargo => (
                <div
                  key={cargo.id}
                  onClick={() => onGoToCargo(cargo.id)}
                  className="flex items-center py-[9px] px-3.5 rounded-[9px] cursor-pointer transition-colors gap-3 group hover:bg-[#f8f7fd]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4d0de] shrink-0 group-hover:bg-[#6c63ff]" />
                  <div className="text-[13px] font-[550] text-[#1a1a1a] flex-1">
                    {cargo.nome}
                  </div>
                  <div className="text-[11px] text-[#b0adb8] shrink-0">
                    {cargo.qtdDisciplinas ?? 0} disc · {cargo.qtdTopicos ?? 0} tóp
                  </div>
                  <div className="text-[11px] font-semibold text-[#6c63ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Estudar →
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CardStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center min-w-[50px]">
      <div className="text-sm font-bold text-[#1a1a1a] tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      <div className="text-[9px] text-[#c4c0ce] uppercase tracking-wide">{label}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/EditaisPage.tsx
git commit -m "feat(editais): add EditaisPage with hero, search, cards, accordion"
```

---

### Task 5: Wire Up Route and Sidebar

**Files:**
- Modify: `src/App.tsx:1-222`
- Modify: `src/components/AppSidebar.tsx:1-88`

- [ ] **Step 1: Add route in App.tsx**

Add the import at line ~27 (with the other view imports):

```typescript
import EditaisPage from "./views/EditaisPage";
```

Add the Provider wrapper around AppContent. In the `AppContent` return (line ~111), wrap the existing providers with the URQL editais provider:

```typescript
import { Provider as EditaisUrqlProvider } from 'urql'
import { editaisClient } from '@/lib/editais-client'
```

In `AppContent`, add the editais URQL provider. Wrap after `<CadernosProvider>` (line 109):

Before:
```typescript
<CadernosProvider>
<QuestoesProvider>
<UrqlProvider value={leiClient}>
```

After:
```typescript
<CadernosProvider>
<QuestoesProvider>
<UrqlProvider value={leiClient}>
```

Actually, since URQL's Provider only supports one client at a time, the editais hook uses `editaisClient` directly (via `editaisClient.query()` for detail, and the `context` option for the list query with explicit URL override). So we do NOT need a separate provider — the hook already handles it.

Instead, we just need to update the `useEditais` hook to NOT use `useQuery` from URQL (which needs a Provider), and instead use the client directly. Let me revise.

**Revised approach:** The hook should use `editaisClient.query().toPromise()` for both list and detail queries, managing state with useState. This avoids needing a second URQL Provider.

This revision is already handled — see revised Task 3 below in "Task 3 Revision" section.

Add the route in the `<Route path="/" element={<AppContent />}>` block, after the `cadernos` route (line ~185):

```tsx
{/* Editais */}
<Route path="editais" element={<PrivateRoute><EditaisPage /></PrivateRoute>} />
```

Also add `/editais` to the `isFullWidth` check (line ~76):

Before:
```typescript
const isFullWidth = (location?.pathname?.startsWith('/lei-seca') || location?.pathname?.startsWith('/documents-organization') || location?.pathname?.startsWith('/cadernos')) ?? false;
```

After:
```typescript
const isFullWidth = (location?.pathname?.startsWith('/lei-seca') || location?.pathname?.startsWith('/documents-organization') || location?.pathname?.startsWith('/cadernos') || location?.pathname?.startsWith('/editais')) ?? false;
```

- [ ] **Step 2: Add sidebar nav item in AppSidebar.tsx**

Add import at top:
```typescript
import { IconClipboardList } from "@tabler/icons-react";
```

Add to `mainNavigation` array after the "Cadernos" entry (line ~87):

```typescript
{
  label: "Editais",
  href: "/editais",
  icon: <IconClipboardList className="h-5 w-5" />,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat(editais): wire up /editais route and sidebar nav"
```

---

### Task 3 (Revised): useEditais Hook — No URQL Provider Dependency

Since the app already has one URQL Provider for `leiClient`, and adding a second provider would conflict, the editais hook must use `editaisClient` directly without `useQuery`.

**Files:**
- Create: `src/hooks/useEditais.ts`

- [ ] **Step 1: Create the hook using editaisClient directly**

```typescript
// src/hooks/useEditais.ts
import { useState, useCallback, useEffect, useRef } from 'react'
import { editaisClient } from '@/lib/editais-client'
import type { EditaisPaginados, Edital, EsferaFilter } from '@/types/editais'

const EDITAIS_LIST_QUERY = `
  query EditaisList($filtro: EditalFiltro, $pagina: Int, $porPagina: Int) {
    editais(filtro: $filtro, pagina: $pagina, porPagina: $porPagina) {
      dados {
        id
        nome
        sigla
        esfera
        tipo
        totalCargos
        totalDisciplinas
        totalTopicos
      }
      paginacao {
        total
        pagina
        porPagina
        totalPaginas
      }
    }
  }
`

const EDITAL_DETAIL_QUERY = `
  query EditalDetail($id: Int!) {
    edital(id: $id) {
      id
      nome
      sigla
      esfera
      tipo
      totalCargos
      totalDisciplinas
      totalTopicos
      cargos {
        id
        nome
        vagas
        remuneracao
        qtdDisciplinas
        qtdTopicos
      }
    }
  }
`

export function useEditais() {
  const [busca, setBusca] = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')
  const [esfera, setEsfera] = useState<EsferaFilter>('todos')
  const [pagina, setPagina] = useState(1)
  const [openEditalId, setOpenEditalId] = useState<number | null>(null)
  const [expandedCache, setExpandedCache] = useState<Record<number, Edital>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)

  // List state
  const [editaisPaginados, setEditaisPaginados] = useState<EditaisPaginados | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const porPagina = 20

  // Debounce search
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedBusca(busca)
      setPagina(1)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [busca])

  // Fetch list
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const filtro: Record<string, unknown> = { ativo: true }
    if (debouncedBusca) filtro.busca = debouncedBusca
    if (esfera !== 'todos') filtro.esfera = esfera

    editaisClient
      .query(EDITAIS_LIST_QUERY, { filtro, pagina, porPagina })
      .toPromise()
      .then(result => {
        if (cancelled) return
        if (result.error) {
          setError(result.error.message)
        } else {
          setEditaisPaginados(result.data?.editais ?? null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [debouncedBusca, esfera, pagina])

  // Toggle expand + fetch cargos
  const toggleEdital = useCallback(async (id: number) => {
    if (openEditalId === id) {
      setOpenEditalId(null)
      return
    }
    setOpenEditalId(id)

    if (expandedCache[id]) return

    setLoadingDetail(true)
    try {
      const result = await editaisClient.query(EDITAL_DETAIL_QUERY, { id }).toPromise()
      if (result.data?.edital) {
        setExpandedCache(prev => ({ ...prev, [id]: result.data.edital }))
      }
    } finally {
      setLoadingDetail(false)
    }
  }, [openEditalId, expandedCache])

  const handleEsferaChange = useCallback((e: EsferaFilter) => {
    setEsfera(e)
    setPagina(1)
  }, [])

  return {
    busca,
    esfera,
    pagina,
    openEditalId,
    loadingDetail,

    editais: editaisPaginados?.dados ?? [],
    paginacao: editaisPaginados?.paginacao ?? null,
    isLoading,
    error,
    expandedEdital: openEditalId ? expandedCache[openEditalId] ?? null : null,

    setBusca,
    setEsfera: handleEsferaChange,
    setPagina,
    toggleEdital,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEditais.ts
git commit -m "feat(editais): add useEditais hook (direct client, no provider)"
```

---

### Task 6: Add Environment Variable

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add the editais API URL to .env**

Append to `.env`:

```
NEXT_PUBLIC_EDITAIS_API_URL=https://editais.projetopapiro.com.br/graphql
```

- [ ] **Step 2: Commit**

```bash
git add .env
git commit -m "chore: add NEXT_PUBLIC_EDITAIS_API_URL env var"
```

---

### Task 7: Smoke Test

- [ ] **Step 1: Run dev server and verify**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to http://localhost:3000/editais**

Verify:
- Hero section renders with "Editais verticalizados" title
- Stats counter shows total editais from API
- Search input is present and debounces
- Esfera segmented control filters (Todos/Federal/Estadual/Municipal)
- Edital cards render with sigla avatar, nome, stats
- Clicking a card expands to show cargos with loading state
- Clicking "Estudar →" navigates to `/documents-organization?editalId=X&cargoId=Y`
- Pagination works when >20 results
- Sidebar shows "Editais" icon in the nav rail

- [ ] **Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix(editais): smoke test fixes"
```

---

## Execution Order

Execute tasks in this order: **1 → 2 → 3 (revised) → 4 → 5 → 6 → 7**

Tasks 1, 2 have no dependencies and can be done in parallel.
Task 3 depends on 1 + 2. Task 4 depends on 3. Task 5 depends on 4.
Task 6 is independent but logically follows 5.
Task 7 requires everything.
