# Lei Seca UX Features — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 UX features to the Lei Seca reader: lei seca toggle, busca, keyboard nav, reading progress, revogados toggle, copy with reference, font size control.

**Architecture:** Each feature is independent. Most are hooks + small UI components. State lives in localStorage or external stores (not context) to avoid re-renders. Toolbar component aggregates all toggles.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-virtuoso, urql (busca only)

**Spec:** `docs/superpowers/specs/2026-03-22-lei-seca-frontend-v2-design.md`

**Current state:**
- Context: `src/contexts/LeiSecaContext.tsx` — already has `leiSecaMode`, `toggleLeiSecaMode`, `showRevogados`, `toggleRevogados`
- Page: `src/views/LeiSecaPage.tsx` — DispositivoList with react-virtuoso
- Stores: `src/stores/activeArtigoStore.ts` — pattern for external stores
- Hooks: `src/hooks/useLeiApi.ts` — has `useBusca(termo, leiId)` ready
- DispositivoList: `src/components/lei-seca/dispositivos/DispositivoList.tsx` — virtuosoRef exposed

---

## File Structure

```
src/
├── components/lei-seca/
│   ├── LeiToolbar.tsx                    ← NEW: toolbar with all toggles + font size
│   ├── LeiSearchBar.tsx                  ← NEW: Ctrl+F search overlay
│   └── ReadingProgressBar.tsx            ← NEW: thin progress bar
├── hooks/
│   ├── useKeyboardNav.ts                 ← NEW: keyboard shortcuts
│   ├── useReadingProgress.ts             ← NEW: progress tracking + localStorage
│   └── useCopyWithReference.ts           ← NEW: copy handler
├── stores/
│   ├── readingProgressStore.ts           ← NEW: external store (no re-renders)
│   └── fontSizeStore.ts                  ← NEW: external store for font size
├── contexts/
│   └── LeiSecaContext.tsx                ← MODIFY: add fontSize, searchTerm
├── views/
│   └── LeiSecaPage.tsx                   ← MODIFY: wire toolbar, search, progress bar
└── components/lei-seca/dispositivos/
    └── DispositivoList.tsx               ← MODIFY: apply fontSize
```

---

## Task 1: LeiToolbar — Lei Seca toggle + Revogados toggle

**Files:**
- Create: `src/components/lei-seca/LeiToolbar.tsx`
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Create LeiToolbar.tsx**

```tsx
"use client"

import { useLeiSeca } from '@/contexts/LeiSecaContext'

export function LeiToolbar() {
  const { leiSecaMode, toggleLeiSecaMode, showRevogados, toggleRevogados } = useLeiSeca()

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#eee] bg-white font-[Outfit,sans-serif] text-[12px]">
      <button
        onClick={toggleLeiSecaMode}
        className={`px-3 py-1 rounded-full transition-colors ${
          leiSecaMode
            ? 'bg-[rgb(67,80,92)] text-white'
            : 'bg-[#f4f4f4] text-[#666] hover:bg-[#eee]'
        }`}
      >
        {leiSecaMode ? 'Lei Seca ✓' : 'Lei Seca'}
      </button>

      <button
        onClick={toggleRevogados}
        className={`px-3 py-1 rounded-full transition-colors ${
          showRevogados
            ? 'bg-[rgb(67,80,92)] text-white'
            : 'bg-[#f4f4f4] text-[#666] hover:bg-[#eee]'
        }`}
      >
        {showRevogados ? 'Revogados ✓' : 'Revogados'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add toolbar to LeiSecaPage**

Read `src/views/LeiSecaPage.tsx`. Add `import { LeiToolbar } from '@/components/lei-seca/LeiToolbar'`. Render `<LeiToolbar />` above the DispositivoList area, inside the flex column:

```tsx
<div className="h-full flex flex-col min-w-0 flex-1">
  <LeiToolbar />  {/* NEW */}
  <div className="flex-1 flex min-h-0">
    ...DispositivoList...
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/LeiToolbar.tsx src/views/LeiSecaPage.tsx
git commit -m "feat: add LeiToolbar with Lei Seca and Revogados toggles"
```

---

## Task 2: Font Size Control

**Files:**
- Create: `src/stores/fontSizeStore.ts`
- Modify: `src/components/lei-seca/LeiToolbar.tsx`
- Modify: `src/components/lei-seca/dispositivos/DispositivoList.tsx`

- [ ] **Step 1: Create fontSizeStore.ts**

```typescript
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lei-seca:font-size'
const DEFAULT_SIZE = 16
const MIN_SIZE = 13
const MAX_SIZE = 22

