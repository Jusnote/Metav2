# Questoes Filter Bar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SmartSearchBarPlate (Plate.js) + QuestoesFilterSidebar (900-line sidebar) with inline glass morphism pills + popovers (desktop) and drill-down bottom sheets (mobile).

**Architecture:** New components use the existing `QuestoesContext` for state (one minor addition: `semanticMode` boolean). Desktop uses popover dropdowns anchored to pills + slash `/` inline commands. Mobile uses a single drill-down bottom sheet. Data comes from existing `useFiltrosDicionario` hook (API + 24h localStorage cache). Long filter lists (>100 items) use `@tanstack/react-virtual` for performance.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide icons, `@tanstack/react-virtual` (already in project), existing Radix `Popover` primitive (`src/components/ui/popover.tsx`).

**Important decisions:**
- **Mobile breakpoint:** Create a new `useIsSmall()` hook at 640px instead of modifying global `useIsMobile` (768px) to avoid side effects on other features
- **IA toggle:** Add `semanticMode: boolean` + `setSemanticMode` to `QuestoesContext` (minor context change)
- **Filter counts:** Use counts from `useFiltrosDicionario` response. If the API does not return per-value counts, show only the progress bar proportionally (relative to the largest) — no separate API call
- **Inline slash chip:** Since native `<input>` cannot render rich content, the `/banca:` chip is rendered as styled text (not a true inline element). Use `contentEditable` div only if this proves insufficient
- **Mobile Safari:** Bottom sheets use solid white background (no `backdrop-filter`) to avoid frame drops
- **Swipe-to-dismiss:** Defer to polish phase — initial version uses tap on overlay or "Pronto" button to close

**Spec:** `docs/superpowers/specs/2026-03-27-questoes-filter-bar-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/7655-1774579312/filter-complete-final.html`

---

## File Structure

### New files
| File | Responsibility |
|------|----------------|
| `src/components/questoes/filter-config.ts` | Category definitions: key, label, icon, colors, Lucide component |
| `src/components/questoes/QuestoesSearchBar.tsx` | Native `<input>` + ⌘K + IA toggle + badge + slash detection |
| `src/components/questoes/QuestoesFilterBar.tsx` | Horizontal pills row, renders per-category pill with state |
| `src/components/questoes/QuestoesFilterPill.tsx` | Single pill: inactive/hover/active states, count badge, close |
| `src/components/questoes/QuestoesFilterPopover.tsx` | Generic popover: search, recentes, checkbox list, progress bars, keyboard nav, footer |
| `src/components/questoes/QuestoesAdvancedPopover.tsx` | "Mais" popover: 3 toggle switches |
| `src/components/questoes/QuestoesFilterOverlay.tsx` | Dim backdrop over questions when popover/sheet open |
| `src/components/questoes/QuestoesFilterSheet.tsx` | Mobile bottom sheet: categories view + drill-down inner list |
| `src/components/questoes/QuestoesSlashDropdown.tsx` | Desktop slash `/` category picker dropdown |
| `src/components/questoes/QuestoesSlashFilterDropdown.tsx` | Desktop slash value filter dropdown |
| `src/components/questoes/use-recent-filters.ts` | Hook: localStorage read/write for recent filter combos |
| `src/components/questoes/use-filter-keyboard-nav.ts` | Hook: ↑↓ Enter Esc navigation for lists |
| `src/hooks/use-small.ts` | Hook: `useIsSmall()` at 640px breakpoint (questoes-specific, does not touch global `useIsMobile`) |

### Modified files
| File | Change |
|------|--------|
| `src/views/QuestoesPage.tsx` | Replace SmartSearchBar + FilterSidebar with new components |
| `src/components/questoes/FilterChipsBidirectional.tsx` | Keep and update chip colors to match new palette |
| `src/contexts/QuestoesContext.tsx` | Add `semanticMode: boolean` + `setSemanticMode` to context |
| `src/components/AppSidebar.tsx` | Remove QuestoesFilterSidebar import and rendering for `/questoes` route |

