# Grifo Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Character-level text highlighting with 5 colors, hybrid anchoring, floating popup, inline notes, Supabase persistence.

**Architecture:** 7 new files + 9 modified files. `grifo-anchoring.ts` handles selection→offset math and fallback/orphan logic (pure functions, testable). `useGrifos` hook manages Supabase CRUD with optimistic updates. `GrifoText` renders marks within dispositivo components. `GrifoPopup` uses @floating-ui/react for positioning. `grifoPopupStore` prevents re-render cascading.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, @floating-ui/react, Supabase, Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-24-grifo-core-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/grifo.ts` | Create | Types: Grifo, GrifoColor, CreateGrifoParams, GrifoSegment |
| `src/lib/grifo-anchoring.ts` | Create | Pure functions: buildSegments, resolveAnchoring, selectionToOffset, splitCrossDispositivo |
| `src/stores/grifoPopupStore.ts` | Create | External store for popup state (useSyncExternalStore) |
| `src/hooks/useGrifos.ts` | Create | Supabase CRUD, optimistic updates, debounced flush, stable Map refs |
| `src/components/lei-seca/GrifoText.tsx` | Create | Render texto with `<mark>` segments, integrate BoldPrefix, renderMark prop |
| `src/components/lei-seca/GrifoPopup.tsx` | Create | Floating popup with colors + note + more (via @floating-ui/react) |
| `src/components/lei-seca/GrifoNoteInline.tsx` | Create | Inline note editor below dispositivo |
| `src/components/lei-seca/dispositivos/Artigo.tsx` | Modify | Add `data-texto` wrapper, use GrifoText |
| `src/components/lei-seca/dispositivos/Paragrafo.tsx` | Modify | Add `data-id` + `data-texto` wrapper, use GrifoText |
| `src/components/lei-seca/dispositivos/Inciso.tsx` | Modify | Add `data-id` + `data-texto` wrapper, use GrifoText |
| `src/components/lei-seca/dispositivos/Alinea.tsx` | Modify | Add `data-id` + `data-texto` wrapper, use GrifoText |
| `src/components/lei-seca/dispositivos/Pena.tsx` | Modify | Add `data-id` + `data-texto` wrapper, use GrifoText |
| `src/components/lei-seca/dispositivos/GenericDispositivo.tsx` | Modify | Add `data-id` + `data-texto` wrapper, use GrifoText |
| `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx` | Modify | Pass grifos to each component |
| `src/views/LeiSecaPage.tsx` | Modify | Wire useGrifos, render GrifoPopup, keyboard shortcuts |
| `src/hooks/useCopyWithReference.ts` | Modify | Strip `<mark>` from HTML clipboard |
| `src/lib/lei-text-normalizer.ts` | Modify | Add immutability warning comment |

---

### Task 1: Types + install @floating-ui/react

**Files:**
- Create: `src/types/grifo.ts`
- Modify: `package.json`

- [ ] **Step 1: Install @floating-ui/react**

```bash
npm install @floating-ui/react
```

- [ ] **Step 2: Create grifo types**

Write `src/types/grifo.ts`:

```typescript
export type GrifoColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface Grifo {
  id: string
  user_id: string
  lei_id: string
  dispositivo_id: string
  start_offset: number
  end_offset: number
  texto_grifado: string
  color: GrifoColor
  note: string | null
  tags: string[]
  orphan: boolean
  created_at: string
  updated_at: string
}

export interface CreateGrifoParams {
  lei_id: string
  dispositivo_id: string
  start_offset: number
  end_offset: number
  texto_grifado: string
  color: GrifoColor
}

export interface GrifoSegment {
  text: string
  startOffset: number
  endOffset: number
  grifo?: Grifo
}

export const GRIFO_COLORS: Record<GrifoColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.3)',
  green:  'rgba(74, 222, 128, 0.25)',
  blue:   'rgba(96, 165, 250, 0.25)',
  pink:   'rgba(244, 114, 182, 0.25)',
  orange: 'rgba(251, 146, 60, 0.25)',
}

export const GRIFO_COLOR_NAMES: Record<GrifoColor, string> = {
  yellow: 'amarelo',
  green:  'verde',
  blue:   'azul',
  pink:   'rosa',
  orange: 'laranja',
}
```

- [ ] **Step 3: Add immutability warning to normalizeOrdinals**

Add comment at top of `src/lib/lei-text-normalizer.ts`, before the function:

```typescript
// WARNING: This function is immutable. Changing its behavior will invalidate
// all stored grifo offsets in Supabase. If you need to change normalization,
// write a migration to re-anchor existing grifos first.
```

- [ ] **Step 4: Commit**

```bash
git add src/types/grifo.ts src/lib/lei-text-normalizer.ts package.json package-lock.json
git commit -m "feat(grifo): add types, install @floating-ui/react, mark normalizeOrdinals immutable"
```

---

### Task 2: grifo-anchoring.ts (pure functions + tests)

Core anchoring logic. All pure functions — no React, no DOM, fully testable.

**Files:**
- Create: `src/lib/grifo-anchoring.ts`
- Create: `src/lib/__tests__/grifo-anchoring.test.ts`

- [ ] **Step 1: Create grifo-anchoring.ts**

Write `src/lib/grifo-anchoring.ts`:

```typescript
import type { Grifo, GrifoSegment } from '@/types/grifo'

/**
 * Verify a grifo's offset against current text.
 * Returns re-anchored offset or null (orphan).
 */
export function resolveAnchor(
  grifo: Grifo,
  normalizedTexto: string
): { start: number; end: number } | null {
  // Primary: offset matches
  const slice = normalizedTexto.slice(grifo.start_offset, grifo.end_offset)
  if (slice === grifo.texto_grifado) {
    return { start: grifo.start_offset, end: grifo.end_offset }
  }

  // Fallback: find all occurrences, pick closest to original offset
  const occurrences: number[] = []
  let idx = normalizedTexto.indexOf(grifo.texto_grifado)
  while (idx !== -1) {
    occurrences.push(idx)
    idx = normalizedTexto.indexOf(grifo.texto_grifado, idx + 1)
  }

  if (occurrences.length === 0) return null // orphan

  // Pick closest to original start_offset
  const closest = occurrences.reduce((best, cur) =>
    Math.abs(cur - grifo.start_offset) < Math.abs(best - grifo.start_offset) ? cur : best
  )

  return { start: closest, end: closest + grifo.texto_grifado.length }
}

