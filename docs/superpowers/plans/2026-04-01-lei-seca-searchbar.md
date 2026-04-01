# Lei Seca Searchbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the closed state of the Lei Seca search bar to match the questões style, move breadcrumb below, and add a "Buscar" tab placeholder.

**Architecture:** Single file modification — `SearchBreadcrumb.tsx`. The closed state gets new JSX/styles, the breadcrumb moves outside the button, and the open state gets two tabs above the dropdown.

**Tech Stack:** React 19, Tailwind CSS inline styles, Outfit font (already loaded).

**Spec:** `docs/superpowers/specs/2026-04-01-lei-seca-searchbar-design.md`

---

## File Structure

### Modified files

| File | Changes |
|------|---------|
| `src/components/lei-seca/SearchBreadcrumb.tsx` | Redesign closed state, add breadcrumb below, add tabs in open state |

---

### Task 1: Redesign the closed state

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumb.tsx:152-217`

- [ ] **Step 1: Replace the closed state button**

Find the section `{/* ---- CLOSED: Glass Breadcrumb ---- */}` (lines 154-217). Replace the entire `{!open && (...)}` block with:

```tsx
      {/* ---- CLOSED: Clean search bar + breadcrumb below ---- */}
      {!open && (
        <>
          <button
            onClick={handleOpen}
            className="w-full flex items-center gap-[10px] h-[42px] px-4 cursor-pointer bg-white rounded-[12px] border border-[#e2e5ea] transition-all duration-150 hover:border-[#d0d3d8]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" className="shrink-0 transition-colors duration-150 group-hover:stroke-[#16a34a]">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="flex-1 text-[13.5px] text-[#a0a0a0] text-left">
              Buscar artigo, tema, palavra...
            </span>
            <span className="text-[10px] font-mono text-[#888] bg-[#f5f6f8] border border-[#e8eaed] px-[6px] py-[2px] rounded hidden sm:inline">
              {isMac ? '⌘F' : 'Ctrl+F'}
            </span>
          </button>

          {/* Breadcrumb — informational, below the bar */}
          {segments.length > 0 && (
            <div className="flex items-center gap-[5px] pt-[6px] px-1">
              {/* Desktop: all segments */}
              <span className="hidden sm:contents">
                {segments.map((seg, i) => (
                  <span key={seg.path} className="flex items-center gap-[5px] shrink-0">
                    {i > 0 && <span className="text-[9px] text-[#d4dbd7]">›</span>}
                    <span className={`text-[11px] ${
                      i === segments.length - 1 ? 'text-[#4a6350] font-medium' : 'text-[#a0afa5]'
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
                    <span className="text-[10px] text-[#b0c0b5]">...</span>
                    <span className="text-[9px] text-[#d4dbd7]">›</span>
                  </>
                )}
                {segments.slice(segments.length > 2 ? -2 : 0).map((seg, i) => (
                  <span key={seg.path} className="flex items-center gap-[5px] shrink-0">
                    {i > 0 && <span className="text-[9px] text-[#d4dbd7]">›</span>}
                    <span className={`text-[10px] ${
                      i === (segments.length > 2 ? 1 : segments.length - 1) ? 'text-[#4a6350] font-medium' : 'text-[#a0afa5]'
                    }`}>
                      {abbreviateLabel(seg.label)}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          )}
        </>
      )}
```

Key changes from original:
- `bg-white/65 backdrop-blur-[12px] border-white/50 rounded-[10px]` → `bg-white border-[#e2e5ea] rounded-[12px] h-[42px]`
- Glass morphism box-shadow removed → clean flat style
- Breadcrumb segments moved outside button into a `<div>` below
- Counter (`activeIndex+1 / totalArtigos`) removed per spec
- Dot separators (●) replaced with chevron separators (›)
- Hover: `opacity-80` → `border-[#d0d3d8]` (border color change)

- [ ] **Step 2: Verify visually**

Open `localhost:3000` and navigate to any lei. Verify:
- Closed bar is white with gray border, 42px height
- Placeholder reads "Buscar artigo, tema, palavra..."
- Kbd shortcut badge visible on desktop
- Breadcrumb appears below the bar with › separators
- Last segment is darker (#4a6350, font-medium)
- Clicking opens the existing green expanded state
- Ctrl+F / ⌘F still works

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumb.tsx
git commit -m "feat(lei-seca): redesign closed searchbar to questões style"
```

---

### Task 2: Add tabs in the open state

**Files:**
- Modify: `src/components/lei-seca/SearchBreadcrumb.tsx:265-283`

- [ ] **Step 1: Add tabs between the input and dropdown**

Find the section `{/* ---- DROPDOWN ---- */}` (line 265). Add tabs BEFORE the dropdown:

```tsx
      {/* ---- TABS: Navegar / Buscar ---- */}
      {open && (
        <div className="flex gap-0 mt-3 border-b border-[#e8ede9]">
          <button
            className="px-4 py-2 text-[12px] font-semibold text-[#16a34a] border-b-2 border-[#16a34a]"
          >
            Navegar
          </button>
          <button
            disabled
            className="px-4 py-2 text-[12px] font-medium text-[#c4ccc8] cursor-default flex items-center gap-[6px]"
          >
            Buscar
            <span className="text-[9px] font-semibold bg-[#f0f5f2] text-[#a0afa5] px-[6px] py-[2px] rounded">
              Em breve
            </span>
          </button>
        </div>
      )}

      {/* ---- DROPDOWN ---- */}
```

The dropdown code stays exactly as is — no changes.

- [ ] **Step 2: Verify visually**

Open `localhost:3000`, navigate to lei, click the search bar. Verify:
- Two tabs appear between input and dropdown
- "Navegar" is active (green, underline)
- "Buscar" is grayed out with "Em breve" badge
- "Buscar" is not clickable (disabled)
- Dropdown (article list) still works as before below the tabs
- Keyboard navigation (arrows, Enter, Escape) still works

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/SearchBreadcrumb.tsx
git commit -m "feat(lei-seca): add Navegar/Buscar tabs with 'Em breve' placeholder"
```