### Files to delete (final task)
| File | Reason |
|------|--------|
| `src/components/SmartSearchBarPlate.tsx` | Replaced by QuestoesSearchBar |
| `src/components/questoes/QuestoesFilterSidebar.tsx` | Replaced by pills + popovers |
| `src/components/search-filter-kit.tsx` | Plate plugin wiring |
| `src/components/ui/search-slash-node.tsx` | Plate-based slash combobox |

---

## Task 1: Filter Config + Types

**Files:**
- Create: `src/components/questoes/filter-config.ts`

This file defines the category definitions used by every other component. Build it first so everything references a single source of truth.

- [ ] **Step 1: Create filter-config.ts**

```ts
// src/components/questoes/filter-config.ts
import {
  Building2, BookOpen, Calendar, Landmark, Briefcase, BookMarked, Settings,
  type LucideIcon,
} from 'lucide-react';
import type { QuestoesFilters } from '@/contexts/QuestoesContext';

export interface FilterCategoryConfig {
  key: keyof QuestoesFilters;       // context key (e.g. 'bancas')
  label: string;                     // display label (e.g. 'Banca')
  icon: LucideIcon;                  // Lucide component
  // Pill active colors (gradient)
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
  borderColor: string;
  // Icon square color (mobile category view)
  iconBg: string;
  iconStroke: string;
}

export const FILTER_CATEGORIES: FilterCategoryConfig[] = [
  {
    key: 'bancas', label: 'Banca', icon: Building2,
    gradientFrom: '#F4F0FF', gradientTo: '#E9E3FF',
    textColor: '#5B21B6', borderColor: '#C4B5FD',
    iconBg: '#F4F0FF', iconStroke: '#7C3AED',
  },
  {
    key: 'materias', label: 'Materia', icon: BookOpen,
    gradientFrom: '#FEF3C7', gradientTo: '#FDE68A',
    textColor: '#92400E', borderColor: '#F59E0B',
    iconBg: '#FEF3C7', iconStroke: '#D97706',
  },
  {
    key: 'anos', label: 'Ano', icon: Calendar,
    gradientFrom: '#DBEAFE', gradientTo: '#BFDBFE',
    textColor: '#1E40AF', borderColor: '#60A5FA',
    iconBg: '#DBEAFE', iconStroke: '#2563EB',
  },
  {
    key: 'orgaos', label: 'Orgao', icon: Landmark,
    gradientFrom: '#F0FDF4', gradientTo: '#BBF7D0',
    textColor: '#166534', borderColor: '#4ADE80',
    iconBg: '#F0FDF4', iconStroke: '#16A34A',
  },
  {
    key: 'cargos', label: 'Cargo', icon: Briefcase,
    gradientFrom: '#FFF7ED', gradientTo: '#FFEDD5',
    textColor: '#9A3412', borderColor: '#FB923C',
    iconBg: '#FFF7ED', iconStroke: '#EA580C',
  },
  {
    key: 'assuntos', label: 'Assunto', icon: BookMarked,
    gradientFrom: '#EEF2FF', gradientTo: '#E0E7FF',
    textColor: '#3730A3', borderColor: '#818CF8',
    iconBg: '#EEF2FF', iconStroke: '#4F46E5',
  },
];

export const ADVANCED_CATEGORY: FilterCategoryConfig = {
  key: 'excluirAnuladas', // placeholder — advanced uses multiple keys
  label: 'Mais', icon: Settings,
  gradientFrom: '#DCFCE7', gradientTo: '#BBF7D0',
  textColor: '#166534', borderColor: '#4ADE80',
  iconBg: '#DCFCE7', iconStroke: '#166534',
};

export type FilterCategoryKey = typeof FILTER_CATEGORIES[number]['key'];

/** Get items for a category from the dicionario */
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export function getCategoryItems(
  category: FilterCategoryConfig,
  dicionario: FiltrosDicionario | null,
): { label: string; value: string | number }[] {
  if (!dicionario) return [];

  switch (category.key) {
    case 'bancas':
      return Object.values(dicionario.bancas)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(v => ({ label: v, value: v }));
    case 'materias':
      return dicionario.materias.map(v => ({ label: v, value: v }));
    case 'assuntos':
      return dicionario.assuntos.map(v => ({ label: v, value: v }));
    case 'anos': {
      const items: { label: string; value: number }[] = [];
      for (let y = dicionario.anos.max; y >= dicionario.anos.min; y--) {
        items.push({ label: String(y), value: y });
      }
      return items;
    }
    case 'orgaos':
      return Object.values(dicionario.orgaos)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(v => ({ label: v, value: v }));
    case 'cargos':
      return Object.values(dicionario.cargos)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(v => ({ label: v, value: v }));
    default:
      return [];
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors related to filter-config.ts

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/filter-config.ts
git commit -m "feat(questoes): add filter category config constants"
```

