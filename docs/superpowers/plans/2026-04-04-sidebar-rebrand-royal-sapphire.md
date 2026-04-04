# Sidebar Redesign + Royal Sapphire Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign sidebar from dark to light theme, simplify layout nesting, add Soft Glow separator, and migrate entire brand palette from amber to Royal Sapphire blue.

**Architecture:** The sidebar layout changes from 3 nested containers to a flat flex layout with a reusable SoftGlow separator component. Color migration is a systematic find-and-replace of hex values and Tailwind amber utilities → blue equivalents across ~25 files, with semantic amber exceptions preserved.

**Tech Stack:** React 19, Tailwind CSS v4, Framer Motion (motion/react), Tabler Icons

**Spec:** `docs/superpowers/specs/2026-04-04-sidebar-rebrand-royal-sapphire.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/SoftGlowSeparator.tsx` | Create | Reusable separator with gradient glow line |
| `src/components/AppSidebar.tsx` | Modify | Layout restructure + light theme + blue palette |
| `src/components/lei-seca/GrifoText.tsx` | Modify | Art. prefix amber → blue |
| `src/components/questoes/QuestoesSearchBar.tsx` | Modify | Amber → blue |
| `src/components/questoes/QuestoesSlashInlineDropdown.tsx` | Modify | Amber → blue |
| `src/components/questoes/QuestoesFilterSheet.tsx` | Modify | Amber → blue |
| `src/components/questoes/QuestoesFilterPopover.tsx` | Modify | Amber → blue |
| `src/components/questoes/QuestoesFilterPill.tsx` | Modify | Amber → blue |
| `src/components/questoes/FilterChipsBidirectional.tsx` | Modify | Amber → blue |
| `src/components/questoes/QuestoesAdvancedPopover.tsx` | Modify | Amber → blue |
| `src/components/questoes/VirtualizedQuestionList.tsx` | Modify | Amber → blue |
| `src/components/QuestionCard.tsx` | Modify | Amber → blue |
| `src/views/DocumentsOrganizationPage.tsx` | Modify | Amber → blue |
| `src/components/DocumentsOrganizationSidebar.tsx` | Modify | Amber → blue |
| `src/components/TopicItem.tsx` | Modify | Amber → blue |
| `src/components/SubtopicItem.tsx` | Modify | Amber → blue |
| `src/views/CadernosPage.tsx` | Modify | Amber → blue |
| `src/components/cadernos/CadernosSidebar.tsx` | Modify | Amber → blue |
| `src/components/DayWithProgress.tsx` | Modify | Amber → blue |
| `src/components/lei-seca/lei-anotacao-tooltip.tsx` | Modify | Amber → blue |
| `src/components/lei-seca/lei-seca-editor.tsx` | Modify | Amber → blue |
| `src/components/lei-seca/dispositivos/DispositivoGutter.tsx` | Modify | Amber → blue |
| `src/components/lei-seca/dispositivos/DispositivoFooter.tsx` | Modify | Amber → blue |
| `src/components/lei-seca/comments/DispositivoNote.tsx` | Modify | Amber → blue |
| `src/components/questoes/comments/PrivateNote.tsx` | Modify | Amber → blue |
| `src/components/questoes/comments/EndorsedBadge.tsx` | Modify | Amber → blue |
| `src/components/shared/comments/CommentItem.tsx` | Modify | Avatar gradient |
| `src/components/AnimatedBackground.tsx` | Modify | Amber → blue |
| `src/components/lei-seca/lei-ingestao-editor.tsx` | Modify | Amber → blue |

**Files NOT touched (semantic amber exceptions):**
- `src/components/moderation/shared/StatusDot.tsx`
- `src/components/moderation/overview/OverviewAnalytics.tsx`
- `src/components/moderation/users/UsersPage.tsx`
- `src/components/moderation/users/UserDrawer.tsx`
- `src/components/UserAvatar.tsx` (bronze rank)
- `src/types/caderno.ts` (user-facing color palette)
- `src/components/goals/TopicConflictResolver.tsx` (warning UI)
- `src/components/goals/TopicConflictAccordion.tsx` (warning UI)
- `src/components/BlockBasedFlashcardEditor.tsx` (word-hiding type)
- `src/components/QuestionCard.tsx` line 166 only (difficulty "Medio" — rest of file changes)