let fontSize = DEFAULT_SIZE
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) fontSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, parseInt(saved, 10)))
} catch {}

const listeners = new Set<() => void>()
function emit() { listeners.forEach(fn => fn()) }

export const fontSizeStore = {
  getSnapshot: () => fontSize,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  increase: () => {
    if (fontSize < MAX_SIZE) {
      fontSize += 1
      try { localStorage.setItem(STORAGE_KEY, String(fontSize)) } catch {}
      emit()
    }
  },
  decrease: () => {
    if (fontSize > MIN_SIZE) {
      fontSize -= 1
      try { localStorage.setItem(STORAGE_KEY, String(fontSize)) } catch {}
      emit()
    }
  },
  reset: () => {
    fontSize = DEFAULT_SIZE
    try { localStorage.setItem(STORAGE_KEY, String(fontSize)) } catch {}
    emit()
  },
}

export function useFontSize() {
  return useSyncExternalStore(fontSizeStore.subscribe, fontSizeStore.getSnapshot)
}
```

- [ ] **Step 2: Add A+/A- buttons to LeiToolbar**

Read `src/components/lei-seca/LeiToolbar.tsx`. Add import: `import { fontSizeStore, useFontSize } from '@/stores/fontSizeStore'`. Add buttons:

```tsx
const fontSize = useFontSize()

// In the toolbar div, add:
<div className="flex items-center gap-1 ml-auto">
  <button onClick={fontSizeStore.decrease} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#666] hover:bg-[#eee] flex items-center justify-center text-[11px] font-bold">A-</button>
  <span className="text-[11px] text-[#999] w-6 text-center">{fontSize}</span>
  <button onClick={fontSizeStore.increase} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#666] hover:bg-[#eee] flex items-center justify-center text-[13px] font-bold">A+</button>
</div>
```

- [ ] **Step 3: Apply fontSize to DispositivoList**

Read `src/components/lei-seca/dispositivos/DispositivoList.tsx`. Add import: `import { useFontSize } from '@/stores/fontSizeStore'`. Inside the component: `const fontSize = useFontSize()`. In the itemContent wrapper div, change `text-base` to dynamic:

```tsx
<div className="max-w-[820px] mx-auto px-5 font-[Literata,Georgia,serif] leading-[1.9] text-[rgb(67,80,92)]"
     style={{ fontSize: `${fontSize}px` }}>
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/fontSizeStore.ts src/components/lei-seca/LeiToolbar.tsx src/components/lei-seca/dispositivos/DispositivoList.tsx
git commit -m "feat: font size control (A+/A-) with localStorage persistence"
```

---

## Task 3: Keyboard Navigation

**Files:**
- Create: `src/hooks/useKeyboardNav.ts`
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Create useKeyboardNav.ts**

```typescript
import { useEffect, useCallback } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import type { Dispositivo } from '@/types/lei-api'

interface UseKeyboardNavOptions {
  dispositivos: Dispositivo[]
  virtuosoRef: React.RefObject<VirtuosoHandle | null>
  toggleLeiSecaMode: () => void
  toggleRevogados: () => void
}

