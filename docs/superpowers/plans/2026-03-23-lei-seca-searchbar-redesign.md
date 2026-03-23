# Lei Seca SearchBar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken UnifiedSearchBar + redundant sidebar with a unified SearchBreadcrumb component (breadcrumb when idle, search input when active) aligned with the text column, using existing LeiTree + TracingBeam for the hierarchy dropdown with expandable articles.

**Architecture:** Single `SearchBreadcrumb` component with two states (breadcrumb/search). Dropdown renders `LeiTree` wrapped in `TracingBeam` for hierarchy navigation, plus full-text API results. Artigos injected as leaf nodes on expand via local `dispositivos` filtering. Sidebar and old search components deleted.

**Tech Stack:** React 19, TypeScript, urql (useBusca), LeiTree + TracingBeam (existing), framer-motion (AnimatePresence), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-23-lei-seca-searchbar-redesign-design.md`
**Mockups:** `.superpowers/brainstorm/3421-1774293518/minimal-beautiful.html`, `hierarchy-with-articles.html`

**Important codebase notes:**
- ESM project with Next.js 15, path alias `@/*` → `./src/*`
- Text column uses `max-w-[820px] mx-auto px-5` (in `DispositivoList.tsx:48`). SearchBreadcrumb MUST match this, not the 700px in the spec.
- `hierarquiaToTreeNodes()` lives in `LeiSecaSidebar.tsx:21-30` — extract to shared util before deleting sidebar
- `LeiTree` already supports `type: 'artigo'` nodes with `artigoIndex`, `onSelectArtigo` (`lei-tree.tsx:61-69`)
- `TracingBeam` needs `scrollContainerRef` — point at the dropdown's scroll div
- `activeArtigoStore` is a `useSyncExternalStore` external store (`stores/activeArtigoStore.ts`)
- `useBusca(termo, leiId)` requires caller to debounce; pauses if `termo.length < 2`; returns `{ hits, total, isSearching }`
- `Dispositivo.path` can be `null` — breadcrumb must handle this fallback

---

## File Structure

```
src/
├── lib/
│   └── lei-hierarchy.ts                    ← NEW: extracted hierarquiaToTreeNodes + injectArtigosIntoTree + resolveBreadcrumb
├── components/
│   └── lei-seca/
│       ├── SearchBreadcrumb.tsx             ← NEW: unified breadcrumb/search (two states)
│       ├── SearchBreadcrumbDropdown.tsx     ← NEW: dropdown with LeiTree+TracingBeam + search results
│       ├── HighlightText.tsx               ← NEW: safe highlight component (no dangerouslySetInnerHTML)
│       ├── LeiToolbar.tsx                  ← MODIFY: remove UnifiedSearchBar import/usage
│       ├── UnifiedSearchBar.tsx            ← DELETE
│       ├── LeiSecaSidebar.tsx              ← DELETE
│       └── LeiSearchBar.tsx                ← DELETE
├── views/
│   └── LeiSecaPage.tsx                     ← MODIFY: add SearchBreadcrumb to content area
└── components/
    └── AppSidebar.tsx                      ← MODIFY: remove LeiSecaSidebar branch
```

---

## Task 1: Extract hierarchy utilities to shared lib

**Files:**
- Create: `src/lib/lei-hierarchy.ts`
- Read: `src/components/lei-seca/LeiSecaSidebar.tsx:21-30` (source of `hierarquiaToTreeNodes`)
- Read: `src/types/lei-api.ts` (HierarquiaNode, Dispositivo types)
- Read: `src/components/ui/lei-tree.tsx:10-26` (LeiTreeNode type)

- [ ] **Step 1: Create `src/lib/lei-hierarchy.ts` with `hierarquiaToTreeNodes`**

```typescript
import type { HierarquiaNode, Dispositivo } from '@/types/lei-api'
import type { LeiTreeNode } from '@/components/ui/lei-tree'

// ---- Map API hierarchy → LeiTree data ----

export function hierarquiaToTreeNodes(nodes: HierarquiaNode[]): LeiTreeNode[] {
  return nodes.map((node) => ({
    id: node.path,
    type: node.tipo.toLowerCase() as LeiTreeNode['type'],
    badge: node.descricao,
    label: node.descricao,
    sublabel: node.subtitulo,
    children: node.filhos?.length ? hierarquiaToTreeNodes(node.filhos) : undefined,
  }))
}

// ---- Inject artigos as leaf nodes when a branch is expanded ----

export function injectArtigosIntoTree(
  treeNodes: LeiTreeNode[],
  dispositivos: Dispositivo[],
  expandedIds: Set<string>
): LeiTreeNode[] {
  return treeNodes.map(node => {
    // Recurse into children first
    const children = node.children
      ? injectArtigosIntoTree(node.children, dispositivos, expandedIds)
      : undefined

    // If this node is expanded and is a leaf branch (no sub-branches with children),
    // inject matching artigos from dispositivos
    if (expandedIds.has(node.id)) {
      const artigos = dispositivos
        .filter(d => d.tipo === 'ARTIGO' && d.path?.startsWith(node.id + '/'))
        .map((d, _i, arr) => ({
          id: `artigo-${d.id}`,
          type: 'artigo' as const,
          label: `Art. ${d.numero ?? '?'}`,
          preview: d.texto.slice(0, 60),
          artigoIndex: dispositivos.indexOf(d),
          children: undefined,
        }))

      if (artigos.length > 0) {
        return {
          ...node,
          children: [...(children ?? []), ...artigos],
        }
      }
    }

    return { ...node, children }
  })
}

// ---- Breadcrumb resolution ----

export interface BreadcrumbSegment {
  label: string
  path: string
}

export function resolveBreadcrumb(
  dispositivos: Dispositivo[],
  activeIndex: number,
  hierarquia: HierarquiaNode[]
): BreadcrumbSegment[] {
  const dispositivo = dispositivos[activeIndex]
  if (!dispositivo?.path) {
    // Null path fallback: show just the article marker
    if (dispositivo?.numero) {
      return [{ label: `Art. ${dispositivo.numero}`, path: '' }]
    }
    return []
  }

  const segments: BreadcrumbSegment[] = []
  const pathParts = dispositivo.path.split('/')

  // Walk the hierarchy tree matching path parts
  let currentNodes = hierarquia
  let currentPath = ''

  for (const part of pathParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const match = currentNodes.find(n => n.path === currentPath)
    if (match) {
      segments.push({
        label: match.descricao + (match.subtitulo ? ` — ${match.subtitulo}` : ''),
        path: match.path,
      })
      currentNodes = match.filhos ?? []
    }
  }

  return segments
}

// ---- Resolve tree node path → dispositivo posicao ----

export function resolvePathToPosicao(
  path: string,
  dispositivos: Dispositivo[]
): number | null {
  const match = dispositivos.find(d => d.path?.startsWith(path))
  return match?.posicao ?? null
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/lei-hierarchy.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/lei-hierarchy.ts
git commit -m "refactor: extract hierarchy utilities to shared lib"
```

---

## Task 2: Create HighlightText component (safe replacement for dangerouslySetInnerHTML)

**Files:**
- Create: `src/components/lei-seca/HighlightText.tsx`

- [ ] **Step 1: Create `src/components/lei-seca/HighlightText.tsx`**

```typescript
"use client"

import { memo } from 'react'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface HighlightTextProps {
  text: string
  query: string
  className?: string
}

export const HighlightText = memo(function HighlightText({ text, query, className }: HighlightTextProps) {
  if (!query || query.length < 2) {
    return <span className={className}>{text}</span>
  }

  const escaped = escapeRegex(query)
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-gradient-to-r from-[#fff8e1] to-[#fff3c4] px-[3px] py-[1px] rounded-sm">{part}</mark>
          : part
      )}
    </span>
  )
})

// Sanitize API highlight HTML (ts_headline uses <b> tags)
// Strip everything except <b> and </b>
export function sanitizeHighlight(html: string): string {
  return html.replace(/<(?!\/?b>)[^>]*>/g, '')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/HighlightText.tsx
git commit -m "feat: add safe HighlightText component + sanitizeHighlight"
```

---

## Task 3: Create SearchBreadcrumb component (closed state = breadcrumb, open state = search input)

**Files:**
- Create: `src/components/lei-seca/SearchBreadcrumb.tsx`
- Read: `src/stores/activeArtigoStore.ts` (useActiveArtigoIndex)
- Read: `src/hooks/useLeiApi.ts` (useBusca signature)
- Read: `src/types/lei-api.ts` (Dispositivo, HierarquiaNode, Lei)

- [ ] **Step 1: Create `src/components/lei-seca/SearchBreadcrumb.tsx`**

```typescript
"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { useBusca } from '@/hooks/useLeiApi'
import { resolveBreadcrumb } from '@/lib/lei-hierarchy'
import { SearchBreadcrumbDropdown } from './SearchBreadcrumbDropdown'
import type { Dispositivo, HierarquiaNode, Lei } from '@/types/lei-api'

interface SearchBreadcrumbProps {
  currentLei: Lei
  dispositivos: Dispositivo[]
  totalDispositivos: number
  onScrollToDispositivo: (posicao: number) => void
  onSelectArtigoIndex: (index: number) => void
}

export function SearchBreadcrumb({
  currentLei,
  dispositivos,
  totalDispositivos,
  onScrollToDispositivo,
  onSelectArtigoIndex,
}: SearchBreadcrumbProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const activeIndex = useActiveArtigoIndex()

  // Breadcrumb segments
  const segments = useMemo(
    () => resolveBreadcrumb(dispositivos, activeIndex, currentLei.hierarquia ?? []),
    [dispositivos, activeIndex, currentLei.hierarquia]
  )

  // Debounce search
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (input.length >= 2) {
      timerRef.current = setTimeout(() => setDebouncedTerm(input), 500)
    } else {
      setDebouncedTerm('')
    }
    return () => clearTimeout(timerRef.current)
  }, [input])

  // API search
  const { hits, total, isSearching } = useBusca(debouncedTerm, currentLei.id)

  // Ctrl+F / Cmd+F opens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Click outside closes
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setInput('')
        setDebouncedTerm('')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleClear = useCallback(() => {
    setInput('')
    setDebouncedTerm('')
    inputRef.current?.focus()
  }, [])

  const handleSelect = useCallback((posicao: number) => {
    onScrollToDispositivo(posicao)
    setOpen(false)
    setInput('')
    setDebouncedTerm('')
  }, [onScrollToDispositivo])

  const handleSelectArtigo = useCallback((artigoIndex: number) => {
    onSelectArtigoIndex(artigoIndex)
    setOpen(false)
    setInput('')
    setDebouncedTerm('')
  }, [onSelectArtigoIndex])

  const hasInput = input.length > 0
  const totalArtigos = currentLei.stats?.totalArtigos ?? totalDispositivos

  return (
    <div ref={containerRef} className="relative font-[Outfit,sans-serif]">
      {/* ---- CLOSED: Breadcrumb ---- */}
      {!open && (
        <button
          onClick={handleOpen}
          className="w-full flex items-center gap-[6px] py-[14px] sm:py-[14px] py-[10px] cursor-pointer transition-opacity hover:opacity-80"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          {segments.length > 0 ? (
            <>
              {segments.map((seg, i) => (
                <span key={seg.path} className="flex items-center gap-[6px]">
                  {i > 0 && <span className="text-[9px] text-[#ddd]">›</span>}
                  <span className={`text-[11px] font-light ${
                    i === segments.length - 1 ? 'text-[#888] font-normal' : 'text-[#c0c0c0]'
                  }`}>
                    {seg.label}
                  </span>
                </span>
              ))}
            </>
          ) : (
            <span className="text-[11px] text-[#c0c0c0] font-light">Buscar na lei...</span>
          )}

          <span className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] text-[#ddd] font-mono bg-[#f8f8f8] px-[6px] py-[1px] rounded hidden sm:inline">Ctrl+F</span>
            <span className="text-[10px] text-[#ddd] font-light tabular-nums">
              {activeIndex + 1} / {totalArtigos}
            </span>
          </span>
        </button>
      )}

      {/* ---- OPEN: Search input ---- */}
      {open && (
        <div className="py-[14px] sm:py-[14px] py-[10px]">
          <div className="flex items-center gap-2 px-[14px] py-2 bg-[#fafafa] border border-[#e8e8e8] rounded-t-[10px] sm:rounded-t-[10px] rounded-[8px] sm:border-b-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2c3338" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Buscar artigo, tema, palavra..."
              className="flex-1 text-[12px] outline-none text-[#333] placeholder:text-[#bbb] bg-transparent font-[Outfit,sans-serif] min-w-0"
            />
            {hasInput && (
              <>
                {isSearching && <span className="text-[9px] text-[#b0b0b0] font-light flex-shrink-0">buscando...</span>}
                {!isSearching && debouncedTerm.length >= 2 && (
                  <span className="text-[9px] text-[#b0b0b0] font-light flex-shrink-0">{total} resultado{total !== 1 ? 's' : ''}</span>
                )}
                <button
                  onClick={handleClear}
                  className="w-4 h-4 flex items-center justify-center text-[#ccc] hover:bg-[#eee] rounded-full text-[14px] flex-shrink-0 transition-colors"
                >
                  ×
                </button>
              </>
            )}
            {!hasInput && (
              <span className="text-[9px] text-[#ccc] font-light flex-shrink-0">esc</span>
            )}
          </div>
        </div>
      )}

      {/* Separator (visible in both states) */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, #f0f0f0, transparent)' }} />

      {/* ---- DROPDOWN ---- */}
      {open && (
        <SearchBreadcrumbDropdown
          hierarquia={currentLei.hierarquia ?? []}
          dispositivos={dispositivos}
          input={input}
          hits={hits}
          total={total}
          isSearching={isSearching}
          debouncedTerm={debouncedTerm}
          onSelectHit={handleSelect}
          onSelectArtigo={handleSelectArtigo}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors in the file**

Run: `npx tsc --noEmit 2>&1 | grep -i "SearchBreadcrumb" | head -10`
Expected: Only errors from missing `SearchBreadcrumbDropdown` (created next task)

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumb.tsx
git commit -m "feat: create SearchBreadcrumb component (breadcrumb + search states)"
```

---

## Task 4: Create SearchBreadcrumbDropdown component (LeiTree + TracingBeam + search results)

**Files:**
- Create: `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`
- Read: `src/components/ui/lei-tree.tsx` (LeiTree, LeiTreeNode)
- Read: `src/components/ui/tracing-beam.tsx` (TracingBeam, TracingBeamRef)
- Read: `src/lib/lei-hierarchy.ts` (injectArtigosIntoTree, resolvePathToPosicao)

- [ ] **Step 1: Create `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`**

```typescript
"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { LeiTree } from '@/components/ui/lei-tree'
import type { LeiTreeNode } from '@/components/ui/lei-tree'
import { TracingBeam } from '@/components/ui/tracing-beam'
import type { TracingBeamRef } from '@/components/ui/tracing-beam'
import { hierarquiaToTreeNodes, injectArtigosIntoTree, resolvePathToPosicao } from '@/lib/lei-hierarchy'
import { HighlightText, sanitizeHighlight } from './HighlightText'
import type { HierarquiaNode, Dispositivo, BuscaHit } from '@/types/lei-api'

interface SearchBreadcrumbDropdownProps {
  hierarquia: HierarquiaNode[]
  dispositivos: Dispositivo[]
  input: string
  hits: BuscaHit[]
  total: number
  isSearching: boolean
  debouncedTerm: string
  onSelectHit: (posicao: number) => void
  onSelectArtigo: (artigoIndex: number) => void
}

// ---- Filter tree by search query ----
function filterTree(nodes: LeiTreeNode[], query: string): LeiTreeNode[] {
  if (!query) return nodes
  const lower = query.toLowerCase()
  return nodes.reduce<LeiTreeNode[]>((acc, node) => {
    const labelMatch = node.label?.toLowerCase().includes(lower)
    const sublabelMatch = node.sublabel?.toLowerCase().includes(lower)
    const filteredChildren = node.children ? filterTree(node.children, query) : undefined
    const hasMatchingChildren = filteredChildren && filteredChildren.length > 0
    if (labelMatch || sublabelMatch || hasMatchingChildren) {
      acc.push({ ...node, children: hasMatchingChildren ? filteredChildren : node.children })
    }
    return acc
  }, [])
}

// ---- Collect all branch IDs for auto-expand on search ----
function collectBranchIds(nodes: LeiTreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.children?.length) {
      ids.push(node.id)
      ids.push(...collectBranchIds(node.children))
    }
  }
  return ids
}

export function SearchBreadcrumbDropdown({
  hierarquia,
  dispositivos,
  input,
  hits,
  total,
  isSearching,
  debouncedTerm,
  onSelectHit,
  onSelectArtigo,
}: SearchBreadcrumbDropdownProps) {
  const activeIndex = useActiveArtigoIndex()
  const scrollRef = useRef<HTMLDivElement>(null)
  const beamRef = useRef<TracingBeamRef>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Build base tree from hierarchy
  const baseTree = useMemo(
    () => hierarquiaToTreeNodes(hierarquia),
    [hierarquia]
  )

  // Inject artigos into expanded nodes
  const treeWithArtigos = useMemo(
    () => injectArtigosIntoTree(baseTree, dispositivos, expandedSections),
    [baseTree, dispositivos, expandedSections]
  )

  // When searching: filter tree
  const displayTree = useMemo(() => {
    if (!input) return treeWithArtigos
    return filterTree(treeWithArtigos, input)
  }, [treeWithArtigos, input])

  // Auto-expand all matching branches when searching (separate effect, not inside useMemo)
  useEffect(() => {
    if (!input) return
    const filtered = filterTree(treeWithArtigos, input)
    const allIds = collectBranchIds(filtered)
    if (allIds.length > 0) {
      setExpandedSections(new Set(allIds))
    }
  }, [input, treeWithArtigos])

  const hasInput = input.length > 0
  const showSearchResults = hasInput && (hits.length > 0 || isSearching)

  // Handle tree node click → scroll to position
  const handleTreeSelect = useCallback((_artigoIndex: number) => {
    // ArtigoNode click: use the artigo index to scroll
    onSelectArtigo(_artigoIndex)
  }, [onSelectArtigo])

  // Handle section node click → resolve path to posicao
  // LeiTree's onToggle handles expand/collapse; we also want click-to-navigate
  const handleToggleAndNavigate = useCallback((id: string) => {
    toggleSection(id)
    // Also navigate to the first dispositivo in this section
    const posicao = resolvePathToPosicao(id, dispositivos)
    if (posicao !== null) {
      onSelectHit(posicao)
    }
  }, [toggleSection, dispositivos, onSelectHit])

  return (
    <div className="absolute left-0 right-0 top-full z-50 hidden sm:block">
      <div
        ref={scrollRef}
        className="bg-[#fafafa] border border-[#e8e8e8] border-t-0 rounded-b-[10px] shadow-[0_12px_32px_rgba(0,0,0,0.08)] max-h-[380px] overflow-y-auto"
      >
        {/* ---- HIERARCHY SECTION ---- */}
        <div className="px-[14px] pt-[10px] pb-1 text-[9px] text-[#c0c0c0] uppercase tracking-[1.5px] font-normal">
          Navegação
          {hasInput && displayTree.length > 0 && (
            <span className="ml-1 normal-case tracking-normal">— {displayTree.length} itens</span>
          )}
        </div>

        {/* LeiTree + TracingBeam */}
        <div className="px-1">
          <TracingBeam
            ref={beamRef}
            activeArtigoIndex={activeIndex}
            scrollContainerRef={scrollRef}
          >
            <LeiTree
              data={displayTree}
              expanded={expandedSections}
              onToggle={handleToggleAndNavigate}
              onSelectArtigo={handleTreeSelect}
              onAnimationStart={() => beamRef.current?.animationStarted()}
              onAnimationSettled={() => beamRef.current?.remeasure()}
            />
          </TracingBeam>
        </div>

        {displayTree.length === 0 && hasInput && !showSearchResults && (
          <div className="px-[14px] py-3 text-[11px] text-[#ccc] font-light">
            Nenhum item na estrutura
          </div>
        )}

        {/* ---- DIVIDER ---- */}
        {showSearchResults && displayTree.length > 0 && (
          <div className="h-px bg-[#efefef] mx-[14px] my-[6px]" />
        )}

        {/* ---- FULL-TEXT SEARCH RESULTS ---- */}
        {showSearchResults && (
          <>
            <div className="px-[14px] pt-[8px] pb-1 text-[9px] text-[#c0c0c0] uppercase tracking-[1.5px] font-normal">
              No texto
              {!isSearching && (
                <span className="ml-1 normal-case tracking-normal">— {total} resultados</span>
              )}
              {isSearching && (
                <span className="ml-1 normal-case tracking-normal">— buscando...</span>
              )}
            </div>

            {hits.map((hit, i) => (
              <button
                key={i}
                onClick={() => onSelectHit(hit.dispositivo.posicao)}
                className="w-full text-left px-[14px] py-2 border-l-2 border-transparent hover:border-l-[#2c3338] hover:bg-[#f0f0f0] transition-all duration-150 rounded-r-lg"
              >
                <div
                  className="text-[12.5px] text-[#4a5058] leading-[1.6] font-[Literata,Georgia,serif] line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHighlight(hit.highlight) }}
                />
                <div className="text-[9px] text-[#c0c0c0] mt-[3px] font-light font-[Outfit,sans-serif]">
                  {hit.lei.titulo}
                </div>
              </button>
            ))}
          </>
        )}

        {/* No results at all */}
        {hasInput && !isSearching && debouncedTerm.length >= 2 && hits.length === 0 && displayTree.length === 0 && (
          <div className="px-[14px] py-6 text-center text-[12px] text-[#ccc] font-light">
            Nenhum resultado para "{input}"
          </div>
        )}

        {/* ---- FOOTER ---- */}
        <div className="px-[14px] py-[6px] border-t border-[#f0f0f0] text-[10px] text-[#d0d0d0] font-light flex gap-[14px] sticky bottom-0 bg-[#fafafa] rounded-b-[10px]">
          <span>↑↓</span>
          <span>→ expandir</span>
          <span>← colapsar</span>
          <span>⏎ ir</span>
          <span>esc</span>
        </div>
      </div>

      {/* Mobile: full height dropdown (shown via sm:hidden opposite) */}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0 new errors from these files

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumbDropdown.tsx
git commit -m "feat: create SearchBreadcrumbDropdown with LeiTree + TracingBeam + search results"
```

---

## Task 5: Wire SearchBreadcrumb into LeiSecaPage + strip toolbar

**Files:**
- Modify: `src/views/LeiSecaPage.tsx`
- Modify: `src/components/lei-seca/LeiToolbar.tsx`

- [ ] **Step 1: Simplify LeiToolbar — remove UnifiedSearchBar import and rendering**

In `src/components/lei-seca/LeiToolbar.tsx`:
- Remove the import of `UnifiedSearchBar`
- Remove the `<UnifiedSearchBar ... />` JSX
- Remove the `onScrollToDispositivo` prop (no longer needed)
- Keep: lei selector, toggles, font size, hints

The toolbar becomes:

```typescript
"use client"

import { fontSizeStore, useFontSize } from '@/stores/fontSizeStore'
import { useLeiSeca } from '@/contexts/LeiSecaContext'

export function LeiToolbar() {
  const {
    leis, currentLeiId, handleLeiChange,
    leiSecaMode, toggleLeiSecaMode,
    showRevogados, toggleRevogados,
  } = useLeiSeca()
  const fontSize = useFontSize()

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#eee] bg-white font-[Outfit,sans-serif] text-[12px]">
      {/* Lei selector */}
      <select
        value={currentLeiId}
        onChange={e => handleLeiChange(e.target.value)}
        className="text-[12px] py-1.5 px-2.5 border border-[#e5e5e5] rounded-lg text-[#555] bg-[#fafafa] min-w-[140px] outline-none font-[Outfit,sans-serif]"
      >
        {leis.map(l => (
          <option key={l.id} value={l.id}>{l.apelido ?? l.titulo}</option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Toggles */}
      <button
        onClick={toggleLeiSecaMode}
        className={`px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
          leiSecaMode ? 'bg-[#2c3338] text-white' : 'bg-[#f4f4f4] text-[#888] hover:bg-[#eee]'
        }`}
      >
        {leiSecaMode ? 'Lei Seca \u2713' : 'Lei Seca'}
      </button>

      <button
        onClick={toggleRevogados}
        className={`px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
          showRevogados ? 'bg-[#2c3338] text-white' : 'bg-[#f4f4f4] text-[#888] hover:bg-[#eee]'
        }`}
      >
        {showRevogados ? 'Revogados \u2713' : 'Revogados'}
      </button>

      {/* Font size */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={fontSizeStore.decrease} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#888] hover:bg-[#eee] flex items-center justify-center text-[11px] font-bold">A-</button>
        <span className="text-[11px] text-[#ccc] w-5 text-center">{fontSize}</span>
        <button onClick={fontSizeStore.increase} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#888] hover:bg-[#eee] flex items-center justify-center text-[13px] font-bold">A+</button>
      </div>

      {/* Hints */}
      <span className="text-[10px] text-[#ddd] hidden lg:block flex-shrink-0">J/K · L · R</span>
    </div>
  )
}
```

- [ ] **Step 2: Update LeiSecaPage — add SearchBreadcrumb in content area**

In `src/views/LeiSecaPage.tsx`:
- Import `SearchBreadcrumb`
- Change `<LeiToolbar onScrollToDispositivo={handleScrollToDispositivo} />` to `<LeiToolbar />`
- Add `SearchBreadcrumb` inside the content area, above `DispositivoList`, wrapped in the same `max-w-[820px] mx-auto px-5` as the text
- Add `handleSelectArtigoIndex` that scrolls Virtuoso by index

Key changes in the JSX:

**Important:** The parent `div` currently has `overflow-hidden` which would clip the dropdown. Change it to `overflow-visible` on the SearchBreadcrumb wrapper, and keep `overflow-hidden` only on the DispositivoList wrapper. Split into two wrappers:

```tsx
// In the return, the content area becomes:
<div className="flex-1 flex flex-col bg-white relative">
  {/* SearchBreadcrumb: aligned with text column, overflow-visible for dropdown */}
  <div className="max-w-[820px] mx-auto px-5 w-full relative z-20">
    <SearchBreadcrumb
      currentLei={currentLei}
      dispositivos={dispositivos}
      totalDispositivos={totalDispositivos}
      onScrollToDispositivo={handleScrollToDispositivo}
      onSelectArtigoIndex={handleSelectArtigoIndex}
    />
  </div>
  {/* DispositivoList: overflow-hidden stays here */}
  <div className="flex-1 overflow-hidden">
  <DispositivoList
    dispositivos={dispositivos}
    totalCount={totalDispositivos}
    loadMore={loadMore}
    hasMore={hasMore}
    isLoadingMore={isLoadingMore}
    leiSecaMode={leiSecaMode}
    showRevogados={showRevogados}
    onRangeChanged={handleRangeChanged}
    virtuosoRef={virtuosoRef}
  />
</div>
```

Add `handleSelectArtigoIndex`:

```typescript
const handleSelectArtigoIndex = useCallback(
  (index: number) => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({ index, align: 'start', behavior: 'smooth' })
    }
  },
  []
)
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds (or only pre-existing errors)

- [ ] **Step 4: Commit**

```bash
git add src/views/LeiSecaPage.tsx src/components/lei-seca/LeiToolbar.tsx
git commit -m "feat: wire SearchBreadcrumb into page, strip search from toolbar"
```

---

## Task 6: Remove AppSidebar's LeiSecaSidebar branch

**Files:**
- Modify: `src/components/AppSidebar.tsx:23,256-257`

- [ ] **Step 1: Remove LeiSecaSidebar import and rendering**

In `src/components/AppSidebar.tsx`:
- Line 23: Remove `import { LeiSecaSidebar } from "./lei-seca/LeiSecaSidebar";`
- Lines 256-257: Replace the `panelItem.href === "/lei-seca"` branch:

```typescript
// Before:
) : panelItem.href === "/lei-seca" ? (
  <LeiSecaSidebar />
) : panelItem.href === "/documents-organization" ? (

// After:
) : panelItem.href === "/lei-seca" ? (
  null
) : panelItem.href === "/documents-organization" ? (
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep "AppSidebar" | head -5`
Expected: No errors from AppSidebar

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "refactor: remove LeiSecaSidebar from AppSidebar"
```

---

## Task 7: Delete obsolete files

**Files:**
- Delete: `src/components/lei-seca/UnifiedSearchBar.tsx`
- Delete: `src/components/lei-seca/LeiSecaSidebar.tsx`
- Delete: `src/components/lei-seca/LeiSearchBar.tsx`

- [ ] **Step 1: Verify no remaining imports of these files**

Run:
```bash
grep -r "UnifiedSearchBar\|LeiSecaSidebar\|LeiSearchBar" src/ --include="*.tsx" --include="*.ts" -l
```
Expected: Only the files being deleted themselves (no other consumers)

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/lei-seca/UnifiedSearchBar.tsx
git rm src/components/lei-seca/LeiSecaSidebar.tsx
git rm src/components/lei-seca/LeiSearchBar.tsx
```

- [ ] **Step 3: Verify build still works**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0 new errors

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete UnifiedSearchBar, LeiSecaSidebar, LeiSearchBar (replaced by SearchBreadcrumb)"
```

---

## Task 8: Visual polish — match minimal design from mockups

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumb.tsx`
- Modify: `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`
- Modify: `src/components/lei-seca/LeiToolbar.tsx`

- [ ] **Step 1: Update toolbar accent color to `#2c3338`**

In `LeiToolbar.tsx`, replace `rgb(67,80,92)` (which is `#43505c`) with `#2c3338` on the toggle buttons. The spec mandates `#2c3338` as the single accent color.

- [ ] **Step 2: Text dimming when dropdown is open**

In `LeiSecaPage.tsx`, add a state or pass-through so the `DispositivoList` wrapper gets `opacity: 0.15` when `SearchBreadcrumb` dropdown is open. Implementation option: lift `open` state to page via a callback `onOpenChange`, or use a CSS approach with a sibling selector.

Simplest: add `data-search-open` attribute on a parent, use CSS:
```css
[data-search-open="true"] + .dispositivo-list-wrapper { opacity: 0.15; transition: opacity 0.2s; }
```

- [ ] **Step 3: Run dev server and visually verify**

Run: `npm run dev`
Check in browser at `http://localhost:3000/lei-seca`:
- Breadcrumb shows and updates as you scroll
- Ctrl+F opens search input
- Empty dropdown shows tree with TracingBeam
- Typing filters tree + shows API results
- Clicking a tree node navigates
- Expanding a Capítulo shows artigos
- Escape closes
- Mobile view (resize to < 640px) shows abbreviated breadcrumb

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: apply minimal design — accent #2c3338, text dimming, visual polish"
```

---

## Task 9: Keyboard navigation in dropdown (↑↓ + →← + Enter)

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumb.tsx`
- Modify: `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`

- [ ] **Step 1: Add `selectedIndex` state, keyboard handler, and `confirmSelection` ref to SearchBreadcrumb**

Add to SearchBreadcrumb:

```typescript
const [selectedIndex, setSelectedIndex] = useState(-1)
const confirmSelectionRef = useRef<(() => void) | null>(null)

// Reset selection when input changes
useEffect(() => setSelectedIndex(-1), [input])

// Keyboard handler for ↑↓ Enter →←
useEffect(() => {
  if (!open) return
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => prev + 1) // Dropdown clamps via onClampIndex
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(-1, prev - 1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      confirmSelectionRef.current?.()
    } else if (e.key === 'ArrowRight') {
      // Expand: handled by dropdown via expandSelectedRef
    } else if (e.key === 'ArrowLeft') {
      // Collapse: handled by dropdown via collapseSelectedRef
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [open, selectedIndex])
```

Pass to `SearchBreadcrumbDropdown`:
```tsx
<SearchBreadcrumbDropdown
  ...existing props...
  selectedIndex={selectedIndex}
  onClampIndex={setSelectedIndex}
  confirmSelectionRef={confirmSelectionRef}
/>
```

- [ ] **Step 2: Implement flat selectable items list and selection logic in Dropdown**

In `SearchBreadcrumbDropdown`, add:

```typescript
interface SelectableItem {
  type: 'tree-node' | 'search-hit'
  id: string
  path?: string          // for tree nodes
  posicao?: number       // for search hits
  artigoIndex?: number   // for artigo nodes
}

// Build flat list of all selectable items in render order
const selectableItems = useMemo<SelectableItem[]>(() => {
  const items: SelectableItem[] = []

  // Flatten visible tree nodes
  function flattenVisible(nodes: LeiTreeNode[]) {
    for (const node of nodes) {
      if (node.type === 'artigo') {
        items.push({ type: 'tree-node', id: node.id, artigoIndex: node.artigoIndex })
      } else {
        items.push({ type: 'tree-node', id: node.id, path: node.id })
        if (expandedSections.has(node.id) && node.children) {
          flattenVisible(node.children)
        }
      }
    }
  }
  flattenVisible(displayTree)

  // Add search hits
  hits.forEach((hit, i) => {
    items.push({ type: 'search-hit', id: `hit-${i}`, posicao: hit.dispositivo.posicao })
  })

  return items
}, [displayTree, expandedSections, hits])

// Clamp selectedIndex to valid range
useEffect(() => {
  if (selectedIndex >= selectableItems.length) {
    onClampIndex(Math.max(0, selectableItems.length - 1))
  }
}, [selectedIndex, selectableItems.length, onClampIndex])

// Register confirm handler
useEffect(() => {
  confirmSelectionRef.current = () => {
    const item = selectableItems[selectedIndex]
    if (!item) return
    if (item.type === 'search-hit' && item.posicao !== undefined) {
      onSelectHit(item.posicao)
    } else if (item.artigoIndex !== undefined) {
      onSelectArtigo(item.artigoIndex)
    } else if (item.path) {
      const posicao = resolvePathToPosicao(item.path, dispositivos)
      if (posicao !== null) onSelectHit(posicao)
    }
  }
}, [selectedIndex, selectableItems, onSelectHit, onSelectArtigo, dispositivos, confirmSelectionRef])
```

For highlighting: add `data-selected` attribute or compare index to apply `bg-[#f0f4ff]` on the selected item. Use `scrollIntoView({ block: 'nearest' })` on the selected element when `selectedIndex` changes.

- [ ] **Step 3: Test keyboard flow manually**

Open browser → Ctrl+F → ↓↓↓ → Enter should navigate. ↑ goes back. → expands tree node. ← collapses.

- [ ] **Step 4: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumb.tsx src/components/lei-seca/SearchBreadcrumbDropdown.tsx
git commit -m "feat: add keyboard navigation (↑↓ select, Enter navigate, →← expand/collapse)"
```

---

## Task 10: Mobile adaptations

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumb.tsx`
- Modify: `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`
- Modify: `src/components/lei-seca/LeiToolbar.tsx`

- [ ] **Step 1: Toolbar mobile — overflow menu for secondary controls**

In `LeiToolbar.tsx`, wrap Revogados, font size, and keyboard hints in a responsive container:
- `sm:flex hidden` for the secondary controls
- Add a `⋯` menu button visible only on `sm:hidden` that toggles a dropdown with these controls
- "Lei Seca ✓" → show as "LS" on small screens: `<span className="sm:hidden">LS</span><span className="hidden sm:inline">Lei Seca</span>`

- [ ] **Step 2: Mobile dropdown — full height, not floating**

In `SearchBreadcrumbDropdown.tsx`, the wrapper currently has `hidden sm:block` (desktop only). Add a mobile version:
- On `sm:` screens: existing absolute dropdown
- On small screens: `fixed inset-0 top-auto` or full-height below input (no overlay, replaces content)
- Footer: "toque para navegar · × para fechar"
- Larger touch targets: `py-[8px] px-[14px]` minimum

- [ ] **Step 3: Mobile breadcrumb abbreviation**

In `SearchBreadcrumb.tsx`, abbreviate labels on small screens:
- Use a helper: `"Título II"` → `"Tít. II"`, `"Capítulo I"` → `"Cap. I"` on mobile
- Hide Ctrl+F hint on mobile (already done with `hidden sm:inline`)
- Position counter: `45/341` (no spaces)

- [ ] **Step 4: Test on mobile viewport**

Resize browser to 375px width. Verify:
- Toolbar shows CTB + LS + ⋯
- Breadcrumb abbreviates
- Tapping breadcrumb opens full-height search
- Results are touch-friendly

- [ ] **Step 5: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumb.tsx src/components/lei-seca/SearchBreadcrumbDropdown.tsx src/components/lei-seca/LeiToolbar.tsx
git commit -m "feat: mobile adaptations — compact toolbar, abbreviated breadcrumb, full-height dropdown"
```

---

## Task 11: Final verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 2: Verify no remaining references to deleted files**

Run:
```bash
grep -r "UnifiedSearchBar\|LeiSecaSidebar\|LeiSearchBar" src/ --include="*.tsx" --include="*.ts"
```
Expected: No results

- [ ] **Step 3: Verify no unused imports**

Run: `npm run lint 2>&1 | grep "unused" | head -10`
Fix any unused imports.

- [ ] **Step 4: Manual smoke test checklist**

Open `http://localhost:3000/lei-seca` and verify:
- [ ] Breadcrumb shows current position and updates on scroll
- [ ] Ctrl+F opens search, Escape closes
- [ ] Empty search shows hierarchy tree with TracingBeam
- [ ] Clicking Capítulo expands to show artigos
- [ ] Clicking artigo scrolls to it
- [ ] Typing filters hierarchy + shows API results
- [ ] Clicking a search result scrolls to the dispositivo
- [ ] ↑↓ keyboard navigation works
- [ ] →← expand/collapse works
- [ ] Mobile layout works (375px)
- [ ] No console errors

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: final cleanup after searchbar redesign"
```