---

## Task 2: Keyboard Nav + Recent Filters Hooks

**Files:**
- Create: `src/components/questoes/use-filter-keyboard-nav.ts`
- Create: `src/components/questoes/use-recent-filters.ts`

- [ ] **Step 1: Create use-filter-keyboard-nav.ts**

Reusable hook for ↑↓ Enter Esc navigation in any list (popover, dropdown, sheet).

```ts
// src/components/questoes/use-filter-keyboard-nav.ts
import { useState, useCallback, useEffect } from 'react';

interface UseFilterKeyboardNavOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  enabled: boolean;
}

export function useFilterKeyboardNav({
  itemCount,
  onSelect,
  onClose,
  enabled,
}: UseFilterKeyboardNavOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Reset highlight when item count changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [itemCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % itemCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + itemCount) % itemCount);
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(highlightedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [enabled, itemCount, highlightedIndex, onSelect, onClose],
  );

  return { highlightedIndex, setHighlightedIndex, handleKeyDown };
}
```

- [ ] **Step 2: Create use-recent-filters.ts**

```ts
// src/components/questoes/use-recent-filters.ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'questoes_recent_filters';
const MAX_ENTRIES = 3;

interface RecentEntry {
  values: string[];
  timestamp: number;
}

type RecentsMap = Record<string, RecentEntry[]>;

function loadRecents(): RecentsMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveRecents(map: RecentsMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function useRecentFilters(categoryKey: string) {
  const [recents, setRecents] = useState<RecentEntry[]>(
    () => loadRecents()[categoryKey] || [],
  );

  const addRecent = useCallback(
    (values: string[]) => {
      if (values.length === 0) return;
      const map = loadRecents();
      const key = [...values].sort().join('+');
      const existing = (map[categoryKey] || []).filter(
        e => [...e.values].sort().join('+') !== key,
      );
      const updated = [{ values, timestamp: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
      map[categoryKey] = updated;
      saveRecents(map);
      setRecents(updated);
    },
    [categoryKey],
  );

  return { recents, addRecent };
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/use-filter-keyboard-nav.ts src/components/questoes/use-recent-filters.ts
git commit -m "feat(questoes): add keyboard nav + recent filters hooks"
```

---

## Task 3: QuestoesFilterPill + QuestoesFilterBar

**Files:**
- Create: `src/components/questoes/QuestoesFilterPill.tsx`
- Create: `src/components/questoes/QuestoesFilterBar.tsx`

- [ ] **Step 1: Create QuestoesFilterPill.tsx**

Single pill component handling all visual states (inactive, hover, active with count/close).

Reference spec section 5.2 for exact colors. Use inline styles for the gradient (category-specific colors from config).

Props:
- `category: FilterCategoryConfig`
- `selectedCount: number`
- `isOpen: boolean`
- `onClick: () => void`
- `onClear: () => void`

- [ ] **Step 2: Create QuestoesFilterBar.tsx**

Horizontal row of pills. Maps `FILTER_CATEGORIES` + `ADVANCED_CATEGORY` to pills. Manages `openPopover` state. Includes "Limpar" link at end.

Desktop: `gap-6px`, `overflow-x: auto`
Mobile: smaller pills (`font-size: 10px`, `padding: 4px 8px`)

Uses `useIsMobile()` for responsive pill sizing.
Uses `useQuestoesContext()` for filter state (read selected counts per category).

- [ ] **Step 3: Verify renders without errors**

