# Plan 3 (v2): Cronograma Mode — Toggle + Calendar + Day Planner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toggle Edital/Cronograma in DisciplinesSidebar. Cronograma mode shows full calendar in sidebar and day planner in main area with typed activities (Estudo, Revisão, Questões, Lei Seca). Activities are composed sessions (ready for v2 session structure).

**Architecture:** Toggle state in context. Sidebar swaps between disciplina list and calendar. Main area swaps between topic cards and CronogramaDayView. Day planner shows schedule_items with activity type badges. "Iniciar" transitions back to edital mode with topic selected.

**Tech Stack:** React, Tailwind CSS, Supabase (schedule_items)

**Depends on:** Plan 1 (rename), Plan 2 (schema + planos)

**Spec:** `docs/superpowers/specs/2026-04-08-editais-integration-v2-complete.md` (sections "Cronograma", "Sessão de Estudo Composta")

---

### Task 1: Add Cronograma State to Context

**Files:**
- Modify: `src/contexts/DocumentsOrganizationContext.tsx`

- [ ] **Step 1: Add state**

```typescript
// Add to context type:
cronogramaMode: boolean;
setCronogramaMode: (mode: boolean) => void;
cronogramaSelectedDate: Date | null;
setCronogramaSelectedDate: (date: Date | null) => void;
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/DocumentsOrganizationContext.tsx
git commit -m "feat: add cronogramaMode state to context"
```

---

### Task 2: Add Toggle to DisciplinesSidebar

**Files:**
- Modify: `src/components/documents-organization/DisciplinesSidebar.tsx`

- [ ] **Step 1: Add segmented control at top**

```tsx
<div className="mx-2 mt-2 mb-3 flex bg-muted rounded-lg p-1 border border-border">
  <button
    onClick={() => setCronogramaMode(false)}
    className={`flex-1 text-center py-1.5 rounded-md text-xs font-medium transition-all ${
      !cronogramaMode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
    }`}
  >
    📋 Edital
  </button>
  <button
    onClick={() => setCronogramaMode(true)}
    className={`flex-1 text-center py-1.5 rounded-md text-xs font-medium transition-all ${
      cronogramaMode ? 'bg-zinc-900 text-white shadow-sm' : 'text-muted-foreground'
    }`}
  >
    📅 Cronograma
  </button>
</div>
```

- [ ] **Step 2: Conditionally render sidebar content**

When cronogramaMode: render `<CronogramaCalendarSidebar />`.
When not: render existing disciplinas list.

- [ ] **Step 3: Commit**

```bash
git add src/components/documents-organization/DisciplinesSidebar.tsx
git commit -m "feat: add Edital/Cronograma toggle to DisciplinesSidebar"
```

---

### Task 3: Create CronogramaCalendarSidebar

**Files:**
- Create: `src/components/documents-organization/CronogramaCalendarSidebar.tsx`

- [ ] **Step 1: Create component with full month calendar**

Uses existing `DayWithProgress` component. Full month grid filling the sidebar. Selected day shows stats summary below calendar. Navigation (prev/next month). Color coding: green=completed, indigo=scheduled, red=exam day.

For v1: uses mock data via `getMockDayData()` (same pattern as existing sidebar).
TODO comments for v2: replace with real schedule_items query.

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaCalendarSidebar.tsx
git commit -m "feat: create CronogramaCalendarSidebar with month calendar"
```

---

### Task 4: Create CronogramaDayView

**Files:**
- Create: `src/components/documents-organization/CronogramaDayView.tsx`

- [ ] **Step 1: Create day planner component**

Header: date, activity count, total time, progress bar.

Activity cards with TYPE badges:
- 📖 Estudo (Parte 1 / Parte 2) — blue accent
- 🔄 Revisão N — amber accent
- ❓ Questões — orange accent
- ⚖️ Lei Seca — cyan accent

Each card shows: type icon, topic name, disciplina, duration, context (e.g., "CF Art. 5°"), status.

Card states:
- Completed: green border, opaque, check mark, strikethrough
- Next: black border, shadow, "Iniciar" + "Adiar" buttons
- Pending: gray border, no actions

For v1: mock activities based on date seed (same pattern as existing code).
TODO comments for v2: real schedule_items query, session composition.

Empty state: "Nenhuma atividade agendada para este dia"

`onStartActivity(item)` callback: switches cronogramaMode off and selects the topic.

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaDayView.tsx
git commit -m "feat: create CronogramaDayView with typed activity cards"
```

---

### Task 5: Wire into DocumentsOrganizationPage

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Conditional render based on cronogramaMode**

When `cronogramaMode && cronogramaSelectedDate`: render `<CronogramaDayView />`.
When `cronogramaMode && !cronogramaSelectedDate`: render empty state "Selecione um dia".
When `!cronogramaMode`: render existing view.

`onStartActivity`: sets `cronogramaMode = false`, selects the topic in context.

- [ ] **Step 2: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx
git commit -m "feat: wire cronograma mode into main page"
```

---

### Task 6: Verify

- [ ] **Step 1: Test toggle** — click Edital/Cronograma, sidebar swaps
- [ ] **Step 2: Test calendar** — click day, main area shows day planner
- [ ] **Step 3: Test "Iniciar"** — returns to edital mode with topic selected
- [ ] **Step 4: No regressions** — edital mode works as before
- [ ] **Step 5: `npm run lint && npm run build`**
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete cronograma mode with toggle, calendar, and day planner"
```
