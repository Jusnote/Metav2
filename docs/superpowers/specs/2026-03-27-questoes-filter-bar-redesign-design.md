# Questoes Filter Bar — Redesign Spec

**Status:** APPROVED
**Date:** 2026-03-27
**Mockup final:** `.superpowers/brainstorm/7655-1774579312/filter-complete-final.html`

---

## 1. Overview

Replace the current SmartSearchBarPlate (Plate.js editor) and QuestoesFilterSidebar (~900 lines sidebar) with a unified, inline filter system using glass morphism pills + popovers (desktop) and drill-down bottom sheets (mobile). Two interaction paths: **pill click** (primary) and **slash `/` command** (secondary power-user shortcut).

## 2. Components to Remove

| File | Reason |
|------|--------|
| `src/components/SmartSearchBarPlate.tsx` (~320 lines) | Plate.js overkill for search input |
| `src/components/questoes/QuestoesFilterSidebar.tsx` (~900 lines) | Replaced by inline pills + popovers |
| `src/components/search-filter-kit.tsx` | Plate plugin wiring |
| `src/components/ui/search-slash-node.tsx` (~250 lines) | Plate-based slash combobox |

## 3. New Components

```
src/components/questoes/
├── QuestoesSearchBar.tsx          — native <input> + ⌘K + toggle IA + badge filtros + slash detection
├── QuestoesFilterBar.tsx          — horizontal pills row (Banca, Materia, Ano, Orgao, Cargo, Assunto, Mais)
├── QuestoesFilterPopover.tsx      — generic popover: search, recentes, checkbox list, progress bars, keyboard nav
├── QuestoesAdvancedPopover.tsx    — popover for "Mais" pill: 3 toggle switches
├── QuestoesSlashDropdown.tsx      — inline dropdown for "/" category picker
├── QuestoesSlashFilterDropdown.tsx — inline dropdown for filtering values after category selected
├── QuestoesFilterOverlay.tsx      — backdrop dim when popover/sheet open
├── QuestoesFilterSheet.tsx        — mobile bottom sheet: drill-down categories + inner list
└── FilterChipsBidirectional.tsx   — (keep existing, adjust colors)
```

## 4. State Management

**No changes to QuestoesContext.** New components call existing functions:
- `toggleFilter(key, value)` — add/remove filter
- `setFilter(key, value)` — replace entire array
- `removeFilter(key, value?)` — remove specific or clear
- `clearFilters()` — reset all
- `activeFilterCount` — computed count

**New local state (component-level):**
- `openPopover: string | null` — which pill's popover is open
- `slashMode: { active: boolean; category: string | null; query: string }` — slash command state
- `recentFilters: Record<string, string[][]>` — stored in localStorage per category

## 5. Desktop — Pill Click (Primary Path)