Run: `npm run dev`, navigate to `/questoes`. Filter bar should show with inactive pills (no popovers yet). Open browser console — no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/QuestoesFilterPill.tsx src/components/questoes/QuestoesFilterBar.tsx
git commit -m "feat(questoes): add filter pill + filter bar components"
```

---

## Task 4: QuestoesSearchBar

**Files:**
- Create: `src/components/questoes/QuestoesSearchBar.tsx`

- [ ] **Step 1: Create QuestoesSearchBar.tsx**

Native `<input>` replacing SmartSearchBarPlate. Features:
- Placeholder: "Buscar questoes ou digite / para filtros..." (desktop) / "Buscar..." (mobile)
- IA toggle button (calls `useQuestoesContext` — needs a new `semanticMode` field or local state)
- Badge showing `activeFilterCount` from context
- `⌘K` / `Ctrl+K` shortcut badge (hidden on mobile)
- `onSubmit` calls `setSearchQuery` from context
- Debounce: 500ms on input change for live search
- Detects `/` character for slash mode (will wire to dropdown in Task 9)

Styling per spec 5.1:
- `height: 44px`, white bg, `border-radius: 14px 14px 0 0`
- Focus: `border-color: #E8930C`, `box-shadow: 0 0 0 3px rgba(232,147,12,0.06)`

Uses `useIsMobile()` for responsive placeholder and hiding `⌘K`.

- [ ] **Step 2: Verify renders**

Run: `npm run dev`. Type in search bar, verify it works as basic input. IA toggle should toggle visual state. ⌘K should focus input.

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/QuestoesSearchBar.tsx
git commit -m "feat(questoes): add native search bar with IA toggle"
```

---

## Task 5: QuestoesFilterOverlay

**Files:**
- Create: `src/components/questoes/QuestoesFilterOverlay.tsx`

- [ ] **Step 1: Create QuestoesFilterOverlay.tsx**

Simple component: when `visible` prop is true, renders a div that dims content behind it.

```tsx
// Applies to the questions list area
// opacity: 0.35, filter: blur(1px), pointer-events: none, transition
```

Props: `visible: boolean`, `children: React.ReactNode`

Wraps children and applies dim effect when visible.

- [ ] **Step 2: Commit**

```bash
git add src/components/questoes/QuestoesFilterOverlay.tsx
git commit -m "feat(questoes): add filter overlay dim component"
```

---

## Task 6: QuestoesFilterPopover

**Files:**
- Create: `src/components/questoes/QuestoesFilterPopover.tsx`

This is the most complex component. Build it in sub-steps.

- [ ] **Step 1: Create basic popover shell**

Popover container: `width: 400px`, `border-radius: 14px`, shadow per spec 5.3.
Uses Radix Popover (`src/components/ui/popover.tsx`) as base.

Sections (all within one component):
1. Search input (auto-focus)
2. Keyboard hints bar
3. Recentes section (from `useRecentFilters`)
4. Column header
5. Scrollable checkbox list
6. Footer (Selecionar todos, Inverter, count)

Props:
- `category: FilterCategoryConfig`
- `open: boolean`
- `onClose: () => void`
- `anchor: React.RefObject<HTMLElement>` (pill element for positioning)

- [ ] **Step 2: Implement checkbox list with progress bars + virtualization**

Each row: checkbox + label + count + progress bar.
Data from `useFiltrosDicionario()` via `getCategoryItems()`.
Selected state from `useQuestoesContext().filters[category.key]`.
Click toggles via `toggleFilter(category.key, value)`.

Progress bar: proportional to max count. Selected items get amber gradient, others get gray.

**Virtualization:** For categories with >100 items (bancas: 498, cargos: 1204), use `@tanstack/react-virtual` `useVirtualizer` (already in project for `VirtualizedQuestionList`). Estimated row height: 32px. This prevents DOM jank when popover opens with large lists.

- [ ] **Step 3: Implement search filtering**

Debounce 200ms. Filter items by label match (case-insensitive, accent-insensitive).

- [ ] **Step 4: Wire keyboard navigation**

Use `useFilterKeyboardNav` hook. ↑↓ highlights, Enter toggles, Esc closes.

- [ ] **Step 5: Implement footer actions**

"Selecionar todos": sets all visible items as selected via `setFilter(key, allValues)`.
"Inverter": toggles each visible item.
Count display: "N selecionada(s) ✓".

- [ ] **Step 6: Wire recentes**

On popover close (if selections changed), call `addRecent(selectedValues)`.
Show recentes section at top. Click a recent entry applies that combination.

- [ ] **Step 7: Verify full popover works**

Run: `npm run dev`. Click a pill → popover opens. Search filters list. Select items → pill updates. Keyboard nav works. Close → recentes saved.

- [ ] **Step 8: Commit**

```bash
git add src/components/questoes/QuestoesFilterPopover.tsx
git commit -m "feat(questoes): add filter popover with search, checkboxes, progress bars, keyboard nav"
```

---

## Task 7: QuestoesAdvancedPopover

**Files:**
- Create: `src/components/questoes/QuestoesAdvancedPopover.tsx`

- [ ] **Step 1: Create advanced popover**

Same popover shell but with 3 toggle switches instead of checkbox list:
- Excluir anuladas (`excluirAnuladas`)
- Excluir desatualizadas (`excluirDesatualizadas`)
- Excluir resolvidas (`excluirResolvidas`)

Each toggle: label + description + switch.
Footer: "N filtro(s) ativo(s)" + "Resetar".
Toggle visual: `44px × 26px`, off = `#e0e3e8`, on = `#E8930C`.

