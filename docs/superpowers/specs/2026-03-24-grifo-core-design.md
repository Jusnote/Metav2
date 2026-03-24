# Grifo Core — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Character-level text highlighting with colors, inline notes, popup interaction, Supabase persistence
**Sub-project:** 1 of 3 (Core → Painel+Navegação → Integrações)

## Problem Statement

Users need to highlight specific text passages in law articles with colors and optional notes for study. Current system only supports provision-level annotations (Cadernos) — no character-level highlighting exists. The system must handle text changes from law amendments gracefully, work on desktop and mobile, and persist to Supabase.

## Scope

**In scope (this spec):**
- Character-level grifo creation, editing, deletion
- 5 colors (yellow, green, blue, pink, orange)
- Floating popup for color selection
- Inline note below dispositivo
- Hybrid anchoring (offset + text fallback)
- Supabase persistence with optimistic updates
- Keyboard shortcuts
- Orphan detection when law text changes
- Cross-dispositivo selection handling
- Accessibility
- renderMark prop for custom mark rendering

**Out of scope (future sub-projects):**
- "Meus Grifos" panel, cross-lei view, tags, counters, progress bar indicators, revision mode, stats (Sub-project 2)
- AI actions on grifos, flashcard creation, share formatted (Sub-project 3)

## TypeScript Types

```typescript
type GrifoColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

interface Grifo {
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

interface CreateGrifoParams {
  lei_id: string
  dispositivo_id: string
  start_offset: number
  end_offset: number
  texto_grifado: string
  color: GrifoColor
}

interface GrifoSegment {
  text: string
  grifo?: Grifo
}
```

File: `src/types/grifo.ts`

## Schema

### Supabase table: `grifos`

```sql
CREATE TABLE grifos (
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

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_grifos_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER grifos_updated_at BEFORE UPDATE ON grifos
FOR EACH ROW EXECUTE FUNCTION update_grifos_updated_at();

CREATE INDEX idx_grifos_user_lei ON grifos(user_id, lei_id);
CREATE INDEX idx_grifos_dispositivo ON grifos(dispositivo_id);
CREATE INDEX idx_grifos_tags ON grifos USING GIN(tags);

ALTER TABLE grifos ENABLE ROW LEVEL SECURITY;
CREATE POLICY grifos_user_only ON grifos
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Field rationale

- `dispositivo_id`: TEXT matching `Dispositivo.id` from API. Allows grifos on any dispositivo type.
- `start_offset` / `end_offset`: Character position in **normalized** `Dispositivo.texto` (after `normalizeOrdinals()` — the text as rendered in the DOM, not the raw API text). This is critical because `getSelection()` operates on DOM text nodes which contain normalized text.
- `texto_grifado`: The exact selected string (from normalized text). Used as fallback when offsets desync after law text changes.
- `color`: Constrained enum. 5 values only.
- `tags`: TEXT[] with GIN index. Same pattern as `caderno_items.markers`. Populated in sub-project 2.
- `orphan`: Set to TRUE when anchoring fails. UI shows warning indicator.
- `updated_at`: Auto-updated via trigger. Used for overlap resolution (latest wins).

## Anchoring Strategy

### Important: Offsets reference normalized text

`DispositivoRenderer.tsx` applies `normalizeOrdinals()` to `Dispositivo.texto` before passing to child components (e.g., "§ 2 o " → "§ 2º "). This changes character positions and string length. Since `getSelection()` operates on the DOM (which contains normalized text), **all offsets and texto_grifado reference the normalized text**.

The anchoring module must normalize texto before computing or verifying offsets:
```typescript
const normalizedTexto = normalizeOrdinals(dispositivo.texto)
const isValid = normalizedTexto.slice(start_offset, end_offset) === texto_grifado
```

### Primary: Offset-based

Grifos are stored as `(dispositivo_id, start_offset, end_offset)` referencing character positions in the normalized texto.

### Fallback: Text-based (smart search)

When rendering, verify: `normalizedTexto.slice(start_offset, end_offset) === texto_grifado`.

If mismatch (law text was amended):
1. Find ALL occurrences of `texto_grifado` in `normalizedTexto`
2. If exactly 1 match → re-anchor at that position, update offsets in Supabase (background, debounced)
3. If multiple matches → pick the one closest to original `start_offset`, re-anchor, update
4. If zero matches → mark `orphan: true`, update in Supabase, render warning indicator

### Overlap resolution

When two grifos overlap on the same dispositivo:
- The grifo with the latest `updated_at` wins the overlapping character range
- During rendering, grifos are sorted by `start_offset`, then overlaps are resolved by splitting segments

Example:
```
Grifo A: offset 5-20, yellow, updated 10:00
Grifo B: offset 15-30, green,  updated 10:05