---

### Task 1: Create SoftGlow separator component

**Files:**
- Create: `src/components/SoftGlowSeparator.tsx`

- [ ] **Step 1: Create the SoftGlow separator component**

```tsx
// src/components/SoftGlowSeparator.tsx

export function SoftGlowSeparator({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: '1px',
        alignSelf: 'stretch',
        position: 'relative',
        background: 'linear-gradient(180deg, transparent 5%, #dbeafe 30%, #93c5fd 50%, #dbeafe 70%, transparent 95%)',
        opacity: 0.6,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: -4,
          width: 9,
          height: '100%',
          background: 'linear-gradient(180deg, transparent 5%, rgba(59,130,246,0.04) 30%, rgba(59,130,246,0.06) 50%, rgba(59,130,246,0.04) 70%, transparent 95%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify file was created correctly**

Run: `cat src/components/SoftGlowSeparator.tsx | head -5`
Expected: Shows the component export

- [ ] **Step 3: Commit**

```bash
git add src/components/SoftGlowSeparator.tsx
git commit -m "feat: add SoftGlow separator component for sidebar redesign"
```

---

### Task 2: Restructure AppSidebar — layout + light theme + blue palette

**Files:**
- Modify: `src/components/AppSidebar.tsx`

This is the biggest single task. The AppSidebar needs:
1. Layout: remove 3 nested containers → flat (flex h-screen)
2. Colors: dark backgrounds → white/off-white
3. Active states: white/opacity → blue-100
4. Indicators: amber → blue gradient
5. Logo/avatar: amber gradient → blue gradient
6. Mobile: amber references → blue
7. Import and use SoftGlowSeparator

- [ ] **Step 1: Replace the entire desktop layout section**

Replace lines 161-332 of `AppSidebar.tsx`. The new desktop layout is flat: one flex container with icon rail, optional SoftGlow + flyout + SoftGlow, and content area. Remove the 3 nested containers.

Add import at top:
```tsx
import { SoftGlowSeparator } from "./SoftGlowSeparator";
```

Replace the desktop section (`{!isMobile && <div ...>` through to its closing `</div>}`) with:

```tsx
{!isMobile && (
  <div className="flex h-screen w-full overflow-hidden">
    {/* Icon Rail */}
    <div className="w-14 shrink-0 flex flex-col py-4 px-2 bg-white">
      {/* Logo */}
      <a href="/" className="flex items-center justify-center py-1 mb-6">
        <div className="h-6 w-7 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_8px_rgba(30,64,175,0.3)]" />
      </a>

      {/* Main nav */}
      <nav className="flex flex-col gap-1">
        {mainNavigation.map((item) => (
          <button
            key={item.href}
            onClick={() => handleNavClick(item)}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-[10px] transition-all duration-150 relative",
              isActive(item.href)
                ? "bg-[#DBEAFE]/80 text-[#1E40AF] shadow-[0_1px_4px_rgba(30,64,175,0.08)]"
                : "bg-transparent text-[#8b8fa3] hover:text-[#64748b] hover:bg-black/[0.04]",
              panelSection === item.href && !isActive(item.href) && "text-[#64748b] bg-black/[0.04]"
            )}
            title={item.label}
          >
            {item.icon}
            {isActive(item.href) && (
              <div className="absolute left-[-1px] top-1/2 -translate-y-1/2 w-[2.5px] h-[18px] rounded-r-[3px]"
                style={{ background: 'linear-gradient(180deg, #1E40AF, #3B82F6)' }} />
            )}
          </button>
        ))}
      </nav>

      <div className="my-3 mx-1 border-t border-black/[0.06]" />

      {/* Tools nav */}
      <nav className="flex flex-col gap-1">
        {toolsNavigation.map((item) => (
          <button
            key={item.href}
            onClick={() => handleNavClick(item)}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-[10px] transition-all duration-150 relative",
              isActive(item.href)
                ? "bg-[#DBEAFE]/80 text-[#1E40AF] shadow-[0_1px_4px_rgba(30,64,175,0.08)]"
                : "bg-transparent text-[#8b8fa3] hover:text-[#64748b] hover:bg-black/[0.04]"
            )}
            title={item.label}
          >
            {item.icon}
            {isActive(item.href) && (
              <div className="absolute left-[-1px] top-1/2 -translate-y-1/2 w-[2.5px] h-[18px] rounded-r-[3px]"
                style={{ background: 'linear-gradient(180deg, #1E40AF, #3B82F6)' }} />
            )}
          </button>
        ))}
      </nav>

      {/* Bottom: moderation + settings + user + logout */}
      <div className="mt-auto flex flex-col gap-1">
        {isModerator && (
          <>
            <div className="my-2 mx-1 border-t border-black/[0.06]" />
            {moderationNav.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-[10px] transition-all duration-150 relative",
                  isActive(item.href)
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-transparent text-[#8b8fa3] hover:text-violet-300 hover:bg-violet-500/10"
                )}
                title={item.label}
              >
                {item.icon}
                {isActive(item.href) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-violet-400 rounded-r" />
                )}
              </button>
            ))}
          </>
        )}
        <button
          onClick={() => { setPanelSection(null); navigate("/settings"); }}
          className="flex items-center justify-center h-9 w-9 rounded-[10px] bg-transparent text-[#8b8fa3] hover:text-[#64748b] hover:bg-black/[0.04] transition-all duration-150"
          title="Configurações"
        >
          <IconSettings className="h-5 w-5" />
        </button>

        {user && (
          <>
            <div className="flex items-center justify-center py-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_6px_rgba(30,64,175,0.25)] flex items-center justify-center">
                <span className="text-white text-xs font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center h-9 w-9 rounded-[10px] bg-transparent text-[#8b8fa3] hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-150"
              title="Sair"
            >
              <IconLogout className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>

    {/* SoftGlow separator (always present) */}
    <SoftGlowSeparator />

    {/* Flyout Panel */}
    <AnimatePresence>
      {panelItem && (panelItem.subItems || panelItem.customPanel) && (
        <>
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: panelItem.panelWidth || 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col overflow-hidden shrink-0 bg-white"
          >
            {panelItem.customPanel ? (
              panelItem.href === "/documents-organization" ? (
                <DocumentsOrganizationSidebar />
              ) : panelItem.href === "/cadernos" ? (
                <CadernosSidebar />
              ) : null
            ) : (
              <>
                <div className="p-4 pb-2">
                  <h3 className="text-gray-800 text-sm font-semibold">
                    {panelItem.label}
                  </h3>
                </div>
                <nav className="flex-1 overflow-auto px-2 py-1">
                  {panelItem.subItems!.map((sub) => (
                    <Link
                      key={sub.href}
                      to={sub.href}
                      className={cn(
                        "block px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
                        (sub.href === "/" ? location.pathname === sub.href : location.pathname.startsWith(sub.href))
                          ? "bg-blue-100 text-blue-800 font-medium"
                          : "text-gray-500 hover:bg-blue-50 hover:text-gray-700"
                      )}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </motion.div>
          <SoftGlowSeparator />
        </>
      )}
    </AnimatePresence>

    {/* Content area */}
    <div className="flex flex-1 min-w-0 bg-[#f8f9fb] flex-col overflow-hidden">
      {children}
    </div>
  </div>
)}
```

- [ ] **Step 2: Replace the mobile section**

Replace the mobile sections (lines 334-412 approximately) — change amber refs to blue:

```tsx
{isMobile && (
  <div className="flex flex-col h-screen w-full">
    <div className="flex h-10 px-4 py-4 items-center justify-between bg-white border-b border-gray-200 w-full shrink-0">
      <a href="/" className="flex items-center gap-2 text-gray-800 text-sm font-medium">
        <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-gradient-to-br from-[#1E40AF] to-[#3B82F6]" />
        Papiro
      </a>
      <IconMenu2
        className="text-gray-500 cursor-pointer"
        onClick={() => setMobileOpen(true)}
      />
    </div>
    <div className="flex-1 overflow-auto bg-[#f8f9fb]">
      {children}
    </div>
  </div>
)}
```

And the mobile overlay:
```tsx
<motion.div
  initial={{ x: "-100%", opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: "-100%", opacity: 0 }}
  transition={{ duration: 0.3, ease: "easeInOut" }}
  className="fixed inset-0 bg-gradient-to-t from-white via-blue-50/20 to-zinc-100 z-[100] flex flex-col p-6"
>
  <div className="flex justify-between items-center mb-8">
    <a href="/" className="flex items-center gap-2 text-gray-800 text-sm font-medium">
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-gradient-to-br from-[#1E40AF] to-[#3B82F6]" />
      Papiro
    </a>
    <IconX className="text-gray-500 cursor-pointer" onClick={() => setMobileOpen(false)} />
  </div>

  <nav className="flex flex-col gap-1">
    {allNavItems.map((item) => (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 py-3 px-3 rounded-lg transition-colors",
          isActive(item.href)
            ? "bg-blue-100 text-blue-700"
            : "text-gray-500 hover:bg-blue-50 hover:text-gray-700"
        )}
      >
        {item.icon}
        <span className="text-sm">{item.label}</span>
      </Link>
    ))}
  </nav>

  {user && (
    <div className="mt-auto pt-4 border-t border-gray-200">
      <div className="flex items-center gap-3 py-3 px-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_6px_rgba(30,64,175,0.25)] flex items-center justify-center">
          <span className="text-white text-xs font-semibold">
            {user.email?.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-sm text-gray-500">{user.email?.split("@")[0]}</span>
      </div>
      <button
        onClick={() => { setMobileOpen(false); handleLogout(); }}
        className="flex items-center gap-3 py-3 px-3 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors w-full"
      >
        <IconLogout className="h-5 w-5" />
        <span className="text-sm">Sair</span>
      </button>
    </div>
  )}
</motion.div>
```

- [ ] **Step 3: Verify dev server renders correctly**

Run: `npm run dev` (should already be running on localhost:3000)
Check: sidebar is white, active state is blue, glow separator visible, flyout works on Conteúdos/Cadernos

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat: redesign sidebar — light theme, flat layout, Royal Sapphire + SoftGlow"
```

---

### Task 3: Migrate Lei Seca — Art. prefix + annotations

**Files:**
- Modify: `src/components/lei-seca/GrifoText.tsx`
- Modify: `src/components/lei-seca/lei-anotacao-tooltip.tsx`
- Modify: `src/components/lei-seca/lei-seca-editor.tsx`
- Modify: `src/components/lei-seca/lei-ingestao-editor.tsx`
- Modify: `src/components/lei-seca/dispositivos/DispositivoGutter.tsx`
- Modify: `src/components/lei-seca/dispositivos/DispositivoFooter.tsx`
- Modify: `src/components/lei-seca/comments/DispositivoNote.tsx`

- [ ] **Step 1: Update GrifoText.tsx**

Replace `#b45309` → `#1E40AF` and rename `amberStyle` → `brandStyle`:

In `GrifoText.tsx`:
- Line 42: `color: '#b45309'` → `color: '#1E40AF'`
- Line 93: `const amberStyle = tipo === 'ARTIGO' ? { color: '#b45309' }` → `const brandStyle = tipo === 'ARTIGO' ? { color: '#1E40AF' }`
- Lines 96, 106: all `amberStyle` → `brandStyle`

- [ ] **Step 2: Update lei-anotacao-tooltip.tsx**

Replace `text-amber-400` → `text-blue-400` for the `alteracao` type.

- [ ] **Step 3: Update lei-seca-editor.tsx**

Replace all amber Tailwind classes with blue equivalents:
- `bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300` → `bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300`
- `fill-current text-amber-500` → `fill-current text-blue-500`

- [ ] **Step 4: Update lei-ingestao-editor.tsx**

Replace: `text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950` → `text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950`

- [ ] **Step 5: Update DispositivoGutter.tsx**

Replace: `bg-amber-500` → `bg-blue-500` (note dot)

- [ ] **Step 6: Update DispositivoFooter.tsx**

Replace all amber refs:
- `text-[#D97706] bg-[#FFFBEB] dark:text-amber-400 dark:bg-amber-950/30` → `text-[#2563EB] bg-[#EFF6FF] dark:text-blue-400 dark:bg-blue-950/30`
- `bg-amber-500` → `bg-blue-500`

- [ ] **Step 7: Update DispositivoNote.tsx**

Replace all amber Tailwind classes → blue equivalents:
- `amber-200/60` → `blue-200/60`
- `amber-800/40` → `blue-800/40`
- `amber-600` → `blue-600`
- `amber-500` → `blue-500`
- `amber-100/80` → `blue-100/80`
- `amber-900/30` → `blue-900/30`
- `amber-800/30` → `blue-800/30`
- `amber-950/10` → `blue-950/10`
- `amber-50/50` → `blue-50/50`
- `amber-200/50` → `blue-200/50`

- [ ] **Step 8: Verify Lei Seca renders**

Open `/lei-seca` in browser. Check:
- Art. prefix is deep blue `#1E40AF`
- Note dot is blue
- Footer buttons use blue
- Annotations tooltip uses blue

- [ ] **Step 9: Commit**

```bash
git add src/components/lei-seca/
git commit -m "feat: migrate lei-seca from amber to Royal Sapphire blue"
```

---

### Task 4: Migrate Questões components

**Files:**
- Modify: `src/components/questoes/QuestoesSearchBar.tsx`
- Modify: `src/components/questoes/QuestoesSlashInlineDropdown.tsx`
- Modify: `src/components/questoes/QuestoesFilterSheet.tsx`
- Modify: `src/components/questoes/QuestoesFilterPopover.tsx`
- Modify: `src/components/questoes/QuestoesFilterPill.tsx`
- Modify: `src/components/questoes/FilterChipsBidirectional.tsx`
- Modify: `src/components/questoes/QuestoesAdvancedPopover.tsx`
- Modify: `src/components/questoes/VirtualizedQuestionList.tsx`
- Modify: `src/components/questoes/comments/PrivateNote.tsx`
- Modify: `src/components/questoes/comments/EndorsedBadge.tsx`

All files in this task follow the same pattern — systematic replacement:

**Hex replacements in all files:**
- `#E8930C` → `#2563EB`
- `#B45309` → `#1E40AF`
- `#D97706` → `#2563EB`
- `#F59E0B` → `#3B82F6`
- `#FFFBEB` → `#EFF6FF`
- `rgba(232,147,12,` → `rgba(37,99,235,`

**Tailwind class replacements in all files:**
- `amber-50` → `blue-50` (including dark: variants)
- `amber-100` → `blue-100`
- `amber-200` → `blue-200`
- `amber-300` → `blue-300`
- `amber-400` → `blue-400`
- `amber-500` → `blue-500`
- `amber-600` → `blue-600`
- `amber-700` → `blue-700`
- `amber-800` → `blue-800`
- `amber-900` → `blue-900`
- `amber-950` → `blue-950`

- [ ] **Step 1: Migrate QuestoesSearchBar.tsx**

Apply all hex and Tailwind replacements. This file has ~15 occurrences of `#E8930C`. Also update the comment on line 571: `// ---- Is the input border in slash mode (amber) ----` → `// ---- Is the input border in slash mode (blue) ----`

- [ ] **Step 2: Migrate QuestoesSlashInlineDropdown.tsx**

Apply all hex replacements. ~10 occurrences of `#E8930C`.

- [ ] **Step 3: Migrate QuestoesFilterSheet.tsx**

Apply hex and Tailwind replacements. ~15 occurrences. Also update comment line 649: `{/* Footer — full-width amber Buscar button */}` → `{/* Footer — full-width blue Buscar button */}`

- [ ] **Step 4: Migrate QuestoesFilterPopover.tsx**

Apply hex and Tailwind replacements. ~7 occurrences.

- [ ] **Step 5: Migrate QuestoesFilterPill.tsx**

Replace `#E8930C` → `#2563EB` and `#B45309` → `#1E40AF`. 4 occurrences.

- [ ] **Step 6: Migrate FilterChipsBidirectional.tsx**

Replace `#E8930C` → `#2563EB`. 1 occurrence.

- [ ] **Step 7: Migrate QuestoesAdvancedPopover.tsx**

Replace `#E8930C` → `#2563EB` and amber Tailwind → blue. 3 occurrences.

- [ ] **Step 8: Migrate VirtualizedQuestionList.tsx**

Replace `amber-500/10` → `blue-500/10` and `amber-600` → `blue-600`. 1 occurrence.

- [ ] **Step 9: Migrate PrivateNote.tsx (questoes/comments)**

Replace all amber Tailwind classes → blue. ~10 occurrences.

- [ ] **Step 10: Migrate EndorsedBadge.tsx**

Replace `amber-600` → `blue-600`. 2 occurrences.

- [ ] **Step 11: Verify Questões page**

Open `/questoes` in browser. Check:
- Search bar slash mode uses blue
- Filter pills, popovers, sheets all blue
- Submit button on QuestionCard is blue

- [ ] **Step 12: Commit**

```bash
git add src/components/questoes/
git commit -m "feat: migrate questões components from amber to Royal Sapphire"
```

---

### Task 5: Migrate QuestionCard

**Files:**
- Modify: `src/components/QuestionCard.tsx`

This file has many amber references. Apply all hex and Tailwind replacements EXCEPT line 166 (difficulty "Medio" stays amber — it's a semantic green/amber/red scale).

- [ ] **Step 1: Apply all replacements**

Hex: `#E8930C` → `#2563EB`, `#D4860B` → `#1D4ED8`, `#D97706` → `#2563EB`, `#FFFBEB` → `#EFF6FF`, `rgba(232,147,12,` → `rgba(37,99,235,`

Tailwind: all `amber-*` → `blue-*` EXCEPT line 166 (`text-amber-600 dark:text-amber-400` and `bg-amber-500` for difficulty "Medio").

- [ ] **Step 2: Verify QuestionCard**

Open `/questoes`, click on a question. Check:
- Submit button is blue
- Bookmark icon hover is blue
- AI comment border is blue
- Difficulty "Medio" is still amber

- [ ] **Step 3: Commit**

```bash
git add src/components/QuestionCard.tsx
git commit -m "feat: migrate QuestionCard from amber to Royal Sapphire (keep semantic amber for difficulty)"
```

---

### Task 6: Migrate Conteúdos & Cadernos

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`
- Modify: `src/components/DocumentsOrganizationSidebar.tsx`
- Modify: `src/components/TopicItem.tsx`
- Modify: `src/components/SubtopicItem.tsx`
- Modify: `src/views/CadernosPage.tsx`
- Modify: `src/components/cadernos/CadernosSidebar.tsx`

- [ ] **Step 1: Migrate DocumentsOrganizationPage.tsx**

Replace `#E8930C` → `#2563EB` and all amber Tailwind → blue. ~7 occurrences.

- [ ] **Step 2: Migrate DocumentsOrganizationSidebar.tsx**

Replace `amber-600` → `blue-600`, `amber-50` → `blue-50`, `amber-700` → `blue-700`. 3 occurrences.

- [ ] **Step 3: Migrate TopicItem.tsx**

Replace `#E8930C` → `#2563EB`. 1 occurrence.

- [ ] **Step 4: Migrate SubtopicItem.tsx**

Replace `#E8930C` → `#2563EB` and amber → blue Tailwind. ~5 occurrences. Note: the star rating `text-[#E8930C]` → `text-[#2563EB]`.

- [ ] **Step 5: Migrate CadernosPage.tsx**

Replace all amber Tailwind → blue. ~12 occurrences.

- [ ] **Step 6: Migrate CadernosSidebar.tsx**

Replace `amber-500/10` → `blue-500/10`, `amber-700` → `blue-700`, `amber-400` → `blue-400`, `amber-500` → `blue-500`. ~3 occurrences.

- [ ] **Step 7: Verify both pages**

Open `/documents-organization` and `/cadernos`. Check stepper, topic selection, caderno tags all use blue.

- [ ] **Step 8: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx src/components/DocumentsOrganizationSidebar.tsx src/components/TopicItem.tsx src/components/SubtopicItem.tsx src/views/CadernosPage.tsx src/components/cadernos/CadernosSidebar.tsx
git commit -m "feat: migrate conteúdos & cadernos from amber to Royal Sapphire"
```

---

### Task 7: Migrate remaining shared components

**Files:**
- Modify: `src/components/DayWithProgress.tsx`
- Modify: `src/components/shared/comments/CommentItem.tsx`
- Modify: `src/components/AnimatedBackground.tsx`

- [ ] **Step 1: Migrate DayWithProgress.tsx**

Replace all `#E8930C` → `#2563EB`. Also replace the amber Tailwind classes:
- `shadow-[0_0_0_2px_rgba(232,147,12,0.2)]` → `shadow-[0_0_0_2px_rgba(37,99,235,0.2)]`
- `bg-[#E8930C]` → `bg-[#2563EB]`

Update comments: `// amber brand` → `// brand blue`

- [ ] **Step 2: Migrate CommentItem.tsx**

Replace `from-amber-400 to-amber-600` → `from-blue-400 to-blue-600` in avatar gradient, and `amber-600 bg-amber-50` → `blue-600 bg-blue-50`.

- [ ] **Step 3: Migrate AnimatedBackground.tsx**

Replace `text-amber-400` → `text-blue-400`.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayWithProgress.tsx src/components/shared/comments/CommentItem.tsx src/components/AnimatedBackground.tsx
git commit -m "feat: migrate shared components from amber to Royal Sapphire"
```

---

### Task 8: Final verification + cleanup

- [ ] **Step 1: Grep for any remaining amber brand references**

Run: `grep -rn "#E8930C\|#C47A0A\|#D4860B\|#b45309" src/ --include="*.tsx" --include="*.ts"`

Expected: Only hits in the semantic exception files (moderation, BlockBasedFlashcardEditor, QuestionCard line 166). If any other hits, fix them.

- [ ] **Step 2: Grep for remaining amber Tailwind in non-exception files**

Run: `grep -rn "amber-" src/ --include="*.tsx" --include="*.ts" | grep -v "moderation/" | grep -v "TopicConflict" | grep -v "BlockBasedFlashcard" | grep -v "UserAvatar" | grep -v "caderno.ts"`

Expected: Only QuestionCard.tsx line 166 (difficulty "Medio"). If any other hits, fix them.

- [ ] **Step 3: Run the build to check for errors**

Run: `npm run build:dev`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Visual smoke test**

Navigate through all major routes in browser:
- `/` (Dashboard)
- `/questoes` (Questões)
- `/lei-seca` (Lei Seca — check Art. prefix)
- `/documents-organization` (Conteúdos — check flyout)
- `/cadernos` (Cadernos — check flyout)
- `/flashcards` (Flashcards)
- `/cronograma` (Cronograma — check DayWithProgress)
- Mobile view (resize browser or DevTools)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final cleanup — resolve remaining amber references"
```