/**
 * Build rendered segments from texto + grifos.
 * Handles anchoring, overlap resolution (latest updated_at wins), and orphan detection.
 * Returns segments + list of orphaned grifo IDs + list of re-anchored grifos (for Supabase update).
 */
export function buildSegments(
  normalizedTexto: string,
  grifos: Grifo[]
): {
  segments: GrifoSegment[]
  orphanIds: string[]
  reAnchored: Array<{ id: string; start_offset: number; end_offset: number }>
} {
  const orphanIds: string[] = []
  const reAnchored: Array<{ id: string; start_offset: number; end_offset: number }> = []

  // Resolve anchoring for each grifo
  type Anchored = { grifo: Grifo; start: number; end: number }
  const anchored: Anchored[] = []

  for (const grifo of grifos) {
    if (grifo.orphan) {
      orphanIds.push(grifo.id)
      continue
    }

    const anchor = resolveAnchor(grifo, normalizedTexto)
    if (!anchor) {
      orphanIds.push(grifo.id)
      continue
    }

    // Track if re-anchored
    if (anchor.start !== grifo.start_offset || anchor.end !== grifo.end_offset) {
      reAnchored.push({ id: grifo.id, start_offset: anchor.start, end_offset: anchor.end })
    }

    anchored.push({ grifo, start: anchor.start, end: anchor.end })
  }

  if (anchored.length === 0) {
    return {
      segments: [{ text: normalizedTexto, startOffset: 0, endOffset: normalizedTexto.length }],
      orphanIds,
      reAnchored,
    }
  }

  // Build character-level color map (latest updated_at wins overlaps)
  // Sort by updated_at ascending so later entries overwrite
  const sorted = [...anchored].sort(
    (a, b) => new Date(a.grifo.updated_at).getTime() - new Date(b.grifo.updated_at).getTime()
  )

  const charMap = new Array<Grifo | null>(normalizedTexto.length).fill(null)
  for (const { grifo, start, end } of sorted) {
    for (let i = start; i < end && i < normalizedTexto.length; i++) {
      charMap[i] = grifo
    }
  }

  // Collapse charMap into segments
  const segments: GrifoSegment[] = []
  let i = 0
  while (i < normalizedTexto.length) {
    const currentGrifo = charMap[i]
    let j = i + 1
    while (j < normalizedTexto.length && charMap[j] === currentGrifo) {
      j++
    }
    segments.push({
      text: normalizedTexto.slice(i, j),
      startOffset: i,
      endOffset: j,
      grifo: currentGrifo ?? undefined,
    })
    i = j
  }

  return { segments, orphanIds, reAnchored }
}

/**
 * Get the bold prefix end offset for a given dispositivo type.
 * Returns 0 if no prefix applies.
 */
export function getBoldPrefixEnd(texto: string, tipo: string): number {
  let match: RegExpMatchArray | null = null

  if (tipo === 'ARTIGO') {
    match = texto.match(/^(Art\.\s*\d+[\-A-Z]*[\.\s]*)/)
  } else if (tipo === 'PARAGRAFO' || tipo === 'CAPUT') {
    match = texto.match(/^(§\s*\d+[ºo°]?[\-A-Z]*[\s\.\-]*)/)
  } else if (tipo === 'INCISO') {
    match = texto.match(/^([IVXLCDM]+\s*[\-–—]\s*)/)
  } else if (tipo === 'ALINEA') {
    match = texto.match(/^([a-z]\)\s*)/)
  }

  return match ? match[1].length : 0
}
```

- [ ] **Step 2: Create tests**

Write `src/lib/__tests__/grifo-anchoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveAnchor, buildSegments, getBoldPrefixEnd } from '../grifo-anchoring'
import type { Grifo } from '@/types/grifo'

function makeGrifo(overrides: Partial<Grifo> = {}): Grifo {
  return {
    id: 'g1',
    user_id: 'u1',
    lei_id: 'lei1',
    dispositivo_id: 'd1',
    start_offset: 0,
    end_offset: 5,
    texto_grifado: 'hello',
    color: 'yellow',
    note: null,
    tags: [],
    orphan: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveAnchor', () => {
  it('returns original offsets when text matches', () => {
    const g = makeGrifo({ start_offset: 5, end_offset: 10, texto_grifado: 'world' })
    expect(resolveAnchor(g, 'hello world foo')).toEqual({ start: 5, end: 10 })
  })

  it('re-anchors when text moved (single match)', () => {
    const g = makeGrifo({ start_offset: 0, end_offset: 5, texto_grifado: 'world' })
    expect(resolveAnchor(g, 'new prefix world here')).toEqual({ start: 11, end: 16 })
  })

  it('re-anchors to closest when multiple matches', () => {
    const g = makeGrifo({ start_offset: 10, end_offset: 12, texto_grifado: 'de' })
    // "de" at indices 0, 8, 20
    const text = 'de abcde de abcde abcde'
    const result = resolveAnchor(g, text)
    expect(result).toEqual({ start: 8, end: 10 }) // closest to 10
  })

  it('returns null when texto_grifado not found (orphan)', () => {
    const g = makeGrifo({ texto_grifado: 'vanished' })
    expect(resolveAnchor(g, 'completely different text')).toBeNull()
  })
})