Rendered segments:
  [0-4]   plain
  [5-14]  yellow (A)
  [15-20] green  (B wins, newer)
  [21-30] green  (B)
  [31+]   plain
```

## Prerequisites: Add `data-id` to all dispositivo components

**CRITICAL:** Currently only `Artigo.tsx` has `data-id={item.id}`. The selection→offset algorithm requires `[data-id]` on every dispositivo container to identify which dispositivo contains the selection.

Add `data-id={item.id}` to:
- `Paragrafo.tsx` (currently only has `data-posicao`)
- `Inciso.tsx` (currently only has `data-posicao`)
- `Alinea.tsx` (currently only has `data-posicao`)
- `Pena.tsx` (currently only has `data-posicao`)
- `GenericDispositivo.tsx` (currently only has `data-posicao`)

## Selection → Grifo Conversion

### `getSelection()` → offset mapping

```
1. window.getSelection().getRangeAt(0)
2. Find ancestor element with [data-id] attribute (dispositivo container)
3. Walk text nodes from container start to range.startContainer using TreeWalker
4. Count characters to get start_offset relative to normalized Dispositivo.texto
5. Same for end_offset via range.endContainer + range.endOffset
6. Extract texto_grifado = selection.toString()
7. Validate: texto_grifado must be non-empty and len > 0
```

### Cross-dispositivo selection

When selection spans multiple dispositivos (user drags from Art. 121 into § 1º):
1. Find common ancestor of range.startContainer and range.endContainer
2. Use `querySelectorAll('[data-id]')` within common ancestor to collect all dispositivo containers between start and end
3. For each dispositivo, compute the portion of text selected within it (clamp range to container boundaries)
4. Create one grifo per dispositivo (same color, same timestamp)
5. All grifos created atomically (single Supabase batch insert via `createGrifosBatch`)

### Pena and GenericDispositivo

Grifos are supported on ALL dispositivo types including Pena and GenericDispositivo. They render plain text, so GrifoText integration is straightforward (same as Inciso/Alinea — no BoldPrefix involved).

### Word boundary snapping

Not applied. Users may want to highlight partial words. Exact selection boundaries are preserved.

## Rendering

### Component: `GrifoText`

New utility component that replaces raw text rendering in dispositivo components.

**Props:**
```typescript
interface GrifoTextProps {
  texto: string                    // normalized dispositivo text
  tipo?: string                    // dispositivo type (for BoldPrefix logic)
  grifos: Grifo[]                  // grifos for this dispositivo
  onGrifoClick: (grifo: Grifo, rect: DOMRect) => void
  renderMark?: (props: {           // optional custom mark renderer
    grifo: Grifo
    children: React.ReactNode
  }) => React.ReactNode
}
```

**Algorithm:**
1. Filter non-orphan grifos
2. Resolve anchoring (verify offsets against texto, fallback if needed)
3. Sort by `start_offset`
4. Resolve overlaps (latest `updated_at` wins per character range)
5. Build segments: `GrifoSegment[]`
6. For each segment:
   - Apply BoldPrefix logic if `tipo` is provided (compute prefix end offset from regex, wrap prefix portion in `<strong>` within the segment)
   - If segment has grifo: wrap in `<mark>` (or custom `renderMark`)
   - If segment is plain: render as text

**BoldPrefix integration algorithm:**
```
1. Match bold prefix regex for tipo (e.g., /^(Art\.\s*\d+[\-A-Z]*[\.\s]*)/ for ARTIGO)
2. prefixEnd = match[1].length (number of chars in the bold part)
3. For each segment at position [segStart, segEnd]:
   a. If segEnd <= prefixEnd: entire segment is bold
   b. If segStart >= prefixEnd: entire segment is normal
   c. If segStart < prefixEnd < segEnd: split into bold part + normal part