export function useKeyboardNav({
  dispositivos,
  virtuosoRef,
  toggleLeiSecaMode,
  toggleRevogados,
}: UseKeyboardNavOptions) {

  const findNextArtigo = useCallback((currentIndex: number, direction: 1 | -1) => {
    let i = currentIndex + direction
    while (i >= 0 && i < dispositivos.length) {
      if (dispositivos[i].tipo === 'ARTIGO') return i
      i += direction
    }
    return -1
  }, [dispositivos])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // J — next artigo
      if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
        const current = activeArtigoStore.getSnapshot()
        const next = findNextArtigo(current, 1)
        if (next >= 0) {
          virtuosoRef.current?.scrollToIndex({ index: next, align: 'start', behavior: 'smooth' })
        }
      }

      // K — previous artigo
      if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
        const current = activeArtigoStore.getSnapshot()
        const prev = findNextArtigo(current, -1)
        if (prev >= 0) {
          virtuosoRef.current?.scrollToIndex({ index: prev, align: 'start', behavior: 'smooth' })
        }
      }

      // L — toggle lei seca mode
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        toggleLeiSecaMode()
      }

      // R — toggle revogados
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        toggleRevogados()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [findNextArtigo, virtuosoRef, toggleLeiSecaMode, toggleRevogados])
}
```

Note: needs `import { activeArtigoStore } from '@/stores/activeArtigoStore'` at the top.

- [ ] **Step 2: Wire into LeiSecaPage**

Read `src/views/LeiSecaPage.tsx`. Add import: `import { useKeyboardNav } from '@/hooks/useKeyboardNav'`. Call inside the component:

```tsx
useKeyboardNav({
  dispositivos,
  virtuosoRef,
  toggleLeiSecaMode: useLeiSeca().toggleLeiSecaMode,
  toggleRevogados: useLeiSeca().toggleRevogados,
})
```

Destructure `toggleLeiSecaMode` and `toggleRevogados` from the existing `useLeiSeca()` call.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useKeyboardNav.ts src/views/LeiSecaPage.tsx
git commit -m "feat: keyboard navigation (J/K artigos, L lei seca, R revogados)"
```

---

## Task 4: Busca with Ctrl+F

**Files:**
- Create: `src/components/lei-seca/LeiSearchBar.tsx`
- Modify: `src/hooks/useKeyboardNav.ts`
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Create LeiSearchBar.tsx**

```tsx
"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { useBusca } from '@/hooks/useLeiApi'
import type { BuscaHit } from '@/types/lei-api'

interface LeiSearchBarProps {
  leiId: string
  onClose: () => void
  onSelectHit: (posicao: number) => void
}

export function LeiSearchBar({ leiId, onClose, onSelectHit }: LeiSearchBarProps) {
  const [input, setInput] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounce 500ms
  const handleChange = useCallback((value: string) => {
    setInput(value)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedTerm(value), 500)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { hits, total, isSearching } = useBusca(debouncedTerm, leiId)

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-[#eee] shadow-sm">
      <div className="max-w-[820px] mx-auto px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[#999] text-sm">🔍</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleChange(e.target.value)}
            placeholder='Buscar na lei... (ex: "prisão preventiva" -fiança)'
            className="flex-1 text-sm outline-none text-[rgb(67,80,92)] placeholder:text-[#ccc]"
          />
          {isSearching && <span className="text-[#ccc] text-xs">buscando...</span>}
          {!isSearching && debouncedTerm.length >= 2 && (
            <span className="text-[#999] text-xs">{total} resultado{total !== 1 ? 's' : ''}</span>
          )}
          <button onClick={onClose} className="text-[#ccc] hover:text-[#888] text-sm">✕</button>
        </div>

        {hits.length > 0 && (
          <div className="mt-2 max-h-[240px] overflow-y-auto border-t border-[#f4f4f4] pt-2 space-y-1">
            {hits.map((hit, i) => (
              <button
                key={i}
                onClick={() => onSelectHit(hit.dispositivo.posicao)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f8f8f8] transition-colors"
              >
                <div
                  className="text-[13px] text-[rgb(67,80,92)] line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: hit.highlight }}
                />
                <div className="text-[11px] text-[#bbb] mt-0.5">{hit.lei.titulo}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Ctrl+F to useKeyboardNav**

Read `src/hooks/useKeyboardNav.ts`. Add a `setSearchOpen` callback to the options interface and add this handler inside the keydown listener:

```typescript
// Ctrl+F — open search (prevent browser default)
if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
  e.preventDefault()
  onToggleSearch()
}
```

Add `onToggleSearch: () => void` to the `UseKeyboardNavOptions` interface.

- [ ] **Step 3: Wire search into LeiSecaPage**

Read `src/views/LeiSecaPage.tsx`. Add search state and render:

```tsx
const [searchOpen, setSearchOpen] = useState(false)