Uses `toggleFilter('excluirAnuladas', true)` pattern from context.

- [ ] **Step 2: Verify**

Click "Mais" pill → advanced popover opens. Toggle switches work. Pill turns green with count badge.

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/QuestoesAdvancedPopover.tsx
git commit -m "feat(questoes): add advanced filter popover with toggle switches"
```

---

## Task 8: Wire Desktop into QuestoesPage

**Files:**
- Modify: `src/views/QuestoesPage.tsx`
- Modify: `src/components/questoes/FilterChipsBidirectional.tsx`

- [ ] **Step 1: Replace SmartSearchBar with new components in QuestoesPage**

Remove `SmartSearchBar` import and usage.
Add: `QuestoesSearchBar` + `QuestoesFilterBar` inside a sticky wrapper div.
Wrap `VirtualizedQuestionList` with `QuestoesFilterOverlay`.
Remove `FilterChipsBidirectional` (pills replace the need for separate chips — or keep as optional below filter bar).

Layout structure:
```tsx
<div className="flex flex-col h-full max-w-5xl mx-auto w-full">
  {/* Sticky bar */}
  <div className="sticky top-0 z-20" style={{ background: 'rgba(240,242,245,0.92)', backdropFilter: 'blur(12px)' }}>
    <QuestoesSearchBar />
    <QuestoesFilterBar />
  </div>

  {/* Tabs + Sort (keep existing) */}
  ...

  {/* Questions with overlay */}
  <QuestoesFilterOverlay visible={hasOpenPopover}>
    <VirtualizedQuestionList />
  </QuestoesFilterOverlay>
