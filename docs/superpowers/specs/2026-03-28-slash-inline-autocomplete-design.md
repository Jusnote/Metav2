# Slash Inline Autocomplete — Design Spec

**Status:** APPROVED
**Date:** 2026-03-28
**Mockup:** `.superpowers/brainstorm/9163-1774704983/slash-inline-v4.html`

## Overview

When user types `/` in the search input, an inline autocomplete dropdown appears directly below the input (no popover, no separate search input). The main input is the single source of truth.

## Color Hierarchy

| Element | Color | Meaning |
|---------|-------|---------|
| `/banca` | `#E8930C` font-weight 600 | Category — amber forte |
| `cespe` (with match) | `#D4A06A` font-weight 500 | Value in progress — amber fraco |
| `pe` (ghost) | `#d0d3d9` font-weight 400 | Autocomplete suggestion |
| `xyz` (no match) | `#999` font-weight 400 | No results — cinza |

## Flow

### Step 1: Type `/`
- Hint bar appears below input: "banca · materia · ano · orgao · cargo · assunto"
- Connected to input (same amber border, no gap)

### Step 2: Type category name (e.g. `/ban`)
- Fuzzy match against category labels/keys
- Ghost text completes the match: `/ban` + ghost `ca`
- Matched category highlighted in hint bar
- Corresponding pill gets amber border highlight
- "Tab ou espaço para confirmar"

### Step 3: Space or Tab confirms category
- `/banca ` stays in input (amber forte)
- Dropdown opens connected to input (same border)
- Shows full list with progress bars, counts
- First item highlighted

### Step 4: Type value (e.g. `ces`)
- Dropdown filters in real time
- Text appears as amber fraco (#D4A06A) when has match
- Ghost text shows best match completion
- If no match: text turns gray (#999), dropdown shows "Nenhuma encontrada"

### Step 5a: Comma → select + continue
- First highlighted item gets selected (checkbox marked)
- Value text cleared from input, `/banca ` remains
- Dropdown shows full list again with selected item checked
- Selected items shown in bar at top of dropdown: "✓ CESPE ✕"
- Badge count updates on pill

### Step 5b: Enter → select + exit
- First highlighted item gets selected
- All slash text cleared from input
- Dropdown closes
- Toast "✓ CESPE selecionado" appears briefly
- Pill updates with count badge

### Escape → cancel
- All slash text cleared
- Dropdown closes
- No filter applied

## Dropdown Specs

- Connected to input (shares amber border, no gap)
- `border-radius: 0 0 14px 14px`
- `box-shadow: 0 12px 32px rgba(0,0,0,0.1)`
- Rows: checkbox + name (with match highlight) + count + progress bar
- First row highlighted with `background: #FFFBEB; border-left: 3px solid #E8930C`
- Footer: keyboard hints (`,` `Enter` `Esc` `↑↓`)
- When items selected: bar at top showing selected tags

## Keyboard

| Key | Action |
|-----|--------|
| `/` | Enter slash mode |
| `Tab` / `Space` | Confirm category, open dropdown |
| `↑` / `↓` | Navigate dropdown items |
| `,` | Select highlighted + continue in same category |
| `Enter` | Select highlighted + exit slash mode |
| `Esc` | Cancel slash mode |
| `Backspace` | Normal deletion; if value empty, go back to category typing |

## Implementation

- Reuses NO popover. Dropdown is a new simple component rendered below the search input.
- Main input stays focused at all times.
- Ghost text rendered as a separate span with absolute positioning or opacity trick.
- Color of value text determined by: does the current text match any item in the filtered list?

## Components

- Modify: `QuestoesSearchBar.tsx` — add slash mode state machine + inline dropdown rendering + ghost text
- Create: `QuestoesSlashInlineDropdown.tsx` — the dropdown (list + hints + selected bar)
- Delete: `QuestoesSlashDropdown.tsx` and `QuestoesSlashFilterDropdown.tsx` (old approach)
