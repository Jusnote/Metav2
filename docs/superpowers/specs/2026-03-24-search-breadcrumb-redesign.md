# SearchBreadcrumb Redesign — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Full visual redesign of SearchBreadcrumb component (bar + dropdown), responsive desktop/mobile

## Problem Statement

The SearchBreadcrumb component works functionally (breadcrumb navigation, hierarchy tree, full-text search, keyboard nav) but has poor visual quality — flat gray styling, no container, weak hierarchy visualization. The dropdown hierarchy is flat and doesn't communicate depth or structure. Mobile has no strategy for deep hierarchies (up to 7 levels in Código Civil).

## Design Decisions

### Visual Language: Glass Morphism
- Translucent containers with `backdrop-filter: blur`
- Micro-shadows with `inset` highlight on top edge
- Green accent palette (#16a34a primary, #4ade80 highlight, rgba(22,163,74,*) for backgrounds)
- Font: Outfit (UI elements), Literata (search result text)
- All transitions 120-200ms for smooth feel

### Desktop: Connected Tree
- Hierarchy rendered as a graph with circles (7px) connected by vertical/horizontal lines (1.5px, rgba(22,163,74,0.1))
- Each node shows: circle → type label (uppercase, 8.5px) → name
- Type label mapping from `LeiTreeNode.type`:
  - `parte` → "Parte"
  - `livro` → "Livro"
  - `titulo` → "Tít"
  - `subtitulo` → "Subtít"
  - `capitulo` → "Cap"
  - `secao` → "Seç"
  - `subsecao` → "Subseç"
  - `artigo` → (no label, uses dot indicator)
- Active node: filled green circle with 3px ring shadow
- Path nodes (ancestors of active): green border, light green fill
- **Auto-expand active path:** When dropdown opens, compute active artigo's ancestor path and pre-populate `expandedSections` so the current position is always visible
- Artigo nodes: smaller dots (4px), current = green with font-weight 500
- Indent per level: 22px
- Expand/collapse via chevron or keyboard (→/←)

### Mobile: Drill-Down Navigation
- Shows only children of current level (no deep nesting)
- Mini-breadcrumb path bar at top: abbreviated segments with › separators, scrollable
- "← Parent Name" back button to navigate up
- Each child item: icon badge (28px, type abbreviation) + name + count ("3 seções · 12 artigos") + chevron
- Active item: green background tint + green border
- Artigos section at bottom with dot indicators
- Breakpoint: `sm:` (640px) — below = drill-down, above = connected tree
- **Keyboard navigation:** Does not apply to drill-down mode (mobile-only, touch interactions)
- **Search interaction on mobile:** When user types in input, drill-down switches to a flat filtered list (same as desktop tree filter behavior, but rendered as a simple list without nesting). Clearing the input returns to the drill-down view at the current drill level.
- **Active state:** DrillDownView reads `useActiveArtigoIndex()` directly (same pattern as LeiTree). On open, auto-drills to the level containing the active artigo.

### Breadcrumb Collapsed (Bar)

**Desktop:**
- Glass container: rgba(255,255,255,0.65), blur(12px), border-radius 10px
- Search icon (13px, #16a34a, opacity 0.5)
- Segments separated by dots (3px circles, #c5d4c9) — replaces existing › chevron separators
- Intermediate segments: 11.5px, #8a9a8f
- Active (last) segment: 11.5px, #3a5540, font-weight 500
- Right side: counter (10px, tabular-nums) + kbd badge (⌘F/Ctrl+F, monospace, glass background)
- Hover: opacity transition

**Mobile:**
- Same glass container, slightly tighter padding (8px 12px)
- Shows "..." + last 2 segments only when `segments.length > 2`; shows all segments when ≤ 2
- Counter without spaces: "233/615" (desktop keeps spaces: "233 / 615")
- No kbd badge (touch device)

### Search Input (Bar Open)

- Same glass container with focus ring: border-color rgba(22,163,74,0.2), box-shadow 0 0 0 3px rgba(22,163,74,0.06)
- Search icon: opacity bumps to 0.7
- Placeholder: "Buscar artigo, tema, palavra..." (desktop), "Buscar..." (mobile)
- Result count: "14 resultados" (9.5px, #9aaa9f)
- Clear button: × (14px, #b0c0b5, hover: background)
- "esc" hint when input empty
- Debounce: 500ms (existing behavior, unchanged)

### Dropdown Container

- Glass: rgba(255,255,255,0.78), border-radius 12px
- **Performance note:** Use `backdrop-filter: blur(12px)` on the static bar only. The scrollable dropdown uses solid `rgba(255,255,255,0.95)` instead of blur to avoid frame drops on mobile Safari. Add `will-change: transform` on the dropdown for compositing layer promotion.
- Shadow: 0 4px 24px rgba(0,0,0,0.06), 0 12px 48px rgba(0,0,0,0.04)
- Position: absolute, below bar, full width, z-50
- Max height: 380px desktop, 60vh mobile
- Overflow: scroll with thin scrollbar

### Dropdown Sections

**Section labels:** 9px, uppercase, letter-spacing 1.5px, #8a9a8f, with count suffix

**Navegação (hierarchy):**
- Desktop: Connected tree as described above
- Mobile: Drill-down as described above
- Filter: when input has text, filter tree nodes by label/sublabel match, auto-expand matching branches
- **Loading state:** When `hierarquia.length === 0` and dropdown opens, show a subtle pulsing skeleton (3 lines, 60%/40%/50% width, rgba(22,163,74,0.06) background, animate opacity). Distinguishes "loading" from "no hierarchy".

**No texto (full-text search):**
- Appears when input ≥ 2 chars and hits > 0
- Separated from hierarchy by 1px divider (rgba(22,163,74,0.06))
- Each hit: border-left 2px transparent → green on hover/select
- Text: Literata, 12.5px, line-clamp 2, `<mark>` highlights with rgba(74,222,128,0.25)
- Meta: Outfit, 9.5px, #a0b0a5 (lei name + artigo reference)
- Selected hit: green border-left + light green background

**Footer:**
- Desktop: keyboard hints (↑↓ navegar · → expandir · ← colapsar · ⏎ ir · esc)
- Mobile: "toque para navegar"
- Sticky bottom, border-top, translucent background

### Keyboard Navigation (unchanged behavior)
- ↑↓: move selection through flat list (tree nodes + search hits)
- →: expand selected tree node
- ←: collapse selected tree node
- Enter: navigate to selected item
- Esc: close dropdown, clear input
- Ctrl+F / ⌘F: open search

## Component Changes

### SearchBreadcrumb.tsx
- Replace inline Tailwind classes with glass design tokens
- Add ellipsis logic for mobile: show last 2 segments + "..."
- Desktop shows all segments with dot separators
- Kbd badge: glass background with monospace font
- Focus ring: green-tinted box-shadow

### SearchBreadcrumbDropdown.tsx
- Desktop (≥640px): Render existing LeiTree with connected tree styling (CSS changes to LeiTree or override classes)
- Mobile (<640px): New drill-down view component
  - State: `currentDrillPath: string[]` — tracks which node the user has drilled into
  - Mini-breadcrumb from currentDrillPath
  - Back button navigates up one level
  - Show children of current node + artigos of current node
  - Each item shows icon badge + name + child count + chevron
- Search results section: update styling to match glass design

### New: DrillDownView component (mobile only)
- Props: `hierarquia`, `dispositivos`, `input` (search term), `onSelectHit`, `onSelectArtigo`
- Internal state: `drillPath: string[]` — accumulated full paths matching `LeiTreeNode.id` format (unique, handles deduplication suffixes)
- Reads `useActiveArtigoIndex()` directly for active state (same pattern as LeiTree)
- On mount: auto-drills to level containing active artigo
- **When `input` is empty:** Renders drill-down view (path breadcrumb + back button + child items + artigos)
- **When `input` is non-empty:** Switches to flat filtered list (label/sublabel match), same rendering as search results
- Path breadcrumb: abbreviated segment names, scrollable container, `overflow-x: auto`
- Child items: icon (28px rounded square, type abbreviation) + name + count + chevron
- Artigos: dot + "Art. X — epigrafe" format
- Accessibility: `role="listbox"`, `aria-label="Navegação na hierarquia"` on root container

### LeiTree styling updates
- Add connected tree CSS: vertical lines, horizontal connectors, circles
- Type labels (Parte, Livro, Tít, Cap, Seç, Sub) from node.type
- Active node: filled circle with ring
- Path nodes: border-color green, background tint

### CSS tokens (add to component or shared)
```
--glass-bg: rgba(255,255,255,0.65)
--glass-bg-dropdown: rgba(255,255,255,0.78)
--glass-blur: 12px
--glass-blur-dropdown: 16px
--glass-border: rgba(255,255,255,0.5)
--glass-shadow: 0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02)
--glass-inset: inset 0 1px 0 rgba(255,255,255,0.6)
--accent: #16a34a
--accent-light: #4ade80
--accent-bg: rgba(22,163,74,0.06)
--accent-ring: 0 0 0 3px rgba(22,163,74,0.06)
--tree-line: rgba(22,163,74,0.1)
--text-primary: #3a5540
--text-secondary: #8a9a8f
--text-muted: #b0c0b5
```

## What Does NOT Change
- All existing keyboard navigation behavior
- Search debounce timing (500ms)
- API calls (useBusca, hierarchy resolution)
- Click-outside-to-close behavior
- Ctrl+F intercept
- activeArtigoStore integration
- Data flow between SearchBreadcrumb ↔ SearchBreadcrumbDropdown
- LeiTree expand/collapse state management

## Files Affected
1. `src/components/lei-seca/SearchBreadcrumb.tsx` — glass styling, ellipsis breadcrumb
2. `src/components/lei-seca/SearchBreadcrumbDropdown.tsx` — glass dropdown, responsive split (tree vs drill-down)
3. `src/components/lei-seca/DrillDownView.tsx` — NEW: mobile drill-down navigation
4. `src/components/ui/lei-tree.tsx` — connected tree styling (circles, lines, type labels)

## Visual Reference
Mockups in `.superpowers/brainstorm/4955-1774364172/design-final.html`