4. Wrap bold parts in <strong>, regardless of whether they're inside <mark> or not
```

**Default `<mark>` element:**
```html
<mark
  class="grifo grifo-yellow"
  data-grifo-id="uuid"
  aria-label="grifo amarelo"
  style="background: rgba(250,204,21,0.3); border-radius: 2px; padding: 1px 0; cursor: pointer;"
>
  highlighted text
</mark>
```

**Custom `renderMark` example:**
```tsx
<GrifoText
  texto={item.texto}
  tipo={item.tipo}
  grifos={grifosForItem}
  onGrifoClick={handleGrifoClick}
  renderMark={({ grifo, children }) => (
    <mark className={`grifo-${grifo.color}`} onClick={() => openPopup(grifo)}>
      {children}
      {grifo.note && <span className="grifo-note-dot" />}
    </mark>
  )}
/>
```

**Color map:**
```typescript
const GRIFO_COLORS: Record<GrifoColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.3)',
  green:  'rgba(74, 222, 128, 0.25)',
  blue:   'rgba(96, 165, 250, 0.25)',
  pink:   'rgba(244, 114, 182, 0.25)',
  orange: 'rgba(251, 146, 60, 0.25)',
}
```

### Orphan indicator

When a grifo is orphaned (text changed, can't re-anchor):
- Small ⚠️ icon in the margin of the dispositivo
- Tooltip: "Texto alterado por nova redação. Grifo original: '{texto_grifado}'"
- Orphaned grifos are hidden from the text (no phantom marks)
- In sub-project 2 "Meus Grifos" panel, orphans get a dedicated section for review/cleanup

### Interaction with Lei Seca mode

Grifos are **always visible** regardless of `leiSecaMode` toggle. Grifos are personal study marks, not legislative annotations. The toggle only hides `anotacoes` (legislative annotations like "Redação dada pela Lei nº...").

### Revoked dispositivos

When `showRevogados = false`, revoked dispositivos are hidden. Their grifos:
- Are NOT rendered (dispositivo is hidden)
- Persist in Supabase (not deleted)
- Reappear when toggle is turned on
- In sub-project 2 panel, shown with "dispositivo revogado" indicator

## Floating Popup

### Trigger

**Desktop:** `mouseup` event after text selection within a dispositivo
**Mobile:** `selectionchange` event after long-press selection

Both: validate that selection is non-empty and within a `[data-id]` container before showing popup.

### Positioning (via Floating UI)

Uses `@floating-ui/react` for robust positioning. Virtual element from selection rect:

```typescript
import { useFloating, flip, shift, offset, autoUpdate } from '@floating-ui/react'

// Virtual reference from selection
const virtualRef = {
  getBoundingClientRect: () => getSelection()!.getRangeAt(0).getBoundingClientRect()
}