describe('buildSegments', () => {
  it('returns single plain segment when no grifos', () => {
    const { segments } = buildSegments('hello world', [])
    expect(segments).toEqual([{ text: 'hello world', startOffset: 0, endOffset: 11 }])
  })

  it('builds correct segments for single grifo', () => {
    const g = makeGrifo({ start_offset: 6, end_offset: 11, texto_grifado: 'world' })
    const { segments } = buildSegments('hello world', [g])
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({ text: 'hello ', startOffset: 0, endOffset: 6 })
    expect(segments[1]).toMatchObject({ text: 'world', startOffset: 6, endOffset: 11, grifo: g })
  })

  it('resolves overlap: latest updated_at wins', () => {
    const gA = makeGrifo({ id: 'a', start_offset: 5, end_offset: 20, texto_grifado: 'xxxxxxxxxxxxxxx', color: 'yellow', updated_at: '2026-01-01T10:00:00Z' })
    const gB = makeGrifo({ id: 'b', start_offset: 15, end_offset: 30, texto_grifado: 'xxxxxxxxxxxxxxx', color: 'green', updated_at: '2026-01-01T10:05:00Z' })
    const text = 'x'.repeat(35)
    const { segments } = buildSegments(text, [gA, gB])

    // [0-4] plain, [5-14] yellow, [15-29] green, [30-34] plain
    const grifoed = segments.filter(s => s.grifo)
    expect(grifoed[0].grifo?.color).toBe('yellow')
    expect(grifoed[0].startOffset).toBe(5)
    expect(grifoed[0].endOffset).toBe(15)
    expect(grifoed[1].grifo?.color).toBe('green')
    expect(grifoed[1].startOffset).toBe(15)
    expect(grifoed[1].endOffset).toBe(30)
  })

  it('detects orphans', () => {
    const g = makeGrifo({ texto_grifado: 'vanished' })
    const { segments, orphanIds } = buildSegments('different text', [g])
    expect(orphanIds).toContain('g1')
    expect(segments).toHaveLength(1) // just plain text
  })

  it('skips already-orphaned grifos', () => {
    const g = makeGrifo({ orphan: true })
    const { orphanIds } = buildSegments('any text', [g])
    expect(orphanIds).toContain('g1')
  })

  it('tracks re-anchored grifos', () => {
    const g = makeGrifo({ start_offset: 0, end_offset: 5, texto_grifado: 'world' })
    const { reAnchored } = buildSegments('hello world', [g])
    expect(reAnchored).toHaveLength(1)
    expect(reAnchored[0]).toEqual({ id: 'g1', start_offset: 6, end_offset: 11 })
  })

  it('handles multiple non-overlapping grifos', () => {
    const g1 = makeGrifo({ id: 'g1', start_offset: 0, end_offset: 5, texto_grifado: 'hello', color: 'yellow' })
    const g2 = makeGrifo({ id: 'g2', start_offset: 6, end_offset: 11, texto_grifado: 'world', color: 'blue' })
    const { segments } = buildSegments('hello world', [g1, g2])
    expect(segments).toHaveLength(3) // yellow, space, blue
  })

  it('handles grifo at start of text', () => {
    const g = makeGrifo({ start_offset: 0, end_offset: 3, texto_grifado: 'Art' })
    const { segments } = buildSegments('Art. 121.', [g])
    expect(segments[0]).toMatchObject({ text: 'Art', grifo: g })
  })

  it('handles grifo covering entire text', () => {
    const text = 'entire text'
    const g = makeGrifo({ start_offset: 0, end_offset: text.length, texto_grifado: text })
    const { segments } = buildSegments(text, [g])
    expect(segments).toHaveLength(1)
    expect(segments[0].grifo).toBe(g)
  })
})

