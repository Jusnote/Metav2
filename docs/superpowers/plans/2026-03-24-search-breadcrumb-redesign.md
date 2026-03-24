# SearchBreadcrumb Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SearchBreadcrumb with glass morphism, connected tree (desktop), and drill-down navigation (mobile).

**Architecture:** Pure visual redesign with one new component (DrillDownView). The existing data flow, keyboard navigation, and API integration remain unchanged. LeiTree gets connected tree CSS; SearchBreadcrumb/Dropdown get glass styling; DrillDownView handles mobile drill-down UX. Responsive split at `sm:` (640px).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, framer-motion (existing), Outfit + Literata fonts (existing)

**Spec:** `docs/superpowers/specs/2026-03-24-search-breadcrumb-redesign.md`
**Mockups:** `.superpowers/brainstorm/4955-1774364172/design-final.html`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/ui/lei-tree.tsx` | Modify | Connected tree styling: circles, lines, type labels, active path highlight |
| `src/components/lei-seca/SearchBreadcrumb.tsx` | Modify | Glass bar (closed + open), ellipsis breadcrumb (mobile), dot separators |
| `src/components/lei-seca/SearchBreadcrumbDropdown.tsx` | Modify | Glass dropdown container, responsive split (tree vs drill-down), search results styling, auto-expand active path, skeleton loading |
| `src/components/lei-seca/DrillDownView.tsx` | Create | Mobile drill-down: path breadcrumb, back button, child items with icons, artigo list |
| `src/lib/lei-hierarchy.ts` | Modify | Add `resolveActivePathIds()` helper + shared `TYPE_LABELS` constant |

---

### Task 1: Add `resolveActivePathIds` to lei-hierarchy.ts

Utility to compute which tree node IDs need to be expanded to show the active artigo's position. Used by SearchBreadcrumbDropdown for auto-expand on open.

**Files:**
- Modify: `src/lib/lei-hierarchy.ts`

- [ ] **Step 1: Write `resolveActivePathIds` function**

Add at the end of `src/lib/lei-hierarchy.ts`:

```typescript
/**
 * Given the active artigo index, find all ancestor tree node IDs
 * that must be expanded to make the active artigo visible in the tree.
 * Returns a Set<string> of node IDs (accumulated paths).
 */