const { refs, floatingStyles } = useFloating({
  placement: 'top',           // prefer above selection
  middleware: [
    offset(8),                // 8px gap from selection
    flip({ fallbackPlacements: ['bottom'] }),  // flip below if no space above
    shift({ padding: 8 }),    // clamp to viewport edges
  ],
  whileElementsMounted: autoUpdate,  // reposition on scroll/resize
})
```

This handles all edge cases automatically: mobile keyboard pushing content up, selection near viewport edges, scroll repositioning. No manual calculation needed.

### Content

```
┌─────────────────────────────────┐
│  ● ● ● ● ●   📝   ···         │
│  Y G B P O   note  more        │
└─────────────────────────────────┘
```

- 5 color circles. Last used color is slightly larger (14px vs 10px) and first in order.
- 📝 icon: create/edit inline note
- ··· icon: more actions menu
- Desktop: circles 24px tap target, gap 8px
- Mobile: circles 44px tap target, gap 12px

**"..." menu content:**
- **New grifo popup:** "Apagar grifo" (after grifo is created)
- **Editing existing grifo:** "Apagar grifo", "Adicionar tags" (deferred to sub-project 2, shows disabled with "Em breve")

### Visual style

Glass container matching SearchBreadcrumb design language:
- `background: rgba(255,255,255,0.9)` (solid enough, no blur needed)
- `border-radius: 10px`
- `border: 1px solid rgba(0,0,0,0.06)`
- `box-shadow: 0 4px 16px rgba(0,0,0,0.08)`
- Font: Outfit
- z-index: 60 (above SearchBreadcrumb dropdown at z-50)
- Positioned by `@floating-ui/react` with `flip` + `shift` + `offset(8)` middleware
- `useDismiss()` from Floating UI replaces manual click-outside/escape handlers

### Dependency: `@floating-ui/react`

Install: `npm install @floating-ui/react`

Used exclusively for GrifoPopup positioning. Provides:
- `useFloating()` — compute position from virtual reference (selection rect)
- `flip()` — auto-flip above/below when near viewport edge
- `shift()` — clamp horizontal position to viewport
- `offset()` — gap between selection and popup
- `autoUpdate` — reposition on scroll/resize
- `useDismiss()` — close on Escape/click-outside
- ~3KB gzipped, same lib used internally by Radix UI (already in dependency tree)

### Editing existing grifo

Click on a `<mark>` element:
1. Popup appears near the mark
2. Current color has a checkmark (✓)
3. Same layout: colors + note + "..."
4. Change color → instant update (optimistic)
5. "..." menu → "Apagar grifo"
6. Delete → grifo removed with 5-second undo toast

### Dismiss

- Click outside popup
- Press Escape
- Start new selection
- Scroll (debounced — dismiss after 200ms of continuous scroll)

## Inline Note

### Trigger

Click 📝 in popup (new grifo) or click 📝 on existing grifo.

### Rendering

Opens inline, directly below the dispositivo that contains the grifo:

```
Art. 121. Matar [alguem: marca-texto amarelo]...
┌─ nota ──────────────────────────────────┐
│ ▌ Placeholder: "Adicionar nota..."      │
│ ▌ [input text field]          [Salvar]  │
└─────────────────────────────────────────┘
§ 1º Se o agente comete...
```

### Visual style

- Glass container: `bg-[#fafcfb]`, `rounded-lg`, subtle shadow
- Left border: 3px in grifo color
- Font: Outfit 12px
- Input: auto-grow textarea, max-height 120px with scroll
- Buttons: "Salvar" (green) + "Cancelar" (ghost)
- Open/close with animation: height 0 → auto (CSS grid trick, same as LeiTree)
- Dismiss: Escape, click outside, or Cancelar

### Note indicator

After saving a note, the `<mark>` gets a small indicator:
- Tiny dot (4px) in the grifo color, positioned at the top-right corner of the first character
- Hover tooltip shows first 50 chars of the note
- Click opens the inline note editor

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1` | Grifo with yellow (requires active text selection) |
| `Alt+2` | Grifo with green (requires active text selection) |
| `Alt+3` | Grifo with blue (requires active text selection) |
| `Alt+4` | Grifo with pink (requires active text selection) |
| `Alt+5` | Grifo with orange (requires active text selection) |
| `Alt+H` | Grifo with last used color (requires active text selection) |
| `Delete` or `Backspace` | When popup is open, delete the grifo |
| `Escape` | Close popup / close note editor |

`Alt+1..5` instead of `Ctrl+1..5` to avoid conflict with browser tab switching shortcuts. Shortcuts only active on `/lei-seca` route and only fire when there's an active text selection within a `[data-id]` container.

## Data Flow & Hooks

### `useGrifos(leiId: string)`

```typescript
interface UseGrifosReturn {
  grifos: Grifo[]
  grifosByDispositivo: Map<string, Grifo[]>
  isLoading: boolean
  createGrifo: (params: CreateGrifoParams) => string      // returns tempId
  createGrifosBatch: (params: CreateGrifoParams[]) => string[]
  updateGrifo: (id: string, changes: Partial<Grifo>) => void
  deleteGrifo: (id: string) => void
  undoDelete: (id: string) => void
}
```

- Fetches all grifos for lei on mount: `SELECT * FROM grifos WHERE user_id = auth.uid() AND lei_id = $1`
- Indexes into `Map<dispositivo_id, Grifo[]>` for O(1) component lookup
- Optimistic updates for all mutations
- `createGrifo` generates `crypto.randomUUID()` as tempId, renders immediately, replaces with Supabase ID on response
- `deleteGrifo` marks as deleted locally, starts 5-second timer before sending DELETE to Supabase. `undoDelete` cancels the pending timer and restores local state. If DELETE already sent, `undoDelete` re-inserts the grifo.
- Debounced flush: mutations are batched and sent to Supabase every 500ms (not per-operation)
- **Flush on unload:** `beforeunload` event and route-change cleanup flush pending mutations immediately. `useGrifos` cleanup function calls `flushSync()` on unmount.

### Error handling for mutations

On Supabase mutation failure:
1. Revert optimistic update (remove grifo from local state if create failed, restore if delete failed)
2. Show error toast: "Erro ao salvar grifo. Tente novamente."
3. No automatic retry — user can redo the action

### `grifoPopupStore` (external store)

```typescript
interface GrifoPopupState {
  isOpen: boolean
  position: { x: number; y: number }
  placement: 'above' | 'below'
  dispositivo_id: string | null
  start_offset: number
  end_offset: number
  texto_grifado: string
  existingGrifo: Grifo | null  // non-null when editing
  lastColor: GrifoColor        // persisted to localStorage
}
```

Uses `useSyncExternalStore` pattern (same as `activeArtigoStore`, `annotationStore`). Prevents re-renders of the entire tree when popup state changes.

`lastColor` persisted to localStorage (`lei-seca:last-grifo-color`) so it survives page refreshes.

## Files

### New files

| File | Responsibility |
|------|---------------|
| `src/types/grifo.ts` | Grifo, GrifoColor, CreateGrifoParams, GrifoSegment types |
| `src/hooks/useGrifos.ts` | Supabase CRUD, cache, optimistic updates, debounced flush, flush on unload |
| `src/stores/grifoPopupStore.ts` | Popup state (position, selection, existing grifo) |
| `src/components/lei-seca/GrifoText.tsx` | Split text into segments, render `<mark>`, integrate BoldPrefix, renderMark prop |
| `src/components/lei-seca/GrifoPopup.tsx` | Floating popup with colors, note icon, more menu (positioned via @floating-ui/react) |
| `src/components/lei-seca/GrifoNoteInline.tsx` | Inline note editor below dispositivo |
| `src/lib/grifo-anchoring.ts` | Selection→offset conversion, offset verification, smart fallback search, orphan detection, cross-dispositivo split |

### Modified files

| File | Change |
|------|--------|
| `src/components/lei-seca/dispositivos/Artigo.tsx` | Replace `<BoldPrefix>` with `<GrifoText>`, keep `data-id` |
| `src/components/lei-seca/dispositivos/Paragrafo.tsx` | Add `data-id={item.id}`, replace text with `<GrifoText>` |
| `src/components/lei-seca/dispositivos/Inciso.tsx` | Add `data-id={item.id}`, replace text with `<GrifoText>` |
| `src/components/lei-seca/dispositivos/Alinea.tsx` | Add `data-id={item.id}`, replace text with `<GrifoText>` |
| `src/components/lei-seca/dispositivos/Pena.tsx` | Add `data-id={item.id}`, replace text with `<GrifoText>` |
| `src/components/lei-seca/dispositivos/GenericDispositivo.tsx` | Add `data-id={item.id}`, replace text with `<GrifoText>` |
| `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx` | Pass grifos from Map to each component |
| `src/views/LeiSecaPage.tsx` | Call `useGrifos(leiId)`, render `<GrifoPopup>`, register keyboard shortcuts, flush on route change |

## Performance

- **1 query per lei** on mount (all grifos for that lei, typically <500 rows)
- **Map indexing** O(m) once, then O(1) per dispositivo lookup
- **GrifoText segment calculation** memoized per dispositivo (recalc only when grifos or texto change)
- **Optimistic updates** — UI responds in <16ms, Supabase flush debounced 500ms
- **No re-render cascade** — grifoPopupStore is external store, popup open/close doesn't re-render dispositivo tree
- **content-visibility: auto** — compatible, React controls DOM so marks survive visibility changes

## Accessibility

- `<mark>` elements use `aria-label="grifo {color}"` for screen reader context
- Color choices in popup have `aria-label` with color name in Portuguese (amarelo, verde, azul, rosa, laranja)
- Popup is focusable with `role="toolbar"` and `aria-label="Opções de grifo"`
- Note editor has `aria-label="Nota do grifo"`
- Color contrast: intentionally low opacity for readability of underlying text. Accessibility path is via `aria-label` and `role="mark"`, not visual contrast.

## Testing

### Unit tests (`grifo-anchoring.ts`)

1. **Offset anchoring** — offset matches normalized texto → returns correct segments
2. **Fallback anchoring (single match)** — offset mismatch, texto_grifado found once → re-anchors
3. **Fallback anchoring (multiple matches)** — texto_grifado found 3x, picks closest to original offset
4. **Orphan detection** — texto_grifado not found → marks orphan
5. **Overlap resolution** — 2 grifos overlapping, latest updated_at wins
6. **Multiple grifos** — 3 non-overlapping grifos → correct segments (marked + plain)
7. **Cross-dispositivo split** — selection spanning 2 dispositivos → 2 separate grifo params
8. **Edge cases** — grifo at start of text, end of text, entire text, single character
9. **BoldPrefix boundary** — grifo spanning across bold prefix → correct `<strong>` + `<mark>` nesting
10. **Normalized text** — offsets computed against normalizeOrdinals output

### Integration tests (`useGrifos`)

1. **Create + read** — create grifo, verify it appears in grifosByDispositivo
2. **Optimistic update** — create grifo, verify mark renders before Supabase responds
3. **Delete + undo** — delete grifo, undo within 5s, verify restored
4. **Delete + undo after flush** — delete, wait >5s (DELETE sent), undo re-inserts
5. **Batch create** — cross-dispositivo creates multiple grifos atomically
6. **Debounced flush** — rapid creates batched into single Supabase call
7. **Error rollback** — Supabase failure reverts optimistic update
8. **Flush on unmount** — pending mutations sent on component unmount

## What Does NOT Change

- DispositivoList grouping/rendering logic
- content-visibility: auto behavior
- Keyboard navigation (J/K/L/R)
- SearchBreadcrumb / dropdown
- LeiToolbar toggles (except adding "Grifos" toggle visibility in sub-project 2)
- Copy with reference (useCopyWithReference)
- Cadernos system (separate, provision-level)
- API calls (useLeiApi hooks)
- normalizeOrdinals function (used as-is, offsets reference its output)

## Visual Reference

Grifo color mockup: `.superpowers/brainstorm/5252-1774376083/grifo-styles.html`