### 5.1 Sticky Bar

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍  Buscar questoes ou digite / para filtros...  ✨ IA  ⌘K │ ← search-bar (white, rounded top)
├─────────────────────────────────────────────────────────────┤
│ [Banca ▾] [Materia ▾] [Ano ▾] [Orgao ▾] [Cargo ▾] ...    │ ← filter-bar (glass gradient, rounded bottom)
└─────────────────────────────────────────────────────────────┘
```

- `position: sticky; top: 0; z-index: 20`
- `background: rgba(240,242,245,0.92); backdrop-filter: blur(12px)`
- Search bar: `height: 44px`, white background, `border-radius: 14px 14px 0 0`
- Filter bar: `background: linear-gradient(180deg, #f6f7f9, #eef0f3)`, `border-radius: 0 0 14px 14px`

### 5.2 Pills

**Inactive:** `background: rgba(255,255,255,0.85)`, `border: 1px solid rgba(0,0,0,0.08)`, Lucide SVG icon, label, chevron `▾`
**Hover:** `border-color: #E8930C`, `color: #B45309`
**Active (with selections):** colored gradient per category:

| Category | Gradient | Text | Border |
|----------|----------|------|--------|
| Banca | `#F4F0FF → #E9E3FF` | `#5B21B6` | `#C4B5FD` |
| Materia | `#FEF3C7 → #FDE68A` | `#92400E` | `#F59E0B` |
| Ano | `#DBEAFE → #BFDBFE` | `#1E40AF` | `#60A5FA` |
| Orgao | `#F0FDF4 → #BBF7D0` | `#166534` | `#4ADE80` |
| Cargo | `#FFF7ED → #FFEDD5` | `#9A3412` | `#FB923C` |
| Assunto | `#EEF2FF → #E0E7FF` | `#3730A3` | `#818CF8` |
| Mais (advanced) | `#DCFCE7 → #BBF7D0` | `#166534` | `#4ADE80` (dashed) |

**Count badge:** when >1 selection, show `×N` badge inside pill.
**Close button:** `×` to remove all selections for that category.
**"Limpar" link:** at the end, resets all filters.

### 5.3 Popover (QuestoesFilterPopover)

Opens below the clicked pill, anchored to its left edge.

```
┌──────────────────────────────────┐
│ 🔍  Filtrar banca...             │ ← search input (auto-focus)
├──────────────────────────────────┤
│ ↑↓ navegar  Enter selecionar    │ ← keyboard hints
├──────────────────────────────────┤
│ RECENTES                         │
│ 🕐 CESPE + FCC                  │
│ 🕐 VUNESP                       │
├──────────────────────────────────┤
│    Banca              Total      │ ← column header
├──────────────────────────────────┤
│ ☑ CEBRASPE (CESPE)   23.203 ███ │ ← selected (amber bg)
│ ☑ FCC                10.151 ██  │
│ ☐ QUADRIX             9.632 ██  │
│ ☐ VUNESP              7.503 █▌  │
│ ☐ FGV                 6.249 █   │
│ ...                              │
├──────────────────────────────────┤
│ Selecionar todos · Inverter    2 │ ← footer
└──────────────────────────────────┘
```

**Specs:**
- Width: `400px`
- Border-radius: `14px`
- Shadow: `0 16px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)`
- Search input: auto-focus on open, `border-color: #E8930C` on focus
- Keyboard hints: `↑↓` navigate, `Enter` select, `Esc` close
- Recentes: stored in localStorage, max 3 entries per category
- List: max-height `220px`, overflow-y scroll
- Checkbox: `16px`, rounded `5px`, checked = `background: #E8930C`
- Progress bar: `height: 5px`, proportional to max count, selected items get amber gradient
- Footer: "Selecionar todos", "Inverter", count of selected
- **Overlay:** questions behind get dimmed (`opacity: 0.35, filter: blur(1px)`) when popover open

### 5.4 Advanced Popover (Mais pill)

Same popover shell, but contains 3 toggle switches:

| Toggle | Description |
|--------|-------------|
| Excluir anuladas | Remove questoes anuladas pela banca |
| Excluir desatualizadas | Legislacao desatualizada |
| Excluir resolvidas | Somente nao respondidas |

Toggle: `44px × 26px`, off = `#e0e3e8`, on = `#E8930C`.
Footer: "N filtro(s) ativo(s)" + "Resetar".
Pill "Mais" turns green gradient + count badge when any toggle is on.

### 5.5 Toggle "✨ IA"

- Position: inside search bar, before the shortcut badge
- Inactive: `border: 1px solid #e0e0e0`, `color: #888`
- Active: `border-color: #7C3AED`, `color: #7C3AED`, `background: #F4F0FF`
- Click toggles between textual search (default) and semantic search
- When active, results show "✨ Busca Semantica" badge + "N% relevante" per question
- Calls existing semantic search endpoint in `useQuestoesV2`

## 6. Desktop — Slash Command (Secondary Path)

### 6.1 Trigger

When user types `/` in the search input:
1. Detect `/` character at current position
2. Open `QuestoesSlashDropdown` inline at cursor position
3. Show category list with icons (same as popover categories)

### 6.2 Category Selection

```
┌─────────────────────────┐
│ Selecione um filtro     │
├─────────────────────────┤
│ [🏛] Banca        498  │ ← highlighted (↑↓ navigation)
│ [📚] Materia        42 │
│ [📅] Ano            26 │
│ [🏢] Orgao         312 │
│ [💼] Cargo       1.204 │
│ [📖] Assunto       680 │
└─────────────────────────┘
```

- Width: `250px`, anchored at cursor position
- Items show colored icon square + label + count
- Keyboard: `↑↓` navigate, `Enter` select, `Esc` cancel

### 6.3 Value Filtering

After selecting category (e.g., "Banca"):
1. Inline chip `[🏛 banca:]` appears in input
2. User types filter text (e.g., "cespe")
3. `QuestoesSlashFilterDropdown` opens with matching results
4. Highlight matching text in results

```
┌───────────────────────────────┐
│ CESPEbraspe (CESPE)   23.203 │ ← highlighted match
│ Instituto CESEP           142 │
└───────────────────────────────┘
```

### 6.4 Completion

- `Enter` on highlighted result → filter applied
- Inline chip + typed text removed from input
- Pill in filter bar updates (same as pill-click path)
- Cursor returns to text, can continue typing or chain more `/` commands
- Example chain: `individuo que mata /banca cespe /ano 2024 /materia penal`

## 7. Mobile — Drill-Down Bottom Sheet (Primary Path)

### 7.1 Trigger

Any pill tap opens a **single bottom sheet** with all categories.

### 7.2 Categories View (Step 1)

```
┌──────────────────────────────────────┐
│ ═══                                  │ ← drag handle
│ Filtros                       Pronto │
├──────────────────────────────────────┤
│ [🏛] Banca              498      > │
│ [📚] Materia    ● 1      42      > │ ← dot = has selection
│ [📅] Ano        ● 2024   26      > │
│ [🏢] Orgao              312      > │
│ [💼] Cargo             1.204      > │
│ [📖] Assunto             680      > │
├──────────────────────────────────────┤
│ AVANCADO                             │
│ Excluir anuladas             [====] │
│ Excluir desatualizadas       [    ] │
│ Excluir resolvidas           [    ] │
├──────────────────────────────────────┤
│ 2 filtros + 1 avanc.   Limpar tudo │
└──────────────────────────────────────┘
```

**Specs:**
- `max-height: 80vh`
- `border-radius: 20px 20px 0 0`
- Handle: `36px × 4px`, `#d0d3d9`
- Category icons: `32px` square, colored background, rounded `8px`
- Active indicator: orange dot `6px` + selection text
- Chevron `>` for drill-in
- Advanced section: divider label + toggle rows inline
- Footer: active filter count + "Limpar tudo"

### 7.3 Inner List View (Step 2 — drill into category)

```
┌──────────────────────────────────────┐
│ ═══                                  │
│ < Banca                       Pronto │
│ Filtros > Banca                      │ ← mini breadcrumb
├──────────────────────────────────────┤
│ 🔍  Filtrar banca...                 │
├──────────────────────────────────────┤
│ ☑ CEBRASPE (CESPE)   23.203   ████ │
│ ☐ FCC                10.151   ██   │
│ ☐ QUADRIX             9.632   ██   │
│ ☐ VUNESP              7.503   █▌   │
│ ...                                  │
├──────────────────────────────────────┤
│ 498 bancas           1 selecionada ✓│
└──────────────────────────────────────┘
```

**Specs:**
- Back button `<` returns to categories view
- Mini breadcrumb: `Filtros > Banca` (active segment in orange)
- Search input: `height: 36px`, `border-radius: 10px`
- Rows: `padding: 11px 16px`, checkbox `20px`, larger touch targets
- Checkbox checked: `background: #E8930C`, checkmark SVG white
- Progress bars: `height: 6px` (slightly larger than desktop for touch)
- Footer: total count + selected count

### 7.4 Filter Bar (Mobile)

- Pills scroll horizontally (`overflow-x: auto`, `-webkit-overflow-scrolling: touch`)
- Hide scrollbar (`scrollbar-width: none`)
- Smaller pills: `font-size: 10px`, `padding: 4px 8px`, `border-radius: 7px`
- Search placeholder: "Buscar..." (shorter)
- Hide `⌘K` shortcut (not relevant on touch)

## 8. Mobile — Slash Command (Secondary Path)

### 8.1 Keyboard Bar

When search input is focused, show a custom keyboard accessory bar:
- `/` button prominently styled (`border: 2px solid #E8930C`, `color: #E8930C`)
- Suggestion buttons after `/` is tapped: "banca", "materia", "ano"

### 8.2 Slash Sheet

Tapping `/` opens a compact bottom sheet above the keyboard:
- Title: "Adicionar filtro"
- Category rows with colored icons (same as drill-down categories)
- Tapping a category → transitions to value input in search bar with inline chip
- Results appear in a smaller sheet above keyboard

### 8.3 Completion

- Tap result or submit → filter applied, pill appears in filter bar
- Sheet closes, keyboard stays open for continued typing

## 9. Keyboard Navigation

### Desktop
| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Focus search input |
| `/` (in input) | Open slash dropdown |
| `↑` / `↓` | Navigate popover/dropdown items |
| `Enter` | Select highlighted item / submit search |
| `Esc` | Close popover/dropdown |
| `Backspace` on empty slash | Cancel slash mode |

### Mobile
| Gesture | Action |
|---------|--------|
| Tap pill | Open drill-down sheet |
| Tap `/` on keyboard bar | Open slash sheet |
| Swipe down on sheet handle | Close sheet |
| Tap "Pronto" | Close sheet |
| Tap `<` back | Return to categories |

## 10. Performance Considerations

- **No Plate.js:** native `<input>` eliminates heavy editor dependency
- **Popover uses solid background on mobile Safari:** avoid `backdrop-filter` frame drops (same as lei seca)
- **Virtualize long lists:** if filter list > 100 items (e.g., 498 bancas), use lightweight virtual scroll
- **Debounce search in popover:** 200ms debounce on filter input
- **Lazy load filter counts:** fetch proportions on popover open, not on page load
- **localStorage for recentes:** max 3 entries per category, no API call

## 11. URL Sync

No changes. Existing `QuestoesContext` URL sync continues to work:
- Filters persist in URL search params
- Example: `/questoes?banca=CESPE&banca=FCC&materia=Dir.+Penal&ano=2024`
- Back/forward navigation restores filter state

## 12. Breakpoint

- **Desktop (≥640px):** popover dropdowns, keyboard hints visible, `⌘K` shortcut
- **Mobile (<640px):** bottom sheet, horizontal pill scroll, keyboard bar with `/`

## 13. Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary accent | `#E8930C` | Checkboxes, active borders, badges, toggle on |
| Search focus | `rgba(232,147,12,0.06)` | Input focus ring |
| IA toggle | `#7C3AED` / `#F4F0FF` | Semantic search indicator |
| Glass gradient top | `#f6f7f9` | Filter bar background |
| Glass gradient bottom | `#eef0f3` | Filter bar background |
| Selected row | `#FFFBEB` | Popover row highlight |
| Selected row hover | `#FEF3C7` | Popover row hover |
| Progress bar active | `linear-gradient(90deg, #F59E0B, #E8930C)` | Selected items |
| Progress bar inactive | `#d0d3d9` | Unselected items |
| Dim overlay | `opacity: 0.35; filter: blur(1px)` | Questions behind popover |

## 14. Mockup References

| File | Description |
|------|-------------|
| `filter-complete-final.html` | Complete design: desktop + mobile, both paths |
| `filter-glass-lucide.html` | Original glass morphism design |
| `filter-full-features.html` | Full features reference (sticky, overlay, recentes) |
| `filter-mobile-drilldown.html` | Mobile drill-down navigation |
| `filter-slash-flow.html` | Slash command flow (desktop + mobile) |
| `filter-mobile-bottomsheet.html` | Bottom sheet alternative (reference only) |
| `filter-desktop-pill-click.html` | Desktop pill click flow |

All mockups in: `.superpowers/brainstorm/7655-1774579312/`