describe('getBoldPrefixEnd', () => {
  it('detects ARTIGO prefix', () => {
    expect(getBoldPrefixEnd('Art. 121. Matar alguem', 'ARTIGO')).toBe(10)
  })

  it('detects PARAGRAFO prefix', () => {
    expect(getBoldPrefixEnd('§ 2º Se o homicídio', 'PARAGRAFO')).toBe(5)
  })

  it('detects INCISO prefix', () => {
    expect(getBoldPrefixEnd('IV — à traição', 'INCISO')).toBe(5)
  })

  it('detects ALINEA prefix', () => {
    expect(getBoldPrefixEnd('a) violência doméstica', 'ALINEA')).toBe(3)
  })

  it('returns 0 for PENA', () => {
    expect(getBoldPrefixEnd('Pena — reclusão', 'PENA')).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/__tests__/grifo-anchoring.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/grifo-anchoring.ts src/lib/__tests__/grifo-anchoring.test.ts
git commit -m "feat(grifo): anchoring logic with segments, overlap, orphan detection + tests"
```

---

### Task 3: grifoPopupStore (external store)

**Files:**
- Create: `src/stores/grifoPopupStore.ts`

- [ ] **Step 1: Create the store**

Write `src/stores/grifoPopupStore.ts` (follow `annotationStore.ts` pattern exactly):

```typescript
import { useSyncExternalStore } from 'react'
import type { Grifo, GrifoColor } from '@/types/grifo'

interface GrifoPopupState {
  isOpen: boolean
  dispositivoId: string | null
  startOffset: number
  endOffset: number
  textoGrifado: string
  existingGrifo: Grifo | null
  lastColor: GrifoColor
}

const STORAGE_KEY = 'lei-seca:last-grifo-color'

function loadLastColor(): GrifoColor {
  if (typeof window === 'undefined') return 'yellow'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && ['yellow', 'green', 'blue', 'pink', 'orange'].includes(stored)) {
    return stored as GrifoColor
  }
  return 'yellow'
}

let state: GrifoPopupState = {
  isOpen: false,
  dispositivoId: null,
  startOffset: 0,
  endOffset: 0,
  textoGrifado: '',
  existingGrifo: null,
  lastColor: loadLastColor(),
}

const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) listener()
}

export const grifoPopupStore = {
  getSnapshot(): GrifoPopupState {
    return state
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  openNew(params: {
    dispositivoId: string
    startOffset: number
    endOffset: number
    textoGrifado: string
  }) {
    state = { ...state, isOpen: true, existingGrifo: null, ...params }
    emitChange()
  },

  openExisting(grifo: Grifo) {
    state = {
      ...state,
      isOpen: true,
      dispositivoId: grifo.dispositivo_id,
      startOffset: grifo.start_offset,
      endOffset: grifo.end_offset,
      textoGrifado: grifo.texto_grifado,
      existingGrifo: grifo,
    }
    emitChange()
  },

  close() {
    if (!state.isOpen) return
    state = { ...state, isOpen: false, existingGrifo: null }
    emitChange()
  },

  setLastColor(color: GrifoColor) {
    state = { ...state, lastColor: color }
    localStorage.setItem(STORAGE_KEY, color)
    emitChange()
  },

  reset() {
    state = { ...state, isOpen: false, dispositivoId: null, existingGrifo: null }
    emitChange()
  },
}

export function useGrifoPopupState(): GrifoPopupState {
  return useSyncExternalStore(
    grifoPopupStore.subscribe,
    grifoPopupStore.getSnapshot,
    () => ({ ...state, isOpen: false }),
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/grifoPopupStore.ts
git commit -m "feat(grifo): popup external store (useSyncExternalStore pattern)"
```

---

### Task 4: useGrifos hook (Supabase CRUD + optimistic updates)

**Files:**
- Create: `src/hooks/useGrifos.ts`

- [ ] **Step 1: Create useGrifos hook**

Write `src/hooks/useGrifos.ts`:

```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Grifo, CreateGrifoParams } from '@/types/grifo'

interface UseGrifosReturn {
  grifos: Grifo[]
  grifosByDispositivo: Map<string, Grifo[]>
  isLoading: boolean
  createGrifo: (params: CreateGrifoParams) => string
  createGrifosBatch: (params: CreateGrifoParams[]) => string[]
  updateGrifo: (id: string, changes: Partial<Grifo>) => void
  deleteGrifo: (id: string) => void
  undoDelete: (id: string) => void
}

export function useGrifos(leiId: string | null): UseGrifosReturn {
  const [grifos, setGrifos] = useState<Grifo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Stable Map refs for memoization
  const mapCacheRef = useRef<Map<string, Grifo[]>>(new Map())
  const prevGrifosRef = useRef<Grifo[]>([])

  // Pending mutations queue (debounced flush)
  const pendingCreatesRef = useRef<Grifo[]>([])
  const pendingUpdatesRef = useRef<Map<string, Partial<Grifo>>>(new Map())
  const pendingDeletesRef = useRef<Map<string, { grifo: Grifo; timer: ReturnType<typeof setTimeout> }>>(new Map())
  const flushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Fetch all grifos for this lei
  const fetchGrifos = useCallback(async () => {
    if (!leiId) return
    setIsLoading(true)
    const { data, error } = await supabase
      .from('grifos')
      .select('*')
      .eq('lei_id', leiId)

    if (!error && data) {
      setGrifos(data as Grifo[])
    }
    setIsLoading(false)
  }, [leiId])

  useEffect(() => { fetchGrifos() }, [fetchGrifos])

  // Re-fetch on tab focus
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchGrifos()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchGrifos])

  // Build stable Map (only update arrays that changed)
  const grifosByDispositivo = useMemo(() => {
    const newMap = new Map<string, Grifo[]>()
    for (const g of grifos) {
      let arr = newMap.get(g.dispositivo_id)
      if (!arr) { arr = []; newMap.set(g.dispositivo_id, arr) }
      arr.push(g)
    }

    // Stabilize references
    const stableMap = new Map<string, Grifo[]>()
    for (const [key, arr] of newMap) {
      const cached = mapCacheRef.current.get(key)
      if (cached && cached.length === arr.length && cached.every((g, i) => g.id === arr[i].id && g.updated_at === arr[i].updated_at)) {
        stableMap.set(key, cached) // same reference
      } else {
        stableMap.set(key, arr) // new reference
      }
    }
    mapCacheRef.current = stableMap
    return stableMap
  }, [grifos])

  // Flush pending mutations to Supabase
  const flush = useCallback(async () => {
    // Creates
    const creates = pendingCreatesRef.current.splice(0)
    if (creates.length > 0) {
      const { data, error } = await supabase
        .from('grifos')
        .insert(creates.map(g => ({
          lei_id: g.lei_id,
          dispositivo_id: g.dispositivo_id,
          start_offset: g.start_offset,
          end_offset: g.end_offset,
          texto_grifado: g.texto_grifado,
          color: g.color,
          note: g.note,
        })))
        .select()

      if (error) {
        // Rollback: remove optimistic grifos
        const tempIds = new Set(creates.map(g => g.id))
        setGrifos(prev => prev.filter(g => !tempIds.has(g.id)))
      } else if (data) {
        // Replace temp IDs with real IDs
        setGrifos(prev => {
          const tempIds = new Set(creates.map(g => g.id))
          const withoutTemp = prev.filter(g => !tempIds.has(g.id))
          return [...withoutTemp, ...(data as Grifo[])]
        })
      }
    }

    // Updates
    const updates = new Map(pendingUpdatesRef.current)
    pendingUpdatesRef.current.clear()
    for (const [id, changes] of updates) {
      const { error } = await supabase.from('grifos').update(changes).eq('id', id)
      if (error) {
        // Rollback not critical for updates — refetch will fix
      }
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flush, 500)
  }, [flush])

  // Flush on unload (creates/updates only, NOT deletes)
  useEffect(() => {
    const handler = () => {
      // Cancel pending deletes (preserve grifos)
      for (const { timer } of pendingDeletesRef.current.values()) {
        clearTimeout(timer)
      }
      pendingDeletesRef.current.clear()
      // Flush creates/updates synchronously
      flush()
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      // Cleanup: flush on unmount too
      handler()
    }
  }, [flush])

  const createGrifo = useCallback((params: CreateGrifoParams): string => {
    const tempId = crypto.randomUUID()
    const now = new Date().toISOString()
    const grifo: Grifo = {
      id: tempId,
      user_id: '', // filled by Supabase
      ...params,
      note: null,
      tags: [],
      orphan: false,
      created_at: now,
      updated_at: now,
    }

    // Optimistic
    setGrifos(prev => [...prev, grifo])
    pendingCreatesRef.current.push(grifo)
    scheduleFlush()

    return tempId
  }, [scheduleFlush])

  const createGrifosBatch = useCallback((paramsList: CreateGrifoParams[]): string[] => {
    return paramsList.map(p => createGrifo(p))
  }, [createGrifo])

  const updateGrifo = useCallback((id: string, changes: Partial<Grifo>) => {
    // Optimistic
    setGrifos(prev => prev.map(g => g.id === id ? { ...g, ...changes, updated_at: new Date().toISOString() } : g))
    pendingUpdatesRef.current.set(id, changes)
    scheduleFlush()
  }, [scheduleFlush])

  const deleteGrifo = useCallback((id: string) => {
    const grifo = grifos.find(g => g.id === id)
    if (!grifo) return

    // Optimistic: hide immediately
    setGrifos(prev => prev.filter(g => g.id !== id))

    // Delayed actual delete (5s for undo)
    const timer = setTimeout(async () => {
      pendingDeletesRef.current.delete(id)
      await supabase.from('grifos').delete().eq('id', id)
    }, 5000)

    pendingDeletesRef.current.set(id, { grifo, timer })
  }, [grifos])

  const undoDelete = useCallback((id: string) => {
    const pending = pendingDeletesRef.current.get(id)
    if (pending) {
      clearTimeout(pending.timer)
      pendingDeletesRef.current.delete(id)
      setGrifos(prev => [...prev, pending.grifo])
    } else {
      // DELETE already sent, re-insert
      const grifo = prevGrifosRef.current.find(g => g.id === id)
      if (grifo) {
        supabase.from('grifos').insert(grifo).then(() => fetchGrifos())
      }
    }
  }, [fetchGrifos])

  // Track previous grifos for undo-after-delete
  useEffect(() => { prevGrifosRef.current = grifos }, [grifos])

  return {
    grifos,
    grifosByDispositivo,
    isLoading,
    createGrifo,
    createGrifosBatch,
    updateGrifo,
    deleteGrifo,
    undoDelete,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useGrifos.ts
git commit -m "feat(grifo): useGrifos hook with Supabase CRUD, optimistic updates, debounced flush"
```

---

### Task 5: GrifoText component

**Files:**
- Create: `src/components/lei-seca/GrifoText.tsx`

- [ ] **Step 1: Create GrifoText**

Write `src/components/lei-seca/GrifoText.tsx`:

```tsx
"use client"

import { useMemo, memo, useCallback, useRef } from 'react'
import type { Grifo, GrifoSegment, GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS, GRIFO_COLOR_NAMES } from '@/types/grifo'
import { buildSegments, getBoldPrefixEnd } from '@/lib/grifo-anchoring'

interface GrifoTextProps {
  texto: string
  tipo?: string
  grifos: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  renderMark?: (props: { grifo: Grifo; children: React.ReactNode }) => React.ReactNode
}

export const GrifoText = memo(function GrifoText({
  texto,
  tipo,
  grifos,
  onGrifoClick,
  renderMark,
}: GrifoTextProps) {
  const { segments } = useMemo(
    () => buildSegments(texto, grifos),
    [texto, grifos]
  )

  const boldEnd = useMemo(
    () => tipo ? getBoldPrefixEnd(texto, tipo) : 0,
    [texto, tipo]
  )

  const handleMarkClick = useCallback((grifo: Grifo, e: React.MouseEvent) => {
    if (!onGrifoClick) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onGrifoClick(grifo, rect)
  }, [onGrifoClick])

  return (
    <>
      {segments.map((seg, i) => {
        const content = renderSegmentContent(seg, boldEnd)

        if (seg.grifo) {
          if (renderMark) {
            return <span key={i}>{renderMark({ grifo: seg.grifo, children: content })}</span>
          }

          return (
            <mark
              key={i}
              className="grifo cursor-pointer rounded-sm"
              data-grifo-id={seg.grifo.id}
              aria-label={`grifo ${GRIFO_COLOR_NAMES[seg.grifo.color]}`}
              style={{
                background: GRIFO_COLORS[seg.grifo.color],
                padding: '1px 0',
              }}
              onClick={(e) => handleMarkClick(seg.grifo!, e)}
            >
              {content}
            </mark>
          )
        }

        return <span key={i}>{content}</span>
      })}
    </>
  )
})

/** Render segment content with BoldPrefix logic applied */
function renderSegmentContent(seg: GrifoSegment, boldEnd: number): React.ReactNode {
  if (boldEnd <= 0) return seg.text

  const segStart = seg.startOffset
  const segEnd = seg.endOffset

  // Entire segment is bold
  if (segEnd <= boldEnd) {
    return <strong>{seg.text}</strong>
  }

  // Entire segment is normal
  if (segStart >= boldEnd) {
    return seg.text
  }

  // Split: bold part + normal part
  const boldChars = boldEnd - segStart
  return (
    <>
      <strong>{seg.text.slice(0, boldChars)}</strong>
      {seg.text.slice(boldChars)}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/GrifoText.tsx
git commit -m "feat(grifo): GrifoText component with mark rendering and BoldPrefix integration"
```

---

### Task 6: Add `data-id` + `data-texto` to all dispositivo components + integrate GrifoText

**Files:**
- Modify: `src/components/lei-seca/dispositivos/Artigo.tsx`
- Modify: `src/components/lei-seca/dispositivos/Paragrafo.tsx`
- Modify: `src/components/lei-seca/dispositivos/Inciso.tsx`
- Modify: `src/components/lei-seca/dispositivos/Alinea.tsx`
- Modify: `src/components/lei-seca/dispositivos/Pena.tsx`
- Modify: `src/components/lei-seca/dispositivos/GenericDispositivo.tsx`
- Modify: `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx`

- [ ] **Step 1: Update Artigo.tsx**

Replace full content of `src/components/lei-seca/dispositivos/Artigo.tsx`:

```tsx
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface ArtigoProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Artigo({ item, leiSecaMode, grifos = [], onGrifoClick }: ArtigoProps) {
  return (
    <div className="mb-2" data-id={item.id} data-posicao={item.posicao}>
      <span data-texto>
        <GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} />
      </span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update Paragrafo.tsx**

Replace full content:

```tsx
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface ParagrafoProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Paragrafo({ item, leiSecaMode, grifos = [], onGrifoClick }: ParagrafoProps) {
  return (
    <div className="pl-[34px] mb-2 relative" data-id={item.id} data-posicao={item.posicao}>
      <span className="absolute left-[20px] text-[14px] text-[#d0d0d0]">›</span>
      <span data-texto>
        <GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} />
      </span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update Inciso.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface IncisoProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Inciso({ item, leiSecaMode, grifos = [], onGrifoClick }: IncisoProps) {
  return (
    <div className="pl-[58px] mb-1.5 relative" data-id={item.id} data-posicao={item.posicao}>
      <span className="absolute left-[44px] text-[13px] text-[#d8d8d8]">›</span>
      <span data-texto>
        <GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} />
      </span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update Alinea.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface AlineaProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Alinea({ item, leiSecaMode, grifos = [], onGrifoClick }: AlineaProps) {
  return (
    <div className="pl-[82px] mb-[5px] text-[#333] relative" data-id={item.id} data-posicao={item.posicao}>
      <span className="absolute left-[68px] text-[12px] text-[#e0e0e0]">›</span>
      <span data-texto>
        <GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} />
      </span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update Pena.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface PenaProps {
  item: Dispositivo
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Pena({ item, grifos = [], onGrifoClick }: PenaProps) {
  return (
    <div className="pl-[34px] font-light italic text-[#aaa] text-[15px] mb-2.5" data-id={item.id} data-posicao={item.posicao}>
      <span data-texto>
        <GrifoText texto={item.texto} grifos={grifos} onGrifoClick={onGrifoClick} />
      </span>
    </div>
  )
}
```

- [ ] **Step 6: Update GenericDispositivo.tsx**

```tsx
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface GenericDispositivoProps {
  item: Dispositivo
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function GenericDispositivo({ item, grifos = [], onGrifoClick }: GenericDispositivoProps) {
  return (
    <div className="pl-8 mb-0.5 text-[#666]" data-id={item.id} data-posicao={item.posicao}>
      <span data-texto>
        <GrifoText texto={item.texto} grifos={grifos} onGrifoClick={onGrifoClick} />
      </span>
    </div>
  )
}
```

- [ ] **Step 7: Update DispositivoRenderer.tsx to pass grifos**

Add imports and update the Props interface and component calls:

```tsx
import { useMemo } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { normalizeOrdinals } from '@/lib/lei-text-normalizer'
import { EstruturaHeader } from './EstruturaHeader'
import { Epigrafe } from './Epigrafe'
import { Artigo } from './Artigo'
import { Paragrafo } from './Paragrafo'
import { Inciso } from './Inciso'
import { Alinea } from './Alinea'
import { Pena } from './Pena'
import { RevogadoCollapsed } from './RevogadoCollapsed'
import { GenericDispositivo } from './GenericDispositivo'

const STRUCTURAL = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO', 'SUBTITULO']

interface Props {
  item: Dispositivo
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function DispositivoRenderer({ item: rawItem, leiSecaMode, showRevogados, grifos = [], onGrifoClick }: Props) {
  const item = useMemo<Dispositivo>(() => ({
    ...rawItem,
    texto: normalizeOrdinals(rawItem.texto),
    epigrafe: rawItem.epigrafe ? normalizeOrdinals(rawItem.epigrafe) : null,
    pena: rawItem.pena ? normalizeOrdinals(rawItem.pena) : null,
  }), [rawItem])

  if (item.tipo === 'EMENTA' || item.tipo === 'PREAMBULO') return null
  if (item.tipo === 'EPIGRAFE' && /^(ÍNDICE|índice|\.|[*])$/i.test(item.texto.trim())) return null

  if (item.revogado && !showRevogados) return <RevogadoCollapsed item={item} />

  if (STRUCTURAL.includes(item.tipo)) return <EstruturaHeader item={item} />
  if (item.tipo === 'EPIGRAFE') return <Epigrafe item={item} />
  if (item.tipo === 'ARTIGO') return <Artigo item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  if (item.tipo === 'PARAGRAFO' || item.tipo === 'CAPUT') return <Paragrafo item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  if (item.tipo === 'INCISO') return <Inciso item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  if (item.tipo === 'ALINEA') return <Alinea item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  if (item.tipo === 'PENA') return <Pena item={item} grifos={grifos} onGrifoClick={onGrifoClick} />

  return <GenericDispositivo item={item} grifos={grifos} onGrifoClick={onGrifoClick} />
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "(Artigo|Paragrafo|Inciso|Alinea|Pena|Generic|Renderer|GrifoText)" | head -10
```

- [ ] **Step 9: Commit**

```bash
git add src/components/lei-seca/dispositivos/
git commit -m "feat(grifo): integrate GrifoText into all dispositivo components with data-id + data-texto"
```

---

### Task 7: GrifoPopup (floating popup with @floating-ui/react)

**Files:**
- Create: `src/components/lei-seca/GrifoPopup.tsx`

- [ ] **Step 1: Create GrifoPopup**

Write `src/components/lei-seca/GrifoPopup.tsx`:

```tsx
"use client"

import { useRef, useCallback, useEffect, useState } from 'react'
import { useFloating, flip, shift, offset, autoUpdate, useDismiss, useInteractions, FloatingPortal } from '@floating-ui/react'
import { useGrifoPopupState, grifoPopupStore } from '@/stores/grifoPopupStore'
import type { GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS, GRIFO_COLOR_NAMES } from '@/types/grifo'

const COLOR_ORDER: GrifoColor[] = ['yellow', 'green', 'blue', 'pink', 'orange']

interface GrifoPopupProps {
  onCreateGrifo: (color: GrifoColor) => void
  onUpdateColor: (grifoId: string, color: GrifoColor) => void
  onDeleteGrifo: (grifoId: string) => void
  onOpenNote: () => void
}

export function GrifoPopup({ onCreateGrifo, onUpdateColor, onDeleteGrifo, onOpenNote }: GrifoPopupProps) {
  const popupState = useGrifoPopupState()
  const [showMore, setShowMore] = useState(false)
  const virtualRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => new DOMRect(),
  })

  // Update virtual reference when popup opens
  useEffect(() => {
    if (!popupState.isOpen) return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      virtualRef.current = {
        getBoundingClientRect: () => range.getBoundingClientRect(),
      }
    }
  }, [popupState.isOpen, popupState.dispositivoId])

  const { refs, floatingStyles, context } = useFloating({
    open: popupState.isOpen,
    onOpenChange: (open) => { if (!open) grifoPopupStore.close() },
    placement: 'top',
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['bottom'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: virtualRef.current as any,
    },
  })

  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
  })

  const { getFloatingProps } = useInteractions([dismiss])

  const handleColorClick = useCallback((color: GrifoColor) => {
    grifoPopupStore.setLastColor(color)
    if (popupState.existingGrifo) {
      onUpdateColor(popupState.existingGrifo.id, color)
    } else {
      onCreateGrifo(color)
    }
    grifoPopupStore.close()
  }, [popupState.existingGrifo, onCreateGrifo, onUpdateColor])

  const handleDelete = useCallback(() => {
    if (popupState.existingGrifo) {
      onDeleteGrifo(popupState.existingGrifo.id)
    }
    grifoPopupStore.close()
    setShowMore(false)
  }, [popupState.existingGrifo, onDeleteGrifo])

  const handleNote = useCallback(() => {
    onOpenNote()
    setShowMore(false)
  }, [onOpenNote])

  // Keyboard shortcuts for delete
  useEffect(() => {
    if (!popupState.isOpen) return
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && popupState.existingGrifo) {
        e.preventDefault()
        handleDelete()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [popupState.isOpen, popupState.existingGrifo, handleDelete])

  if (!popupState.isOpen) return null

  // Sort colors: last used first
  const sortedColors = [
    popupState.lastColor,
    ...COLOR_ORDER.filter(c => c !== popupState.lastColor),
  ]

  const isEditing = !!popupState.existingGrifo

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 60 }}
        {...getFloatingProps()}
        className="bg-white/90 rounded-[10px] border border-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.08)] font-[Outfit,sans-serif] select-none"
        role="toolbar"
        aria-label="Opções de grifo"
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Color circles */}
          {sortedColors.map((color, i) => {
            const isActive = isEditing && popupState.existingGrifo?.color === color
            const isFirst = i === 0
            const size = isFirst ? 'w-[18px] h-[18px] sm:w-[14px] sm:h-[14px]' : 'w-[14px] h-[14px] sm:w-[10px] sm:h-[10px]'
            return (
              <button
                key={color}
                onClick={() => handleColorClick(color)}
                className={`${size} rounded-full cursor-pointer transition-transform hover:scale-125 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center`}
                aria-label={GRIFO_COLOR_NAMES[color]}
                title={GRIFO_COLOR_NAMES[color]}
              >
                <div
                  className={`${size} rounded-full ${isActive ? 'ring-2 ring-offset-1 ring-black/20' : ''}`}
                  style={{ background: GRIFO_COLORS[color].replace(/[\d.]+\)$/, '0.7)') }}
                />
              </button>
            )
          })}

          {/* Divider */}
          <div className="w-px h-4 bg-black/[0.06] mx-1" />

          {/* Note button */}
          <button
            onClick={handleNote}
            className="text-[13px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
            aria-label="Adicionar nota"
            title="Nota"
          >
            📝
          </button>

          {/* More button */}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-[13px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
              aria-label="Mais opções"
              title="Mais"
            >
              ···
            </button>

            {/* More dropdown */}
            {showMore && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg border border-black/[0.06] shadow-lg py-1 min-w-[160px] z-10">
                {isEditing && (
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Apagar grifo
                  </button>
                )}
                <button
                  disabled
                  className="w-full text-left px-3 py-2 text-[12px] text-[#ccc] cursor-not-allowed"
                >
                  Adicionar tags — Em breve
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </FloatingPortal>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/GrifoPopup.tsx
git commit -m "feat(grifo): floating popup with colors, note, more menu via @floating-ui/react"
```

---

### Task 8: GrifoNoteInline component

**Files:**
- Create: `src/components/lei-seca/GrifoNoteInline.tsx`

- [ ] **Step 1: Create GrifoNoteInline**

Write `src/components/lei-seca/GrifoNoteInline.tsx`:

```tsx
"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import type { GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS } from '@/types/grifo'

interface GrifoNoteInlineProps {
  grifoId: string
  color: GrifoColor
  initialNote: string | null
  onSave: (grifoId: string, note: string) => void
  onCancel: () => void
}

export function GrifoNoteInline({ grifoId, color, initialNote, onSave, onCancel }: GrifoNoteInlineProps) {
  const [note, setNote] = useState(initialNote ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [note])

  const handleSave = useCallback(() => {
    onSave(grifoId, note.trim())
  }, [grifoId, note, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }, [onCancel, handleSave])

  const borderColor = GRIFO_COLORS[color].replace(/[\d.]+\)$/, '0.5)')

  return (
    <div
      className="grid transition-[grid-template-rows] duration-[120ms] ease-out"
      style={{ gridTemplateRows: '1fr' }}
    >
      <div className="overflow-hidden">
        <div
          className="bg-[#fafcfb] rounded-lg mt-1 mb-2 mx-1"
          style={{
            borderLeft: `3px solid ${borderColor}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
          aria-label="Nota do grifo"
        >
          <div className="p-3">
            <textarea
              ref={textareaRef}
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Adicionar nota..."
              className="w-full resize-none outline-none text-[12px] font-[Outfit,sans-serif] text-[#3a4a40] placeholder:text-[#b0c0b5] bg-transparent leading-[1.6] max-h-[120px]"
              rows={1}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-[11px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors font-[Outfit,sans-serif]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-[11px] text-white bg-[#16a34a] hover:bg-[#15803d] rounded-md transition-colors font-[Outfit,sans-serif]"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/GrifoNoteInline.tsx
git commit -m "feat(grifo): inline note editor below dispositivo"
```

---

### Task 9: Wire everything in LeiSecaPage + selection handler + keyboard shortcuts

**Files:**
- Modify: `src/views/LeiSecaPage.tsx`
- Modify: `src/components/lei-seca/dispositivos/DispositivoList.tsx`
- Modify: `src/hooks/useCopyWithReference.ts`

- [ ] **Step 1: Update DispositivoList to accept and pass grifos**

Add `grifosByDispositivo` and `onGrifoClick` props to `DispositivoList`. In the render, look up grifos per item and pass them to `DispositivoRenderer`:

```tsx
import { useMemo } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { DispositivoRenderer } from './DispositivoRenderer'
import { EstruturaBlock } from './EstruturaBlock'
import { useFontSize } from '@/stores/fontSizeStore'

const STRUCTURAL_TYPES = new Set(['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO', 'SUBTITULO'])

interface DispositivoListProps {
  dispositivos: Dispositivo[]
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifosByDispositivo?: Map<string, Grifo[]>
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

// ... groupItems function unchanged ...

export function DispositivoList({
  dispositivos,
  leiSecaMode,
  showRevogados,
  grifosByDispositivo,
  onGrifoClick,
}: DispositivoListProps) {
  const fontSize = useFontSize()
  const grouped = useMemo(() => groupItems(dispositivos), [dispositivos])

  return (
    <div
      className="max-w-[820px] mx-auto px-5 font-[Literata,Georgia,serif] leading-[1.9] text-[rgb(67,80,92)] text-justify"
      style={{ fontSize: `${fontSize}px` }}
    >
      {grouped.map(entry => {
        if (entry.type === 'structural-block') {
          return (
            <div key={entry.key} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 80px' }}>
              <EstruturaBlock items={entry.items} />
            </div>
          )
        }
        return (
          <div key={entry.key} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 50px' }}>
            <DispositivoRenderer
              item={entry.item}
              leiSecaMode={leiSecaMode}
              showRevogados={showRevogados}
              grifos={grifosByDispositivo?.get(entry.item.id) ?? []}
              onGrifoClick={onGrifoClick}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Update LeiSecaPage to wire useGrifos + GrifoPopup + selection handler + keyboard shortcuts**

Add imports and wire in `LeiSecaPage.tsx`. Key additions:

1. Import `useGrifos`, `GrifoPopup`, `GrifoNoteInline`, `grifoPopupStore`
2. Call `useGrifos(currentLeiId)`
3. Add `mouseup` selection handler with popup trigger guards
4. Add `Alt+1..5` keyboard shortcuts
5. Render `<GrifoPopup>` and pass callbacks
6. Pass `grifosByDispositivo` and `onGrifoClick` to `<DispositivoList>`

This is a significant modification. The key code to add after the existing hooks:

```typescript
import { useGrifos } from '@/hooks/useGrifos'
import { GrifoPopup } from '@/components/lei-seca/GrifoPopup'
import { grifoPopupStore } from '@/stores/grifoPopupStore'
import type { Grifo, GrifoColor } from '@/types/grifo'

// Inside the component, after useCopyWithReference:
const { grifosByDispositivo, createGrifo, updateGrifo, deleteGrifo, undoDelete } = useGrifos(currentLeiId)

// Selection handler
const lastScrollRef = useRef(0)
useEffect(() => {
  const scrollHandler = () => { lastScrollRef.current = Date.now() }
  window.addEventListener('scroll', scrollHandler, true)
  return () => window.removeEventListener('scroll', scrollHandler, true)
}, [])

useEffect(() => {
  const handler = () => {
    // Guard: no scroll in last 300ms
    if (Date.now() - lastScrollRef.current < 300) return

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return

    const text = sel.toString().trim()
    if (text.length <= 3) return

    // Guard: within a data-texto container
    const range = sel.getRangeAt(0)
    const textoEl = (range.startContainer as HTMLElement).closest?.('[data-texto]')
      ?? (range.startContainer.parentElement as HTMLElement)?.closest?.('[data-texto]')
    if (!textoEl) return

    const dispEl = textoEl.closest('[data-id]')
    if (!dispEl) return

    const dispositivoId = dispEl.getAttribute('data-id')!

    // Compute offset within data-texto container
    // (simplified — full TreeWalker in grifo-anchoring.ts)
    const textoContent = textoEl.textContent ?? ''
    const selText = sel.toString()
    const startIdx = textoContent.indexOf(selText)
    if (startIdx === -1) return

    grifoPopupStore.openNew({
      dispositivoId,
      startOffset: startIdx,
      endOffset: startIdx + selText.length,
      textoGrifado: selText,
    })
  }

  document.addEventListener('mouseup', handler)
  document.addEventListener('selectionchange', handler) // mobile
  return () => {
    document.removeEventListener('mouseup', handler)
    document.removeEventListener('selectionchange', handler)
  }
}, [])

// Keyboard shortcuts Alt+1..5
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (!e.altKey) return
    const colors: Record<string, GrifoColor> = { '1': 'yellow', '2': 'green', '3': 'blue', '4': 'pink', '5': 'orange' }
    const color = colors[e.key]
    if (!color) return

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.toString().trim().length <= 3) return

    e.preventDefault()
    // Trigger create via popup store + createGrifo
    // (reuses same logic as popup color click)
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [])

// Grifo click handler (open popup on existing mark)
const handleGrifoClick = useCallback((grifo: Grifo, rect: DOMRect) => {
  grifoPopupStore.openExisting(grifo)
}, [])

// Popup callbacks
const handleCreateGrifo = useCallback((color: GrifoColor) => {
  const s = grifoPopupStore.getSnapshot()
  if (!s.dispositivoId || !currentLeiId) return
  createGrifo({
    lei_id: currentLeiId,
    dispositivo_id: s.dispositivoId,
    start_offset: s.startOffset,
    end_offset: s.endOffset,
    texto_grifado: s.textoGrifado,
    color,
  })
}, [createGrifo, currentLeiId])

const handleUpdateColor = useCallback((id: string, color: GrifoColor) => {
  updateGrifo(id, { color })
}, [updateGrifo])

const handleDeleteGrifo = useCallback((id: string) => {
  deleteGrifo(id)
  // TODO: show undo toast
}, [deleteGrifo])
```

Then in the JSX, add `GrifoPopup` and pass props to `DispositivoList`:

```tsx
<DispositivoList
  dispositivos={dispositivos}
  leiSecaMode={leiSecaMode}
  showRevogados={showRevogados}
  grifosByDispositivo={grifosByDispositivo}
  onGrifoClick={handleGrifoClick}
/>
// ... after the main layout div:
<GrifoPopup
  onCreateGrifo={handleCreateGrifo}
  onUpdateColor={handleUpdateColor}
  onDeleteGrifo={handleDeleteGrifo}
  onOpenNote={() => { /* TODO: open inline note */ }}
/>
```

- [ ] **Step 3: Update useCopyWithReference to strip marks**

Add mark stripping in the copy handler, before setting clipboard data:

```typescript
// Strip grifo marks from selected HTML
const html = e.clipboardData?.getData('text/html') ?? ''
if (html) {
  const cleanHtml = html.replace(/<\/?mark[^>]*>/g, '')
  e.clipboardData?.setData('text/html', cleanHtml)
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "(LeiSecaPage|DispositivoList|useCopy|GrifoPopup)" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/views/LeiSecaPage.tsx src/components/lei-seca/dispositivos/DispositivoList.tsx src/hooks/useCopyWithReference.ts
git commit -m "feat(grifo): wire useGrifos, GrifoPopup, selection handler, keyboard shortcuts into LeiSecaPage"
```

---

### Task 10: Supabase migration + final testing

**Files:**
- Create: `scripts/supabase-grifos-migration.sql`

- [ ] **Step 1: Create migration SQL**

Write `scripts/supabase-grifos-migration.sql`:

```sql
-- Grifo Core: character-level text highlighting
-- Run this migration on the Hetzner PostgreSQL (Coolify) or Supabase dashboard

CREATE TABLE IF NOT EXISTS grifos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lei_id          TEXT NOT NULL,
  dispositivo_id  TEXT NOT NULL,
  start_offset    INT NOT NULL,
  end_offset      INT NOT NULL,
  texto_grifado   TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT 'yellow'
                  CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange')),
  note            TEXT,
  tags            TEXT[] DEFAULT '{}',
  orphan          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_grifos_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER grifos_updated_at BEFORE UPDATE ON grifos
FOR EACH ROW EXECUTE FUNCTION update_grifos_updated_at();

CREATE INDEX IF NOT EXISTS idx_grifos_user_lei ON grifos(user_id, lei_id);
CREATE INDEX IF NOT EXISTS idx_grifos_dispositivo ON grifos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_grifos_tags ON grifos USING GIN(tags);

ALTER TABLE grifos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY grifos_user_only ON grifos
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/lib/__tests__/grifo-anchoring.test.ts
```

- [ ] **Step 3: TypeScript full check**

```bash
npx tsc --noEmit 2>&1 | grep -E "(grifo|Grifo|GrifoText|GrifoPopup)" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add scripts/supabase-grifos-migration.sql
git commit -m "feat(grifo): Supabase migration with table, trigger, indexes, RLS"
```
