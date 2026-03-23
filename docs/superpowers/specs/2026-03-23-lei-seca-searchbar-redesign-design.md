# Lei Seca SearchBar Redesign — Spec

**Date:** 2026-03-23
**Status:** Approved
**Mockups:** `.superpowers/brainstorm/3421-1774293518/minimal-beautiful.html`

## Problem

The current `UnifiedSearchBar` (merged in `d2fdf15`) has structural issues:
1. Hierarchy clicks hardcoded to `posicao: 0` — navigation is broken
2. Keyboard navigation (↑↓) displays hints but is not implemented
3. Sidebar (`LeiSecaSidebar.tsx`) is now redundant — duplicates hierarchy search
4. Search bar lives in the toolbar, misaligned with the text column
5. No persistent position indicator after sidebar removal
6. `dangerouslySetInnerHTML` used without sanitization
7. Flat hierarchy list loses structural context (no visual nesting)

## Decision

**Hybrid approach: Breadcrumb/SearchBar unified component + TracingBeam hierarchy dropdown.**

- The sidebar is removed entirely
- A single component serves dual purpose: breadcrumb (closed) and search input (open)
- This component is **aligned with the text column** (same `max-width` wrapper), not in the toolbar
- The dropdown reuses existing `LeiTree` + `TracingBeam` components from `src/components/ui/`
- Capítulos are expandable: clicking reveals artigos as leaf nodes (resolved locally from loaded `dispositivos`)
- Mobile adapts with abbreviated breadcrumb and full-height dropdown

### Why not sidebar?
- 220px width cost (~25% on 1080p) vs 30px height for breadcrumb
- Users scroll sequentially 90% of the time (J/K navigation)
- The sidebar's real value is position awareness, which the breadcrumb provides

