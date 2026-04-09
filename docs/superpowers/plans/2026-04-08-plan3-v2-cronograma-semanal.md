# Plan 3 (v2): Cronograma Semanal — Cockpit de Estudo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the weekly cronograma cockpit: toggle Edital/Cronograma that replaces the 3-level edital view with a unified weekly task list, 4 progress rings, score display, quick session buttons, and tabbed secondary info (Insights, Sessions, "What If").

**Architecture:** Toggle state in context. When cronograma mode is active, the DocumentsOrganizationPage renders CronogramaWeekView instead of the edital layout. The week's tasks come from schedule_items (or mock data for v1). Tasks are displayed in a single list with suggested items highlighted. Secondary info in tabs. Uses the app's purple palette (#6c63ff).

**Tech Stack:** React, Tailwind CSS, Supabase (schedule_items), SVG rings

**Depends on:** Plan 1 (rename), Plan 2 (schema + planos)

**Spec:** `docs/superpowers/specs/2026-04-08-editais-integration-v2-complete.md` (section "Cronograma Semanal — Cockpit de Estudo")

---

### Task 1: Add Cronograma State to Context

**Files:**
- Modify: `src/contexts/DocumentsOrganizationContext.tsx`

- [ ] **Step 1: Add state to context type and provider**

```typescript
// Add to context type:
cronogramaMode: boolean;
setCronogramaMode: (mode: boolean) => void;
cronogramaWeek: Date; // Monday of selected week
setCronogramaWeek: (date: Date) => void;
```

Initialize `cronogramaWeek` to current week's Monday.

- [ ] **Step 2: Commit**

```bash
git add src/contexts/DocumentsOrganizationContext.tsx
git commit -m "feat: add cronogramaMode and cronogramaWeek state to context"
```

---

### Task 2: Create ProgressRing Component

**Files:**
- Create: `src/components/documents-organization/ProgressRing.tsx`

- [ ] **Step 1: Create SVG ring component**

Props: `{ value: number, max: number, color: string, size?: number, label: string }`

Renders an SVG circle with:
- Background track: `#eeecfb`
- Progress arc: `color` prop (from palette)
- Center text: `{value}/{max}`
- Label below: `{label}`

Size default: 44px. Stroke width: 3px. Stroke-linecap: round.

Use the formula:
```
circumference = 2 * PI * radius
dashoffset = circumference * (1 - value/max)
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/ProgressRing.tsx
git commit -m "feat: create ProgressRing SVG component"
```

---

### Task 3: Create WeekSelector Component

**Files:**
- Create: `src/components/documents-organization/WeekSelector.tsx`

- [ ] **Step 1: Create week navigation component**

Props: `{ week: Date, onChange: (date: Date) => void }`

Renders: `‹` button + "7–13 Abril" label + `›` button

Helper functions:
- `getMonday(date)` — returns Monday of the week
- `formatWeekLabel(monday)` — "7–13 Abril"
- Navigation: prev/next shifts by 7 days

Style: matches existing app buttons (border: var(--border), border-radius: 6px).

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/WeekSelector.tsx
git commit -m "feat: create WeekSelector navigation component"
```

---

### Task 4: Create CronogramaWeekView (main component)

**Files:**
- Create: `src/components/documents-organization/CronogramaWeekView.tsx`

- [ ] **Step 1: Create the full cockpit component**

This is the main component rendered when `cronogramaMode = true`. Layout (centered, same margins as edital mode):

**Structure:**
```tsx
<div className="max-w-5xl mx-auto py-6 px-8">
  {/* Rings + Score */}
  <RingsScoreSection />
  
  {/* Week progress bar */}
  <WeekProgressBar />
  
  {/* Quick session + Tabs */}
  <QuickSessionBar />
  
  {/* Active tab content */}
  {activeTab === 'tarefas' && <TaskList />}
  {activeTab === 'insights' && <InsightsPanel />}
  {activeTab === 'sessoes' && <SessionsPanel />}
  {activeTab === 'whatif' && <WhatIfPanel />}
  
  {/* Footer */}
  <Footer />
</div>
```

**RingsScoreSection:** 4 ProgressRing components + nota estimada (gradient text) + trend + days badge. Background: `linear-gradient(180deg, #f5f3ff, #fff)`.

**WeekProgressBar:** Linear bar with gradient fill (#6c63ff → #9b8afb). Label "Semana" + "13/18".

**QuickSessionBar:** Two buttons ("Sessão automática · 50min" primary, "Rápida · 25min" ghost) + 4 tabs (Tarefas | Insights | Sessões | E se?). Active tab: bottom border #6c63ff.

**TaskList:** Single unified list. Each task is a row with:
- Checkbox (circle, 17px, border: var(--text-4), done: filled #6c63ff)
- Title (13px, font-weight 600)
- Meta (10px, discipline + context + deadline? + points)
- Right: type label (text, 10px, gray) + duration (11px, semibold) + "Iniciar" button (hidden, shows on hover or always on suggested)
- Suggested: bg #f5f3ff, border-left 2.5px #6c63ff
- Done: opacity 0.28, check filled, title strikethrough
- Hint at top: "Itens em destaque são sugeridos para hoje" (9px, gray)

For v1: generate mock tasks based on week date (deterministic seed pattern, same approach as existing mock data). Mark TODO for real schedule_items integration.

**InsightsPanel:** 3 cards in grid (weakness, evolution, projection). Background #f5f3ff, border #f0eef5.

**SessionsPanel:** List of recent sessions (time, desc, points).

**WhatIfPanel:** Range slider + result display. Thumb color: #6c63ff.

**Footer:** Background #f5f3ff, "Fechar anéis: +4.7 pts · Projeção: 80.7" + edital ref.

All colors use the purple palette (#6c63ff, #9b8afb, #f5f3ff, #eeecfb, #f8f7fd).

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaWeekView.tsx
git commit -m "feat: create CronogramaWeekView cockpit with rings, list, and tabs"
```

---

### Task 5: Wire Toggle into Page

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Add toggle at top of page**

Before the main content, render the Edital/Cronograma toggle:
```tsx
<div className="max-w-5xl mx-auto px-8 pt-4">
  {/* Toggle */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex bg-[#f5f3ff] rounded-[9px] p-[2.5px]">
      <button onClick={() => setCronogramaMode(false)} className={...}>Edital</button>
      <button onClick={() => setCronogramaMode(true)} className={...}>Cronograma</button>
    </div>
    {/* Week nav (only in cronograma) or edital info */}
  </div>
</div>
```

- [ ] **Step 2: Conditional render main content**

```tsx
{cronogramaMode ? (
  <CronogramaWeekView />
) : (
  // Existing edital layout (TOC + disciplinas + topics)
  <>{/* ... existing code ... */}</>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx
git commit -m "feat: wire cronograma toggle and weekly view into page"
```

---

### Task 6: Add schedule_items Week Query Hook

**Files:**
- Create: `src/hooks/useWeekSchedule.ts`

- [ ] **Step 1: Create hook for weekly schedule data**

Queries schedule_items for a given week (Monday-Sunday). Returns typed activities with status.

For v1: returns mock data (same pattern as existing getMockDayData but weekly). TODO comments for real Supabase query.

Interface:
```typescript
interface WeekActivity {
  id: string;
  title: string;
  disciplina: string;
  type: 'estudo' | 'revisao' | 'questoes' | 'lei-seca';
  durationMinutes: number;
  completed: boolean;
  suggested: boolean; // system suggests for today
  deadlineDate?: string; // soft deadline within week
  pointsValue: number;
  context?: string; // "CF Art. 5°", "15 questões", etc.
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useWeekSchedule.ts
git commit -m "feat: add useWeekSchedule hook (mock data, ready for real schedule_items)"
```

---

### Task 7: Verify

- [ ] **Step 1: Test toggle** — click Edital/Cronograma, view swaps
- [ ] **Step 2: Test rings** — 4 rings render with correct progress
- [ ] **Step 3: Test list** — all tasks visible, suggested highlighted, done faded
- [ ] **Step 4: Test tabs** — switching between Tarefas/Insights/Sessões/E se?
- [ ] **Step 5: Test week nav** — prev/next week changes data
- [ ] **Step 6: No regressions** — edital mode works as before
- [ ] **Step 7: `npm run lint && npm run build`**
- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: complete weekly cronograma cockpit with rings, unified list, and tabs"
```