</div>
```

- [ ] **Step 2: Remove QuestoesFilterSidebar from AppSidebar**

Open `src/components/AppSidebar.tsx`. Remove the import of `QuestoesFilterSidebar` and its rendering in the `/questoes` route sidebar panel. The sidebar panel for questoes should be empty/null (all filtering is now inline via pills).

- [ ] **Step 3: Update FilterChipsBidirectional colors**

Update `CHIP_STYLES` to use per-category colors matching the pill palette from `filter-config.ts`.

- [ ] **Step 4: Verify desktop flow end-to-end**

Run: `npm run dev`. Navigate to `/questoes`.
- Search bar visible with IA toggle
- Pills visible, clickable → popovers open
- Select filters → pills update with count badges
- Questions dim when popover open
- URL sync works (check address bar)
- No sidebar panel for questoes (removed)

- [ ] **Step 5: Commit**

```bash
git add src/views/QuestoesPage.tsx src/components/questoes/FilterChipsBidirectional.tsx src/components/AppSidebar.tsx
git commit -m "feat(questoes): wire new search bar + filter bar into page, remove sidebar"
```

---

## Task 9: Slash Command Dropdowns (Desktop)

**Files:**
- Create: `src/components/questoes/QuestoesSlashDropdown.tsx`
- Create: `src/components/questoes/QuestoesSlashFilterDropdown.tsx`
- Modify: `src/components/questoes/QuestoesSearchBar.tsx`

- [ ] **Step 1: Create QuestoesSlashDropdown.tsx**

Category picker that opens when `/` is typed in search input.
- `width: 250px`, positioned at cursor
- Shows FILTER_CATEGORIES with colored icon squares + label + count
- Keyboard nav via `useFilterKeyboardNav`
- On select → notifies parent of chosen category

- [ ] **Step 2: Create QuestoesSlashFilterDropdown.tsx**

Value filter dropdown after category is selected.
- `width: 280px`
- Filters from `getCategoryItems()` matching typed text
- Highlight matching substring in results
- On select → applies filter via context, closes slash mode

- [ ] **Step 3: Wire slash detection into QuestoesSearchBar**

Add `slashMode` local state: `{ active: boolean; category: string | null; query: string }`.
On input change, detect `/` → set `slashMode.active = true` → render `QuestoesSlashDropdown`.
On category select → set `slashMode.category` → render `QuestoesSlashFilterDropdown`.
On value select → apply filter, clean `/...` from input text, reset slash mode.
On Escape or Backspace on empty → cancel slash mode.

- [ ] **Step 4: Verify slash flow**

Type "individuo que mata /", see category dropdown. Select "Banca", type "cespe", see filtered results. Enter → CESPE pill appears. Input text clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/questoes/QuestoesSlashDropdown.tsx src/components/questoes/QuestoesSlashFilterDropdown.tsx src/components/questoes/QuestoesSearchBar.tsx
git commit -m "feat(questoes): add slash command filter flow for desktop"
```

---

## Task 10: Mobile Bottom Sheet — Categories View

**Files:**
- Create: `src/components/questoes/QuestoesFilterSheet.tsx`
- Modify: `src/components/questoes/QuestoesFilterBar.tsx`

- [ ] **Step 1: Create QuestoesFilterSheet.tsx — categories view**

Bottom sheet component (no library — custom CSS, same pattern as lei-seca DrillDownView).

Structure:
- Drag handle (36px × 4px)
- Header: "Filtros" + "Pronto" button
- Category rows: icon square (32px) + name + subtitle + active dot + chevron
- Advanced section: divider label + 3 toggle rows
- Footer: active filter count + "Limpar tudo"

Animation: `transform: translateY(100%) → translateY(0)`, `0.3s cubic-bezier(0.16, 1, 0.3, 1)`.
Overlay behind: `rgba(0,0,0,0.35)`.

State: `drillCategory: FilterCategoryConfig | null` — when null, show categories. When set, show inner list.

- [ ] **Step 2: Wire into QuestoesFilterBar**

On mobile (`useIsMobile()`), pill click opens the sheet instead of popover.
Pass `openSheet` state and setter down.

- [ ] **Step 3: Verify mobile categories view**

Open browser dev tools → toggle mobile viewport (375px). Tap any pill → bottom sheet opens with categories. Toggle advanced filters. Tap "Pronto" → closes.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/QuestoesFilterSheet.tsx src/components/questoes/QuestoesFilterBar.tsx
git commit -m "feat(questoes): add mobile filter sheet with categories view"
```

---

## Task 11: Mobile Bottom Sheet — Drill-Down Inner List

**Files:**
- Modify: `src/components/questoes/QuestoesFilterSheet.tsx`

- [ ] **Step 1: Add inner list view to QuestoesFilterSheet**

When `drillCategory` is set:
- Header: back button `<` + category name + "Pronto"
- Mini breadcrumb: "Filtros > Banca"
- Search input (36px height)
- Checkbox list with progress bars (same data as popover, larger touch targets)
- Footer: total count + selected count

Back button sets `drillCategory = null`.

- [ ] **Step 2: Add transition animation between views**

Categories → inner list: slide left.
Inner list → categories: slide right.
Use CSS transform + transition.

- [ ] **Step 3: Verify drill-down flow**

Mobile viewport. Tap pill → categories sheet. Tap "Banca" → slides to banca list. Select items. Tap `<` → back to categories (dot indicator updated). Tap "Pronto" → closes.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/QuestoesFilterSheet.tsx
git commit -m "feat(questoes): add drill-down inner list to mobile filter sheet"
```