### Why not drawer?
- Closed: provides nothing. Open: same width cost as sidebar but jarring (content shifts)
- The dropdown IS the drawer, but better positioned (at the eye's focus point)

## Architecture

### New Components

```
src/components/lei-seca/
├── SearchBreadcrumb.tsx        ← NEW: unified breadcrumb/search component
└── SearchBreadcrumbDropdown.tsx ← NEW: dropdown with TracingBeam tree + results
```

### Removed Components

```
src/components/lei-seca/
├── UnifiedSearchBar.tsx         ← DELETE (replaced by SearchBreadcrumb)
├── LeiSecaSidebar.tsx           ← DELETE (redundant)
├── LeiSearchBar.tsx             ← DELETE (legacy, already unused)
```

### Modified Components

```
src/views/LeiSecaPage.tsx        ← Move search out of toolbar, into content area
src/components/lei-seca/LeiToolbar.tsx ← Remove search bar, keep controls only
```

## Component Design

### SearchBreadcrumb

Single component with two visual states controlled by `open` boolean.

**Closed state (breadcrumb):**
```
🔍  Título II  ›  Cap. I — Sinalização  ›  Art. 45          Ctrl+F    45 / 341
```
- Renders inside the same `max-width` wrapper as the law text
- SVG search icon (`stroke: #c8c8c8`, `stroke-width: 1.5`)
- Breadcrumb segments: `color: #c0c0c0`, `font-weight: 300`, `font-size: 11px`
- Active segment (current article): `color: #888`, `font-weight: 400`
- Position counter right-aligned: `color: #ddd`, `font-weight: 300`, tabular-nums
- Ctrl+F hint: `color: #ddd`, `font-size: 9px`, monospace, `background: #f8f8f8`
- Separator below: `height: 1px`, `background: linear-gradient(90deg, #f0f0f0, transparent)`
- Click anywhere → opens search
- Ctrl+F / Cmd+F → opens search and focuses input

**Open state (search input):**
```
🔍  [embriaguez                              ]  4 resultados  ×
├── dropdown ──────────────────────────────────────────────────┤
```
- SVG search icon becomes `stroke: #2c3338`, `stroke-width: 2`
- Input wrapper: `background: #fafafa`, `border: 1px solid #e8e8e8`, `border-radius: 10px 10px 0 0`
- Input text: `font-size: 12px`, `color: #333`, `font-family: Outfit`
- Result count: `font-size: 9px`, `color: #b0b0b0`, `font-weight: 300`
- Clear button: `color: #ccc`, hover → `background: #eee` (circle)
- Text behind dropdown: `opacity: 0.15` (desktop only)
- Escape → closes, clears input, returns to breadcrumb

### SearchBreadcrumbDropdown

Appears directly below the search input, same width.

**Empty input (hierarchy tree with TracingBeam):**

Section header: `font-size: 9px`, `color: #c0c0c0`, `uppercase`, `letter-spacing: 1.5px`, label "Navegação"

**Reuses existing components:**
- `<TracingBeam>` wraps `<LeiTree>` inside the dropdown scroll container
- `scrollContainerRef` points to the dropdown div (`max-height: 380px`, `overflow-y: auto`)
- `activeArtigoIndex` from `useActiveArtigoIndex()` drives the active dot position

**Tree data (LeiTreeNode[]):**
- Built from `currentLei.hierarquia` via existing `hierarquiaToTreeNodes()` from sidebar
- Structural nodes (Título, Capítulo, Seção) come from the API hierarchy
- **Artigo nodes injected on expand** (see "Expandable Articles" section below)

**Visual customization** via className overrides on LeiTree/TracingBeam to match the minimal design:
- Dot colors: active `#2c3338`, inactive `#ddd`
- Hover: `bg-[#f0f0f0]` rounded
- Current item: `bg-[#f0f4ff]`
- TracingBeam gradient colors adapted to `#2c3338` palette

Footer: `font-size: 10px`, `color: #d0d0d0`, `font-weight: 300`, "↑↓ navegar · → expandir · ← colapsar · ⏎ ir · esc fechar"

### Expandable Articles in Hierarchy

Capítulos/Seções show a chevron `›` (collapsed) / `˅` (expanded). Clicking expands to show artigos as leaf nodes.

**Data resolution (local, no API change):**
```typescript
function injectArtigosIntoTree(
  treeNodes: LeiTreeNode[],
  dispositivos: Dispositivo[],
  expandedIds: Set<string>
): LeiTreeNode[]
```

Strategy:
1. For each expanded Capítulo/Seção node, filter `dispositivos` where `d.path?.startsWith(node.id)` and `d.tipo === 'ARTIGO'`
2. Map matched dispositivos to `LeiTreeNode` with `type: 'artigo'`, `artigoIndex: dispositivos.indexOf(d)`, `label: "Art. {numero}"`, `preview: first 60 chars of texto`
3. Inject as `children` of the expanded node
4. Memoize with `useMemo` keyed on `expandedIds` + `dispositivos.length`

**Artigo leaf visual (via existing ArtigoNode in LeiTree):**
- Dot: 3px (smaller than section dots)
- Label: `font-size: 10.5px`, `font-weight: 300`, `color: #777`
- Optional subtitle: first words of `texto`, `color: #c8c8c8`
- Active artigo: highlighted with `bg-[#eef1ff]`, dot filled `#2c3338`
- Inner connecting line: `1px #efefef` (drawn by TracingBeam automatically)

**Keyboard:** `→` expands selected node, `←` collapses

**Limitation:** Only artigos already loaded via pagination appear. If a Capítulo's artigos haven't been fetched yet, show a subtle message "Carregue mais para ver artigos" or trigger `loadMore` automatically.

**With input (filtered hierarchy + full-text results):**

Two sections separated by a `1px #efefef` divider:

1. **Navegação** — hierarchy items matching the query, with highlight
   - Highlight: `background: linear-gradient(120deg, #fff8e1, #fff3c4)`, `padding: 1px 3px`, `border-radius: 2px`

2. **No texto** — API full-text results (`useBusca`)
   - Each result: Literata serif, `font-size: 12.5px`, `color: #4a5058`, `line-height: 1.6`
   - Article marker: `font-weight: 500`, `color: #2c3338`
   - Location breadcrumb below: `font-size: 9px`, `color: #c0c0c0`, `font-weight: 300`
   - Hover: `border-left: 2px solid #2c3338` appears (transition), `background: #f0f0f0`
   - Idle: `border-left: 2px solid transparent`

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Ctrl+F` / `Cmd+F` | Open search, focus input |
| `Escape` | Close search, return to breadcrumb |
| `↑` / `↓` | Move selection through results (both hierarchy and text results as one list) |
| `→` | Expand selected tree node (show artigos) |
| `←` | Collapse selected tree node (hide artigos) |
| `Enter` | Navigate to selected result (scroll Virtuoso) |
| Type text | Filter hierarchy + trigger debounced API search (500ms) |

Implementation: `selectedIndex` state, `ArrowUp`/`ArrowDown` increment/decrement, wraps around. Selected item gets `background: #f0f4ff`. Enter calls `onScrollToDispositivo(posicao)`.

## Breadcrumb Data Resolution

The breadcrumb needs to resolve: `activeArtigoIndex` → dispositivo → path → hierarchy segments.

```typescript
function resolveBreadcrumb(
  dispositivos: Dispositivo[],
  activeIndex: number,
  hierarquia: HierarquiaNode[]
): BreadcrumbSegment[]
```

Strategy:
1. Get current dispositivo from `dispositivos[activeIndex]`
2. Use `dispositivo.path` (e.g., `"titulo-ii/capitulo-i/art-45"`) to walk the hierarchy tree
3. Build segments array: `[{ label: "Título II", path: "titulo-ii" }, { label: "Cap. I — Sinalização", path: "titulo-ii/capitulo-i" }, { label: "Art. 45", path: "titulo-ii/capitulo-i/art-45" }]`

**Null path fallback:** `Dispositivo.path` can be `null`. When the active dispositivo has `path: null`, fall back to displaying just the dispositivo marker (e.g., "Art. {numero}") with no hierarchy segments. The breadcrumb becomes: `🔍 Art. 45  ·  45 / 341`.

Memoize with `useMemo` keyed on `activeIndex` + `hierarquia`.

## Hierarchy Click → Scroll Resolution

The current bug: all clicks call `handleSelectHit(0)`.

Fix: resolve hierarchy item `path` to a `posicao` by finding the first dispositivo whose `path` starts with the clicked node's path.

```typescript
function resolvePathToPosicao(
  path: string,
  dispositivos: Dispositivo[]
): number | null {
  const match = dispositivos.find(d => d.path?.startsWith(path))
  return match?.posicao ?? null
}
```

If the dispositivo isn't loaded yet (pagination), we need to either:
- Load all dispositivo paths upfront (lightweight query), or
- Accept that we can only scroll to already-loaded dispositivos and show a message

**Decision:** Accept limitation for now. If path not found in loaded dispositivos, show subtle toast "Carregue mais dispositivos para navegar até este ponto". This avoids a separate query and keeps the architecture simple.

## Toolbar Changes

The toolbar loses the search bar and becomes compact:

```
[CTB ▾]                                    [Lei Seca] [Revogados] [A- 16 A+] J/K·L·R
```

- Lei selector stays
- Toggles stay
- Font size controls stay
- Keyboard hints stay
- Search bar removed (moved to content area)
- The toolbar gains more breathing room

## Layout Structure

```tsx
// LeiSecaPage.tsx
<div className="h-full flex flex-col">
  <LeiToolbar />                          {/* full-width, no search */}
  <ReadingProgressBar />                  {/* full-width, 1px */}
  <div className="flex-1 flex min-h-0">
    <div className="flex-1 overflow-hidden bg-white">
      {/* Content column wrapper */}
      <div className="max-w-[700px] mx-auto px-6">
        <SearchBreadcrumb />              {/* aligned with text */}
      </div>
      <DispositivoList />                 {/* handles its own max-width */}
    </div>
    {companionOpen && <StudyCompanionPanel />}
    {commentsOpen && <LeiCommentsPanel />}
  </div>
</div>
```

Note: `SearchBreadcrumb` sits above the Virtuoso list but inside the same scroll-free container. The dropdown uses `position: absolute` with `z-index` to overlay the list.

**Prop threading:** `handleScrollToDispositivo` is passed directly from `LeiSecaPage` to `SearchBreadcrumb` (not through `LeiToolbar` anymore). `SearchBreadcrumb` also receives `dispositivos`, `currentLei`, and reads `activeArtigoIndex` from the external store.

**Reusing LeiTree + TracingBeam:** The dropdown reuses the existing `src/components/ui/lei-tree.tsx` and `src/components/ui/tracing-beam.tsx` components directly. `TracingBeam` needs its `scrollContainerRef` pointed at the dropdown's scroll container (`max-height: 380px`, `overflow-y: auto`) instead of the sidebar. `LeiTree` already supports `type: 'artigo'` nodes with `artigoIndex`, `onSelectArtigo`, and expand/collapse with `AnimatePresence`. No recreation needed — only wiring changes.

## Mobile Adaptations (< 640px)

### Toolbar
- Lei selector shows abbreviation (apelido only, e.g., "CTB")
- "Lei Seca ✓" → "LS"
- Revogados, A+/A-, keyboard hints → overflow menu `⋯`

### Breadcrumb
- Abbreviates: "Tít. II" instead of "Título II"
- Hides Ctrl+F hint (no keyboard on mobile)
- Position counter: compact "45/341"

### Dropdown
- Opens full-height below the input (not a floating overlay)
- No text dimming (dropdown replaces the text area)
- Footer: "toque para navegar · × para fechar"
- Larger touch targets: `padding: 8px 14px` minimum

### Search input
- `border-radius: 8px` (no connected dropdown look on mobile)
- `background: #f5f5f5`

## Visual Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `accent` | `#2c3338` | Active elements, filled dots, Lei Seca toggle, article markers |
| `text-primary` | `#3a3f44` | Law text body |
| `text-secondary` | `#4a5058` | Search result text |
| `text-ui` | `#444` | UI text (tree labels) |
| `text-muted` | `#888` | Active breadcrumb segment |
| `text-ghost` | `#c0c0c0` | Inactive breadcrumb, subtitles |
| `text-hint` | `#ddd` | Separators, hints, counters |
| `bg-hover` | `#f0f0f0` | Hover state for items |
| `bg-active` | `#f0f4ff` | Current position highlight |
| `bg-input` | `#fafafa` | Search input background |
| `highlight` | `linear-gradient(120deg, #fff8e1, #fff3c4)` | Search term highlight |
| `border-subtle` | `#e8e8e8` | Search input border |
| `border-separator` | `#f0f0f0` | Section dividers |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Law text | Literata | 15px | 400 |
| Article marker | Literata | 15px | 500 |
| Search input | Outfit | 12px | 400 |
| Tree level 0 | Outfit | 12px | 500 |
| Tree level 1 | Outfit | 11px | 400/300 |
| Breadcrumb | Outfit | 11px | 300 |
| Result location | Outfit | 9px | 300 |
| Section headers | Outfit | 9px | 400 |
| Hints/footer | Outfit | 10px | 300 |

### Spacing
- Content column: `max-width: 700px` (desktop), `padding: 0 32px`
- Mobile: `max-width: none`, `padding: 0 16px`
- Breadcrumb padding: `14px 0 12px` (desktop), `10px 0 8px` (mobile)
- Tree item padding: `7px 16px` (desktop), `8px 14px` (mobile touch targets)
- Dropdown max-height: `380px` (desktop), full remaining height (mobile)

### Animations
- Breadcrumb → Search transition: `transition: all 0.2s ease`
- Dropdown appear: no animation (instant, feels responsive)
- Hover effects: `transition: background 0.15s, border-color 0.15s`
- Text dim: `transition: opacity 0.2s`

## Sanitization

Replace `dangerouslySetInnerHTML` for local highlights with a React-based approach:

```typescript
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return <>{parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="...">{part}</mark>
      : part
  )}</>
}
```

API highlights (`hit.highlight`) come from `ts_headline` which uses `<b>` tags. These should be sanitized with a simple allowlist (`<b>` only) before rendering with `dangerouslySetInnerHTML`, or parsed into React elements.

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/lei-seca/SearchBreadcrumb.tsx` | CREATE | Unified breadcrumb/search component |
| `src/components/lei-seca/SearchBreadcrumbDropdown.tsx` | CREATE | Dropdown with TracingBeam + results |
| `src/views/LeiSecaPage.tsx` | MODIFY | Move search to content area, remove from toolbar |
| `src/components/lei-seca/LeiToolbar.tsx` | MODIFY | Remove search bar, simplify |
| `src/components/lei-seca/UnifiedSearchBar.tsx` | DELETE | Replaced by SearchBreadcrumb |
| `src/components/lei-seca/LeiSecaSidebar.tsx` | DELETE | Redundant |
| `src/components/lei-seca/LeiSearchBar.tsx` | DELETE | Legacy, unused |
| `src/components/AppSidebar.tsx` | MODIFY | Remove LeiSecaSidebar import/rendering (lei-seca panel branch → render null or remove) |

## Out of Scope

- Search history / recent searches
- Fuzzy / Levenshtein matching (API-side concern)
- Cross-lei search (current: single lei at a time)
- Virtualization of the dropdown (max 50 API results + hierarchy is bounded)
- Offline search capability