export function resolveActivePathIds(
  dispositivos: Dispositivo[],
  activeIndex: number,
  hierarquia: HierarquiaNode[]
): Set<string> {
  const ids = new Set<string>()
  const dispositivo = dispositivos[activeIndex]
  if (!dispositivo?.path) return ids

  function walk(nodes: HierarquiaNode[], parentPath: string) {
    for (const node of nodes) {
      const fullPath = parentPath ? `${parentPath}/${node.path}` : node.path
      if (dispositivo.path === fullPath || dispositivo.path!.startsWith(fullPath + '/')) {
        ids.add(fullPath)
        if (node.filhos?.length) {
          walk(node.filhos, fullPath)
        }
        return
      }
    }
  }
  walk(hierarquia, '')
  return ids
}
```

- [ ] **Step 2: Add shared TYPE_LABELS constant**

Add below `resolveActivePathIds`, also in `src/lib/lei-hierarchy.ts` (shared between LeiTree and DrillDownView):

```typescript
/** Mapping from LeiTreeNode.type to display label */
export const TYPE_LABELS: Record<string, string> = {
  parte: 'Parte',
  livro: 'Livro',
  titulo: 'Tít',
  subtitulo: 'Subtít',
  capitulo: 'Cap',
  secao: 'Seç',
  subsecao: 'Subseç',
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep lei-hierarchy`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/lei-hierarchy.ts
git commit -m "feat(lei-hierarchy): add resolveActivePathIds and shared TYPE_LABELS"
```

---

### Task 2: Restyle LeiTree as Connected Tree

Replace the current flat badge-based tree with connected tree visualization: circles, vertical/horizontal lines, type labels.

**Files:**
- Modify: `src/components/ui/lei-tree.tsx`

- [ ] **Step 1: Add type label mapping constant**

Add import at top of `lei-tree.tsx`:

```typescript
import { TYPE_LABELS } from '@/lib/lei-hierarchy'
```

- [ ] **Step 2: Add `activePath` prop to LeiTreeProps**

Update the `LeiTreeProps` type to accept the set of ancestor IDs to highlight:

```typescript
export type LeiTreeProps = {
  data: LeiTreeNode[];
  expanded?: Set<string>;
  activePath?: Set<string>;  // NEW: ancestor node IDs of active artigo
  onToggle?: (id: string) => void;
  onSelectArtigo?: (artigoIndex: number) => void;
  onAnimationStart?: () => void;
  onAnimationSettled?: () => void;
  hideChevrons?: boolean;
  className?: string;
};
```

Pass `activePath` through to `renderNodes`.

- [ ] **Step 3: Replace branch node rendering with connected tree styling**

Replace the branch node `<button>` inside `renderNodes` with:

```tsx
const isOnActivePath = activePath?.has(node.id)

return (
  <div key={node.id} className="relative" style={{ paddingLeft: level === 0 ? 0 : 22 }}>
    {/* Vertical line connecting to children */}
    {hasChildren && open && (
      <div
        className="absolute left-[6px] top-[18px] bottom-0 w-[1.5px]"
        style={{ background: 'rgba(22,163,74,0.1)', left: level === 0 ? 6 : 6 }}
      />
    )}
    <button
      data-tree-branch
      data-tree-level={level}
      onClick={() => handleToggle(node.id)}
      className="w-full flex items-center gap-[7px] py-1 px-2 text-left rounded-md transition-colors duration-120 hover:bg-[rgba(22,163,74,0.04)] relative"
    >
      {/* Horizontal connector line (not on root level) */}
      {level > 0 && (
        <div
          className="absolute w-[11px] h-[1.5px] top-1/2"
          style={{ background: 'rgba(22,163,74,0.1)', left: -16 }}
        />
      )}
      {/* Circle node indicator */}
      <div className={cn(
        "w-[7px] h-[7px] rounded-full border-[1.5px] shrink-0 transition-all duration-150",
        isOnActivePath
          ? "border-[#16a34a] bg-[rgba(22,163,74,0.1)]"
          : "border-[#b0c0b5] bg-white"
      )} />
      {/* Type label */}
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.5px] text-[#8a9a8f] shrink-0">
        {TYPE_LABELS[node.type] ?? node.type}
      </span>
      {/* Node name */}
      <span className={cn(
        "text-xs text-[#3a4a40] truncate",
        isOnActivePath && "text-[#16a34a] font-medium"
      )}>
        {node.sublabel || node.label}
      </span>
    </button>

    <AnimatePresence initial={false}>
      {hasChildren && open && (
        <motion.div
          key="children"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          onAnimationStart={onAnimationStart}
          onAnimationComplete={onAnimationSettled}
          className="overflow-hidden"
        >
          {renderNodes(node.children!, level + 1)}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)
```

- [ ] **Step 4: Replace ArtigoNode with connected tree dot styling**

Replace the ArtigoNode component styling. Key changes:
- Remove the badge/card layout
- Use a small dot (4px) instead of text label
- Green styling for active artigo with filled dot
- Connector line from parent

```tsx
const ArtigoNode = memo(function ArtigoNode({ node, level, onSelect }: {
  node: LeiTreeNode;
  level: number;
  onSelect?: (index: number) => void;
}) {
  const activeIndex = useActiveArtigoIndex();
  const isActive = node.artigoIndex === activeIndex;

  return (
    <div
      style={{ paddingLeft: level === 0 ? 0 : 22 }}
      data-artigo-index={node.artigoIndex}
      data-tree-level={level}
      className="relative"
    >
      <button
        onClick={() => node.artigoIndex !== undefined && onSelect?.(node.artigoIndex)}
        className={cn(
          "w-full flex items-center gap-[5px] py-[2px] px-2 text-left transition-all duration-120 text-[11px]",
          isActive
            ? "text-[#16a34a] font-medium"
            : "text-[#7a8a80] hover:text-[#3a5540]"
        )}
      >
        {/* Connector line */}
        {level > 0 && (
          <div
            className="absolute w-[7px] h-[1.5px] top-1/2"
            style={{ background: 'rgba(22,163,74,0.08)', left: -8 }}
          />
        )}
        {/* Dot */}
        <div className={cn(
          "w-1 h-1 rounded-full shrink-0",
          isActive ? "bg-[#4ade80]" : "bg-[#d5e4d9]"
        )} />
        <span className="truncate">{node.label}</span>
        {node.epigrafe && (
          <span className="text-[#9aaa9f] font-light truncate">— {node.epigrafe}</span>
        )}
      </button>
    </div>
  );
});
```

- [ ] **Step 5: Update `renderNodes` useCallback dependency array**

The `renderNodes` function references `activePath` from props. Add it to the dependency array — this is **critical** to avoid a stale closure bug:

```typescript
}, [isExpanded, handleToggle, onSelectArtigo, onAnimationStart, onAnimationSettled, hideChevrons, activePath]);
```

- [ ] **Step 6: Visual check in browser**

Run: `npm run dev`
Open: `http://localhost:3000/lei-seca`
Open the breadcrumb dropdown and verify:
- Circles render at each branch node
- Vertical/horizontal lines connect parent to children
- Type labels (Parte, Tít, Cap, etc.) show in uppercase
- Active artigo has green dot
- Expand/collapse still works with animation

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/lei-tree.tsx
git commit -m "feat(lei-tree): connected tree styling with circles, lines, type labels"
```

---

### Task 3: Restyle SearchBreadcrumb (Glass Bar)

Replace flat gray styling with glass morphism on both closed (breadcrumb) and open (search input) states.

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumb.tsx`

- [ ] **Step 1: Replace the closed breadcrumb button**

Replace the entire `{!open && (...)}` block (lines 162-198). Key changes:
- Glass container: `bg-white/65 backdrop-blur-[12px] rounded-[10px] border border-white/50 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.6)]`
- Green search icon (opacity 0.5)
- Dot separators (3px circles) instead of `›` chevrons
- Mobile ellipsis: show "..." + last 2 segments when `segments.length > 2`
- Kbd badge with glass background
- Counter: desktop `"121 / 615"`, mobile `"121/615"`

```tsx
{!open && (
  <button
    onClick={handleOpen}
    className="w-full flex items-center gap-2 py-2 px-[14px] cursor-pointer transition-opacity hover:opacity-80 bg-white/65 backdrop-blur-[12px] rounded-[10px] border border-white/50"
    style={{
      boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.6)',
    }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-50">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>

    {segments.length > 0 ? (
      <span className="flex items-center gap-2 min-w-0 overflow-hidden">
        {/* Desktop: all segments */}
        <span className="hidden sm:contents">
          {segments.map((seg, i) => (
            <span key={seg.path} className="flex items-center gap-2 shrink-0">
              {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-[#c5d4c9] shrink-0" />}
              <span className={`text-[11.5px] ${
                i === segments.length - 1 ? 'text-[#3a5540] font-medium' : 'text-[#8a9a8f]'
              }`}>
                {seg.label}
              </span>
            </span>
          ))}
        </span>
        {/* Mobile: ellipsis + last 2 */}
        <span className="sm:hidden contents">
          {segments.length > 2 && (
            <>
              <span className="text-[10.5px] text-[#b0c0b5]">...</span>
              <span className="w-[2.5px] h-[2.5px] rounded-full bg-[#c5d4c9] shrink-0" />
            </>
          )}
          {segments.slice(segments.length > 2 ? -2 : 0).map((seg, i) => (
            <span key={seg.path} className="flex items-center gap-2 shrink-0">
              {i > 0 && <span className="w-[2.5px] h-[2.5px] rounded-full bg-[#c5d4c9] shrink-0" />}
              <span className={`text-[10.5px] ${
                i === (segments.length > 2 ? 1 : segments.length - 1) ? 'text-[#3a5540] font-medium' : 'text-[#8a9a8f]'
              }`}>
                {abbreviateLabel(seg.label)}
              </span>
            </span>
          ))}
        </span>
      </span>
    ) : (
      <span className="text-[11.5px] text-[#8a9a8f] font-light">Buscar na lei...</span>
    )}

    <span className="ml-auto flex items-center gap-2 shrink-0 pl-3">
      <span className="text-[10px] text-[#9aaa9f] tabular-nums">
        <span className="hidden sm:inline">{activeIndex + 1} / {totalArtigos}</span>
        <span className="sm:hidden">{activeIndex + 1}/{totalArtigos}</span>
      </span>
      <span className="text-[9px] text-[#9aaa9f] bg-white/60 border border-black/[0.06] px-[6px] py-[1px] rounded font-mono hidden sm:inline">
        {typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.userAgent) ? '⌘F' : 'Ctrl+F'}
      </span>
    </span>
  </button>
)}
```

- [ ] **Step 2: Replace the open search input**

Replace the `{open && (...)}` block (lines 201-234). Key changes:
- Same glass container with green focus ring
- Green search icon (opacity 0.7)
- Responsive placeholder
- Green-themed result count and clear button

```tsx
{open && (
  <div
    className="flex items-center gap-2 py-2 px-[14px] bg-white/65 backdrop-blur-[12px] rounded-[10px] border border-[rgba(22,163,74,0.2)]"
    style={{
      boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 3px rgba(22,163,74,0.06)',
    }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-70">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
    {/* Two inputs for responsive placeholder (CSS-based, no JS resize listener) */}
    <input
      ref={inputRef}
      value={input}
      onChange={e => setInput(e.target.value)}
      placeholder="Buscar artigo, tema, palavra..."
      className="hidden sm:block flex-1 text-[12.5px] outline-none text-[#2a3a30] placeholder:text-[#a0b0a5] placeholder:font-light bg-transparent font-[Outfit,sans-serif] min-w-0"
    />
    <input
      ref={el => { if (el && !inputRef.current) (inputRef as React.MutableRefObject<HTMLInputElement>).current = el }}
      value={input}
      onChange={e => setInput(e.target.value)}
      placeholder="Buscar..."
      className="sm:hidden flex-1 text-[12.5px] outline-none text-[#2a3a30] placeholder:text-[#a0b0a5] placeholder:font-light bg-transparent font-[Outfit,sans-serif] min-w-0"
    />
    {hasInput && (
      <>
        {isSearching && <span className="text-[9.5px] text-[#9aaa9f] font-light shrink-0">buscando...</span>}
        {!isSearching && debouncedTerm.length >= 2 && (
          <span className="text-[9.5px] text-[#9aaa9f] font-light shrink-0">{total} resultado{total !== 1 ? 's' : ''}</span>
        )}
        <button
          onClick={handleClear}
          className="w-4 h-4 flex items-center justify-center text-[#b0c0b5] hover:bg-[rgba(22,163,74,0.06)] rounded-full text-[14px] shrink-0 transition-colors"
        >
          ×
        </button>
      </>
    )}
    {!hasInput && (
      <span className="text-[9px] text-[#b0c0b5] font-light shrink-0">esc</span>
    )}
  </div>
)}
```

- [ ] **Step 3: Remove the old separator line between states**

Remove the separator `<div className="h-px" .../>` (line 237). The glass containers have their own borders — the fade-out line is no longer needed.

- [ ] **Step 4: Visual check in browser**

Run dev server, open lei-seca page, verify:
- Closed bar shows glass container with green icon, dot separators, kbd badge
- Mobile (resize <640px) shows "..." + last 2 segments
- Click opens search with green focus ring
- Typing shows result count, × clear button
- ESC hint shows when input empty

- [ ] **Step 5: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumb.tsx
git commit -m "feat(search-breadcrumb): glass morphism bar with dot separators and mobile ellipsis"
```

---

### Task 4: Restyle SearchBreadcrumbDropdown (Glass Container + Search Results)

Update dropdown container styling and search result items. Desktop tree rendering stays (connected tree from Task 2). Mobile drill-down comes in Task 5.

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`

- [ ] **Step 1: Import `resolveActivePathIds` and compute active path**

Add import:
```typescript
import { hierarquiaToTreeNodes, injectArtigosIntoTree, resolvePathToPosicao, resolveActivePathIds } from '@/lib/lei-hierarchy'
```

After the `baseTree` memo, add:
```typescript
// Active path IDs for highlighting ancestors in the connected tree
const activePathIds = useMemo(
  () => resolveActivePathIds(dispositivos, activeIndex, hierarquia),
  [dispositivos, activeIndex, hierarquia]
)
```

- [ ] **Step 2: Auto-expand active path on mount**

Replace the initial `useState<Set<string>>(new Set())` for `expandedSections` with:

```typescript
const [expandedSections, setExpandedSections] = useState<Set<string>>(() =>
  resolveActivePathIds(dispositivos, activeIndex, hierarquia)
)
```

This pre-expands the tree to show the active artigo on open.

- [ ] **Step 3: Pass `activePath` to LeiTree**

Update the `<LeiTree>` call to include the new prop:

```tsx
<LeiTree
  data={displayTree}
  expanded={expandedSections}
  activePath={activePathIds}
  onToggle={handleToggle}
  onSelectArtigo={handleTreeSelect}
/>
```

- [ ] **Step 4: Replace outer dropdown container styling**

Replace the outer `<div>` container (line 269-272) with glass styling:

```tsx
<div className="absolute left-0 right-0 top-full z-50 mt-[6px]">
  <div
    ref={scrollRef}
    className="bg-white/95 rounded-xl border border-white/50 sm:max-h-[380px] max-h-[60vh] overflow-y-auto will-change-transform"
    style={{
      boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 12px 48px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)',
    }}
  >
```

- [ ] **Step 5: Update section labels to green theme**

Replace the "Navegação" label (line 275):
```tsx
<div className="px-4 pt-[10px] pb-1 text-[9px] text-[#8a9a8f] uppercase tracking-[1.5px] font-medium">
```

Replace the "No texto" label (line 306):
```tsx
<div className="px-4 pt-2 pb-1 text-[9px] text-[#8a9a8f] uppercase tracking-[1.5px] font-medium">
```

- [ ] **Step 6: Add skeleton loading state**

After the LeiTree render and before the "Nenhum item" message, add:

```tsx
{hierarquia.length === 0 && (
  <div className="px-4 py-3 space-y-2">
    <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '60%' }} />
    <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '40%' }} />
    <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '50%' }} />
  </div>
)}
```

- [ ] **Step 7: Update search result items to green theme**

Replace search hit button styling (lines 320-337):

```tsx
<button
  key={i}
  data-selectable-index={flatIndex}
  onClick={() => onSelectHit(hit.dispositivo.posicao)}
  className={`w-full text-left px-4 py-2 border-l-2 transition-all duration-150 ${
    isSelected
      ? 'border-l-[#16a34a] bg-[rgba(22,163,74,0.06)]'
      : 'border-transparent hover:border-l-[#16a34a] hover:bg-[rgba(22,163,74,0.04)]'
  }`}
>
  <div
    className="text-[12.5px] text-[#4a5a50] leading-[1.6] font-[Literata,Georgia,serif] line-clamp-2 [&_b]:font-semibold [&_b]:text-[#1a2a1f] [&_mark]:bg-[rgba(74,222,128,0.25)] [&_mark]:text-inherit [&_mark]:rounded-sm [&_mark]:px-[1px]"
    dangerouslySetInnerHTML={{ __html: sanitizeHighlight(hit.highlight) }}
  />
  <div className="text-[9.5px] text-[#a0b0a5] mt-[3px] font-light font-[Outfit,sans-serif]">
    {hit.lei.titulo}
  </div>
</button>
```

- [ ] **Step 8: Update divider to green theme**

Replace divider (line 300):
```tsx
<div className="h-px bg-[rgba(22,163,74,0.06)] mx-4 my-[6px]" />
```

- [ ] **Step 9: Update footer to green theme**

Replace footer (lines 351-358):
```tsx
<div className="px-4 py-[6px] border-t border-[rgba(22,163,74,0.06)] text-[10px] text-[#b0c0b5] font-light flex gap-[14px] sticky bottom-0 bg-white/95 rounded-b-xl">
  <span className="hidden sm:flex gap-[14px]">
    <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">↑</kbd><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded">↓</kbd> navegar</span>
    <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">→</kbd> expandir</span>
    <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">←</kbd> colapsar</span>
    <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">⏎</kbd> ir</span>
    <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded">esc</kbd></span>
  </span>
  <span className="sm:hidden">toque para navegar</span>
</div>
```

- [ ] **Step 10: Update keyboard highlight colors**

Replace the old blue highlight (line 261) with green:
```tsx
el.classList.add('ring-2', 'ring-[rgba(22,163,74,0.3)]', 'bg-[rgba(22,163,74,0.06)]', 'rounded-md')
// ...cleanup:
el?.classList.remove('ring-2', 'ring-[rgba(22,163,74,0.3)]', 'bg-[rgba(22,163,74,0.06)]', 'rounded-md')
```

- [ ] **Step 11: Visual check**

Open lei-seca, open search, verify:
- Glass dropdown with subtle shadow
- Skeleton shows briefly if hierarchy is loading
- Tree shows active path highlighted in green
- Tree auto-expands to active artigo on open
- Search results use green border-left + mark highlights
- Footer shows kbd badges with glass styling
- Keyboard nav highlights use green instead of blue

- [ ] **Step 12: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumbDropdown.tsx
git commit -m "feat(search-dropdown): glass container, green theme, auto-expand active path, skeleton loading"
```

---

### Task 5: Create DrillDownView (Mobile)

New component for mobile drill-down navigation. Shows one level at a time with path breadcrumb, back button, child items with icons, and artigo list.

**Files:**
- Create: `src/components/lei-seca/DrillDownView.tsx`

- [ ] **Step 1: Create the DrillDownView component**

Write the full component to `src/components/lei-seca/DrillDownView.tsx`:

```tsx
"use client"

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { hierarquiaToTreeNodes, injectArtigosIntoTree, TYPE_LABELS } from '@/lib/lei-hierarchy'
import type { LeiTreeNode } from '@/components/ui/lei-tree'
import type { HierarquiaNode, Dispositivo } from '@/types/lei-api'

const ABBREV_LABELS: Record<string, string> = {
  parte: 'Parte',
  livro: 'Livro',
  titulo: 'Tít.',
  subtitulo: 'Subtít.',
  capitulo: 'Cap.',
  secao: 'Seç.',
  subsecao: 'Sub.',
}

interface DrillDownViewProps {
  hierarquia: HierarquiaNode[]
  dispositivos: Dispositivo[]
  input: string
  onSelectHit: (posicao: number) => void
  onSelectArtigo: (artigoIndex: number) => void
}

/** Count children and artigos under a tree node */
function countChildren(node: LeiTreeNode): { sections: number; artigos: number } {
  let sections = 0
  let artigos = 0
  for (const child of node.children ?? []) {
    if (child.type === 'artigo') artigos++
    else sections++
  }
  return { sections, artigos }
}

/** Format count label like "3 seções · 12 artigos" */
function formatCount(node: LeiTreeNode, dispositivos: Dispositivo[]): string {
  const { sections } = countChildren(node)
  const cleanPath = node.id.replace(/--\d+$/, '')
  const artigoCount = dispositivos.filter(d => d.tipo === 'ARTIGO' && d.path === cleanPath).length
  const parts: string[] = []
  if (sections > 0) parts.push(`${sections} ${sections === 1 ? 'item' : 'itens'}`)
  if (artigoCount > 0) parts.push(`${artigoCount} art.`)
  return parts.join(' · ') || ''
}

/** Find the node at a given drill path in the tree */
function findNodeAtPath(tree: LeiTreeNode[], drillPath: string[]): LeiTreeNode | null {
  if (drillPath.length === 0) return null
  let current: LeiTreeNode | null = null
  let nodes = tree
  for (const id of drillPath) {
    current = nodes.find(n => n.id === id) ?? null
    if (!current) return null
    nodes = current.children ?? []
  }
  return current
}

/** Find drill path to the node containing the active artigo */
function findPathToActive(
  tree: LeiTreeNode[],
  dispositivos: Dispositivo[],
  activeIndex: number
): string[] {
  const dispositivo = dispositivos[activeIndex]
  if (!dispositivo?.path) return []

  const path: string[] = []
  function walk(nodes: LeiTreeNode[]): boolean {
    for (const node of nodes) {
      if (node.type === 'artigo') continue
      const cleanPath = node.id.replace(/--\d+$/, '')
      if (dispositivo.path === cleanPath || dispositivo.path!.startsWith(cleanPath + '/')) {
        path.push(node.id)
        if (node.children?.length) {
          walk(node.children)
        }
        return true
      }
    }
    return false
  }
  walk(tree)
  // Return path without last element (we want to SHOW the level containing the active, not drill past it)
  return path.length > 1 ? path.slice(0, -1) : []
}

/** Filter tree nodes by query (flat match, no nesting) */
function flatFilter(nodes: LeiTreeNode[], query: string): LeiTreeNode[] {
  const lower = query.toLowerCase()
  const results: LeiTreeNode[] = []
  function walk(items: LeiTreeNode[]) {
    for (const node of items) {
      if (node.type !== 'artigo') {
        if (node.label?.toLowerCase().includes(lower) || node.sublabel?.toLowerCase().includes(lower)) {
          results.push(node)
        }
      }
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return results
}

export function DrillDownView({
  hierarquia,
  dispositivos,
  input,
  onSelectHit,
  onSelectArtigo,
}: DrillDownViewProps) {
  const activeIndex = useActiveArtigoIndex()

  // Build tree with all sections expanded for counting
  const tree = useMemo(
    () => hierarquiaToTreeNodes(hierarquia),
    [hierarquia]
  )

  // Drill path: array of node IDs representing the current drill level
  const [drillPath, setDrillPath] = useState<string[]>(() =>
    findPathToActive(tree, dispositivos, activeIndex)
  )

  // Current node (null = root level)
  const currentNode = useMemo(
    () => findNodeAtPath(tree, drillPath),
    [tree, drillPath]
  )

  // Children to display at current level
  const children = useMemo(() => {
    if (!currentNode) return tree.filter(n => n.type !== 'artigo')
    return (currentNode.children ?? []).filter(n => n.type !== 'artigo')
  }, [currentNode, tree])

  // Artigos at current level
  const artigos = useMemo(() => {
    const targetPath = currentNode ? currentNode.id.replace(/--\d+$/, '') : null
    if (!targetPath) return []
    return dispositivos
      .map((d, i) => ({ ...d, _index: i }))
      .filter(d => d.tipo === 'ARTIGO' && d.path === targetPath)
  }, [currentNode, dispositivos])

  // Filtered results when searching
  const filteredNodes = useMemo(() => {
    if (!input) return null
    return flatFilter(tree, input)
  }, [tree, input])

  const handleDrill = useCallback((nodeId: string) => {
    setDrillPath(prev => [...prev, nodeId])
  }, [])

  const handleBack = useCallback(() => {
    setDrillPath(prev => prev.slice(0, -1))
  }, [])

  // When searching: show flat filtered list
  if (filteredNodes) {
    if (filteredNodes.length === 0) {
      return (
        <div className="px-3 py-4 text-center text-[11px] text-[#b0c0b5] font-light">
          Nenhum item na estrutura
        </div>
      )
    }
    return (
      <div role="listbox" aria-label="Navegação na hierarquia">
        {filteredNodes.map(node => (
          <button
            key={node.id}
            onClick={() => {
              const cleanPath = node.id.replace(/--\d+$/, '')
              const match = dispositivos.find(d => d.path === cleanPath || d.path?.startsWith(cleanPath + '/'))
              if (match) onSelectHit(match.posicao)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[rgba(22,163,74,0.04)] transition-colors"
          >
            <div className="w-7 h-7 rounded-[7px] bg-[rgba(22,163,74,0.06)] flex items-center justify-center text-[9px] font-semibold text-[#16a34a] shrink-0">
              {TYPE_LABELS[node.type] ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-[#3a4a40] truncate">{node.label}</div>
              {node.sublabel && (
                <div className="text-[10.5px] text-[#8a9a8f] font-light truncate">{node.sublabel}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Normal drill-down view
  return (
    <div role="listbox" aria-label="Navegação na hierarquia">
      {/* Path breadcrumb */}
      {drillPath.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 mx-[10px] mt-[6px] mb-1 bg-[rgba(22,163,74,0.04)] rounded-lg overflow-x-auto text-[10px] text-[#8a9a8f]" style={{ whiteSpace: 'nowrap' }}>
          {drillPath.map((id, i) => {
            const node = findNodeAtPath(tree, drillPath.slice(0, i + 1))
            if (!node) return null
            return (
              <span key={id} className="flex items-center gap-1">
                {i > 0 && <span className="text-[8px] text-[#c5d4c9]">›</span>}
                <span className={i === drillPath.length - 1 ? 'text-[#16a34a] font-medium' : ''}>
                  {ABBREV_LABELS[node.type] ?? ''} {node.label?.split(' — ')[0]?.split(' ').slice(-1)[0] ?? ''}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {/* Back button */}
      {drillPath.length > 0 && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-3 py-1 text-[10px] text-[#16a34a] font-medium"
        >
          ← {currentNode?.sublabel || currentNode?.label || 'Voltar'}
        </button>
      )}

      {/* Child items */}
      {children.map(node => {
        const count = formatCount(node, dispositivos)
        return (
          <button
            key={node.id}
            onClick={() => handleDrill(node.id)}
            className="w-full flex items-center gap-2 px-3 py-2 mx-[6px] rounded-lg text-left hover:bg-[rgba(22,163,74,0.03)] border border-transparent hover:border-[rgba(22,163,74,0.06)] transition-colors"
            style={{ width: 'calc(100% - 12px)' }}
          >
            <div className="w-7 h-7 rounded-[7px] bg-[rgba(22,163,74,0.06)] flex items-center justify-center text-[9px] font-semibold text-[#16a34a] shrink-0">
              {TYPE_LABELS[node.type] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[#3a4a40] truncate">
                {node.sublabel ? `${node.label} — ${node.sublabel}` : node.label}
              </div>
              {count && <div className="text-[9px] text-[#a0b0a5] mt-[1px]">{count}</div>}
            </div>
            <span className="text-[12px] text-[#c5d4c9] shrink-0">›</span>
          </button>
        )
      })}

      {/* Artigos at this level */}
      {artigos.length > 0 && (
        <>
          {children.length > 0 && (
            <div className="h-px bg-[rgba(22,163,74,0.06)] mx-3 my-[6px]" />
          )}
          <div className="text-[9px] text-[#8a9a8f] uppercase tracking-[1px] font-medium px-3 pb-1">
            Artigos
          </div>
          {artigos.map(d => {
            const isActive = d._index === activeIndex
            return (
              <button
                key={d.id}
                onClick={() => onSelectArtigo(d._index)}
                className={`w-full flex items-center gap-[6px] px-3 py-[6px] mx-[6px] rounded-md text-left transition-colors text-[11.5px] ${
                  isActive
                    ? 'text-[#16a34a] font-medium bg-[rgba(22,163,74,0.06)]'
                    : 'text-[#5a6a60] hover:bg-[rgba(22,163,74,0.03)]'
                }`}
                style={{ width: 'calc(100% - 12px)' }}
              >
                <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${isActive ? 'bg-[#4ade80]' : 'bg-[#d0dcd4]'}`} />
                Art. {d.numero ?? '?'}
                {d.epigrafe && <span className="text-[#9aaa9f] font-light truncate">— {d.epigrafe}</span>}
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i error | head -5`
Expected: No errors related to DrillDownView

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/DrillDownView.tsx
git commit -m "feat(drill-down): mobile drill-down navigation for deep hierarchies"
```

---

### Task 6: Wire DrillDownView into SearchBreadcrumbDropdown

Add responsive split: connected tree on desktop (≥640px), drill-down on mobile (<640px).

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumbDropdown.tsx`

- [ ] **Step 1: Import DrillDownView and add responsive state**

Add import at top:
```typescript
import { DrillDownView } from './DrillDownView'
```

Add a media query hook or simple state inside the component, after the existing hooks:
```typescript
const [isMobile, setIsMobile] = useState(false)
useEffect(() => {
  const mq = window.matchMedia('(max-width: 639px)')
  setIsMobile(mq.matches)
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])
```

- [ ] **Step 2: Wrap the hierarchy section in a responsive conditional**

Replace the hierarchy section (the "Navegação" label + LeiTree + empty state) with:

```tsx
{/* ---- HIERARCHY SECTION ---- */}
<div className="px-4 pt-[10px] pb-1 text-[9px] text-[#8a9a8f] uppercase tracking-[1.5px] font-medium">
  Navegação
  {hasInput && displayTree.length > 0 && (
    <span className="ml-1 normal-case tracking-normal">— {displayTree.length} itens</span>
  )}
</div>

{hierarquia.length === 0 && (
  <div className="px-4 py-3 space-y-2">
    <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '60%' }} />
    <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '40%' }} />
    <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '50%' }} />
  </div>
)}

{hierarquia.length > 0 && !isMobile && (
  <div className="px-1">
    <LeiTree
      data={displayTree}
      expanded={expandedSections}
      activePath={activePathIds}
      onToggle={handleToggle}
      onSelectArtigo={handleTreeSelect}
    />
  </div>
)}

{hierarquia.length > 0 && isMobile && (
  <DrillDownView
    hierarquia={hierarquia}
    dispositivos={dispositivos}
    input={input}
    onSelectHit={onSelectHit}
    onSelectArtigo={onSelectArtigo}
  />
)}

{!isMobile && displayTree.length === 0 && hasInput && !showSearchResults && (
  <div className="px-4 py-3 text-[11px] text-[#b0c0b5] font-light">
    Nenhum item na estrutura
  </div>
)}
```

- [ ] **Step 3: Visual check on desktop and mobile**

Test at desktop width (>640px): connected tree with circles/lines
Test at mobile width (<640px, use devtools): drill-down with path breadcrumb, back button, items with icons

- [ ] **Step 4: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumbDropdown.tsx
git commit -m "feat(search-dropdown): responsive split - connected tree desktop, drill-down mobile"
```

---

### Task 7: Final Visual Polish and Edge Cases

Verify everything works end-to-end, fix any visual inconsistencies.

**Files:**
- Possibly modify any of the 4 touched files

- [ ] **Step 1: Test the full flow on desktop**

Open lei-seca page at >640px width:
1. Verify glass breadcrumb bar with dot separators
2. Click to open — verify glass input with green focus ring
3. Verify connected tree with circles, lines, type labels
4. Verify tree auto-expands to active artigo
5. Type search term — verify tree filters + search results appear
6. Keyboard nav (↑↓→←⏎esc) all work
7. Click a search result — verify navigation + close

- [ ] **Step 2: Test the full flow on mobile**

Open lei-seca page at <640px width (Chrome DevTools → responsive):
1. Verify ellipsis breadcrumb ("..." + last 2 segments)
2. Tap to open — verify glass input
3. Verify drill-down shows current level children with icons
4. Tap a child to drill in — verify path breadcrumb + back button
5. Verify artigos section at bottom
6. Type search — verify flat filtered list replaces drill-down
7. Clear search — verify drill-down returns at same level
8. Footer shows "toque para navegar"

- [ ] **Step 3: Test edge cases**

1. Law with few levels (e.g., lei with only 2 structural levels) — breadcrumb should show all segments, no "..."
2. Empty search results — "Nenhum resultado" message
3. Very long segment names — truncation with ellipsis
4. Fast typing + clearing — no stale state

- [ ] **Step 4: Fix any visual issues found**

Address any spacing, color, or alignment issues discovered in testing.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "fix(search-breadcrumb): visual polish and edge case fixes"
```