---

## Task 12: Mobile Slash Command

**Files:**
- Modify: `src/components/questoes/QuestoesSearchBar.tsx`
- Modify: `src/components/questoes/QuestoesFilterSheet.tsx`

- [ ] **Step 1: Add keyboard accessory bar on mobile**

When search input is focused on mobile, render a bar above the keyboard:
- `/` button (prominently styled: `border: 2px solid #E8930C`)
- After `/` tapped: suggestion buttons ("banca", "materia", "ano")

This is a fixed-position div at the bottom of the viewport.

- [ ] **Step 2: Wire slash to compact sheet**

Tapping `/` opens a compact bottom sheet "Adicionar filtro" with category rows.
Tapping a category → transitions to value filtering (reuses inner list from Task 11).
Selecting a value → applies filter, closes sheet.

- [ ] **Step 3: Verify mobile slash flow**

Mobile viewport. Tap search input → keyboard bar appears with `/`. Tap `/` → category sheet. Select "Banca" → drill to list. Select CESPE → pill appears.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/QuestoesSearchBar.tsx src/components/questoes/QuestoesFilterSheet.tsx
git commit -m "feat(questoes): add mobile slash command with keyboard bar"
```

---

## Task 13: Remove Old Components + Cleanup

**Files:**
- Delete: `src/components/SmartSearchBarPlate.tsx`
- Delete: `src/components/questoes/QuestoesFilterSidebar.tsx`
- Delete: `src/components/search-filter-kit.tsx`
- Delete: `src/components/ui/search-slash-node.tsx`
- Modify: any files that import the deleted components (fix broken imports)

- [ ] **Step 1: Search for all imports of deleted files**

Run: `grep -r "SmartSearchBar\|QuestoesFilterSidebar\|search-filter-kit\|search-slash-node" src/ --include="*.tsx" --include="*.ts" -l`

Fix any remaining references.

- [ ] **Step 2: Delete old files**

```bash
rm src/components/SmartSearchBarPlate.tsx
rm src/components/questoes/QuestoesFilterSidebar.tsx
rm src/components/search-filter-kit.tsx
rm src/components/ui/search-slash-node.tsx
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build:dev`
Expected: build succeeds with no import errors.

- [ ] **Step 4: Verify app works end-to-end**

Run: `npm run dev`. Test:
- Desktop: pill click → popover, slash command, search, IA toggle
- Mobile: pill tap → drill-down sheet, slash via keyboard bar
- URL sync: filters persist in URL, back/forward works
- No console errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(questoes): remove SmartSearchBarPlate, FilterSidebar, Plate dependencies"
```

---

## Task 14: Polish + Breakpoint Hook

**Files:**
- Create: `src/hooks/use-small.ts`
- Modify: `src/components/questoes/QuestoesFilterBar.tsx` (replace `useIsMobile` with `useIsSmall`)
- Modify: `src/components/questoes/QuestoesSearchBar.tsx` (replace `useIsMobile` with `useIsSmall`)

- [ ] **Step 1: Create `useIsSmall` hook at 640px**

```ts
// src/hooks/use-small.ts
import * as React from "react";

const SMALL_BREAKPOINT = 640;

export function useIsSmall() {
  const [isSmall, setIsSmall] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${SMALL_BREAKPOINT - 1}px)`);
    const onChange = () => setIsSmall(window.innerWidth < SMALL_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsSmall(window.innerWidth < SMALL_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isSmall;
}
```

Replace all `useIsMobile()` calls in questoes filter components with `useIsSmall()`. Do NOT modify `src/hooks/use-mobile.tsx` — it stays at 768px for other features.

- [ ] **Step 2: Final visual review**

Open mockup `.superpowers/brainstorm/7655-1774579312/filter-complete-final.html` side-by-side with the app. Compare:
- Pill colors, sizes, spacing
- Popover layout, shadows, border-radius
- Mobile sheet layout, handle, transitions
- Overlay dim effect

Fix any visual discrepancies.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(questoes): adjust breakpoint + visual polish"
```