// In useKeyboardNav call, add:
onToggleSearch: () => setSearchOpen(prev => !prev)

// In the JSX, above DispositivoList:
{searchOpen && (
  <LeiSearchBar
    leiId={currentLeiId}
    onClose={() => setSearchOpen(false)}
    onSelectHit={(posicao) => {
      const index = dispositivos.findIndex(d => d.posicao === posicao)
      if (index >= 0 && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index, align: 'start', behavior: 'smooth' })
        setSearchOpen(false)
      }
    }}
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/lei-seca/LeiSearchBar.tsx src/hooks/useKeyboardNav.ts src/views/LeiSecaPage.tsx
git commit -m "feat: Ctrl+F search with debounce 500ms and result navigation"
```

---

## Task 5: Reading Progress

**Files:**
- Create: `src/stores/readingProgressStore.ts`
- Create: `src/components/lei-seca/ReadingProgressBar.tsx`
- Create: `src/hooks/useReadingProgress.ts`
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Create readingProgressStore.ts**

```typescript
import { useSyncExternalStore } from 'react'

let progress = 0
let lastPosition: number | null = null
const listeners = new Set<() => void>()
function emit() { listeners.forEach(fn => fn()) }

export const readingProgressStore = {
  getSnapshot: () => progress,
  getPosition: () => lastPosition,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  set: (p: number, pos: number) => {
    progress = p
    lastPosition = pos
    emit()
  },
}

export function useReadingProgress() {
  return useSyncExternalStore(readingProgressStore.subscribe, readingProgressStore.getSnapshot)
}
```

- [ ] **Step 2: Create useReadingProgress.ts hook**

```typescript
import { useEffect, useCallback } from 'react'
import { readingProgressStore } from '@/stores/readingProgressStore'
import type { Dispositivo } from '@/types/lei-api'

const STORAGE_PREFIX = 'lei-seca:progress:'

export function useReadingProgressTracker(
  leiId: string,
  dispositivos: Dispositivo[],
  totalCount: number,
  activeIndex: number,
) {
  // Update store on scroll
  useEffect(() => {
    if (totalCount === 0) return
    const pct = Math.round((activeIndex / totalCount) * 100)
    const posicao = dispositivos[activeIndex]?.posicao ?? 0
    readingProgressStore.set(pct, posicao)

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_PREFIX + leiId, JSON.stringify({
        posicao,
        percentage: pct,
        timestamp: Date.now(),
      }))
    } catch {}
  }, [activeIndex, totalCount, leiId, dispositivos])

  // Load saved position on lei change
  const getSavedPosition = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + leiId)
      if (saved) return JSON.parse(saved) as { posicao: number; percentage: number; timestamp: number }
    } catch {}
    return null
  }, [leiId])

  return { getSavedPosition }
}
```

- [ ] **Step 3: Create ReadingProgressBar.tsx**

```tsx
"use client"

import { useReadingProgress } from '@/stores/readingProgressStore'

export function ReadingProgressBar() {
  const progress = useReadingProgress()

  return (
    <div className="h-[3px] bg-[#f4f4f4] w-full">
      <div
        className="h-full bg-[rgb(67,80,92)] transition-[width] duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire into LeiSecaPage**

Read `src/views/LeiSecaPage.tsx`. Add imports and wire:

```tsx
import { ReadingProgressBar } from '@/components/lei-seca/ReadingProgressBar'
import { useReadingProgressTracker } from '@/hooks/useReadingProgress'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'

// Inside component:
const activeIndex = useActiveArtigoIndex()
useReadingProgressTracker(currentLeiId, dispositivos, totalDispositivos, activeIndex)

// In JSX, below LeiToolbar:
<ReadingProgressBar />
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/readingProgressStore.ts src/hooks/useReadingProgress.ts src/components/lei-seca/ReadingProgressBar.tsx src/views/LeiSecaPage.tsx
git commit -m "feat: reading progress bar with localStorage persistence"
```

---

## Task 6: Copy with Reference

**Files:**
- Create: `src/hooks/useCopyWithReference.ts`
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Create useCopyWithReference.ts**

```typescript
import { useEffect } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import type { Lei } from '@/types/lei-api'

export function useCopyWithReference(
  dispositivos: Dispositivo[],
  currentLei: Lei | null,
) {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return

      // Find which dispositivo the selection is in
      const anchorNode = selection.anchorNode
      if (!anchorNode) return

      const dispositivoEl = (anchorNode as HTMLElement).closest?.('[data-posicao]')
        ?? (anchorNode.parentElement as HTMLElement)?.closest?.('[data-posicao]')

      if (!dispositivoEl) return

      const posicao = parseInt(dispositivoEl.getAttribute('data-posicao') ?? '', 10)
      const disp = dispositivos.find(d => d.posicao === posicao)

      if (!disp) return

      // Build reference string
      const leiName = currentLei?.apelido ?? currentLei?.titulo ?? ''
      let ref = ''
      if (disp.tipo === 'ARTIGO' && disp.numero) {
        ref = `Art. ${disp.numero}, ${leiName}`
      } else if (disp.tipo === 'PARAGRAFO' && disp.numero) {
        ref = `§ ${disp.numero}, ${leiName}`
      } else if (disp.numero) {
        ref = `${disp.numero}, ${leiName}`
      } else {
        ref = leiName
      }

      const selectedText = selection.toString()
      const textWithRef = `${selectedText}\n— ${ref}`

      e.preventDefault()
      e.clipboardData?.setData('text/plain', textWithRef)
    }

    document.addEventListener('copy', handler)
    return () => document.removeEventListener('copy', handler)
  }, [dispositivos, currentLei])
}
```

- [ ] **Step 2: Wire into LeiSecaPage**

Read `src/views/LeiSecaPage.tsx`. Add import and call:

```tsx
import { useCopyWithReference } from '@/hooks/useCopyWithReference'

// Inside component:
useCopyWithReference(dispositivos, currentLei)
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCopyWithReference.ts src/views/LeiSecaPage.tsx
git commit -m "feat: copy with reference appends Art. number + lei name"
```

---

## Task 7: Integration + Keyboard Shortcut Help

- [ ] **Step 1: Add keyboard shortcut hints to toolbar**

Read `src/components/lei-seca/LeiToolbar.tsx`. Add subtle hints:

```tsx
// After the font size controls, add:
<div className="text-[10px] text-[#ccc] ml-2 hidden sm:block">
  J/K navegar · L lei seca · R revogados · Ctrl+F buscar
</div>
```

- [ ] **Step 2: Test all features manually**

```bash
cd "/d/meta novo/Metav2" && npm run dev
```

Open `http://localhost:3000/lei-seca/decreto-lei-2848-1940` and verify:
1. Toolbar shows Lei Seca + Revogados toggles + A+/A- + shortcut hints
2. Clicking "Lei Seca" hides annotations
3. Clicking "Revogados" shows revoked items
4. A+/A- changes font size, persists on reload
5. J/K scrolls between artigos
6. L toggles lei seca mode
7. R toggles revogados
8. Ctrl+F opens search, debounces, shows results, click navigates
9. Esc closes search
10. Progress bar at top updates on scroll
11. Copy text → paste includes "— Art. 121, Código Penal"

- [ ] **Step 3: Verify build**

```bash
cd "/d/meta novo/Metav2" && npm run build
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete UX features (toolbar hints, integration test pass)"
```
