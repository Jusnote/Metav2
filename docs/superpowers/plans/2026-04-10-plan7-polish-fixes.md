# Plan 7: Polish + Fixes — Completar v1 para Produção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining bugs, performance issues, and missing UX to make v1 production-ready. Each task is independent unless noted.

**Tech Stack:** React, Supabase, React Query, TypeScript, shadcn/ui

---

### Task 1: Fix Plan Card Progress Bar (real data)

**Files:**
- Modify: `src/views/EditaisPage.tsx`

The plan card progress bar is hardcoded `width: '0%'`. Connect to real data:

- [ ] **Step 1:** For each plan, query the count of topicos with `origin_topico_ref` matching the plan's edital topics, and how many have `mastery_score > 0`. Calculate percentage.
- [ ] **Step 2:** Show real percentage in the progress bar + add a small text "X/Y tópicos" next to the plan info.
- [ ] **Step 3:** Use React Query with key `['plan-progress', plano.id]` for caching.
- [ ] **Step 4:** Commit.

---

### Task 2: Parallel API Fetch (performance)

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

The `useEffect` that loads tópicos for each disciplina uses a sequential `for` loop with `await editaisQuery()` inside. Change to `Promise.all`:

- [ ] **Step 1:** Replace the sequential loop:
```typescript
// OLD: sequential
for (const disc of apiDisciplinas) {
  const { data } = await editaisQuery(...);
  // ...
}

// NEW: parallel
const results = await Promise.all(
  apiDisciplinas.map(disc => editaisQuery<{ topicos: ApiTopico[] }>(TOPICOS_QUERY, { disciplinaId: disc.id }))
);
// Then map results to disciplinas
```
- [ ] **Step 2:** Commit.

---

### Task 3: Fix questoes_log — 1 Row Per Session

**Files:**
- Modify: `src/hooks/useStudyCompletion.ts`

Currently creates N rows (1 per acerto + 1 per erro). Change to 1 row per registration:

- [ ] **Step 1:** Replace the loop:
```typescript
// OLD: N rows
for (let i = 0; i < params.data.questoesAcertos; i++) {
  await supabase.from('questoes_log').insert({ correto: true, ... });
}

// NEW: 1 row with counts
if ((params.data.questoesAcertos || 0) + (params.data.questoesErros || 0) > 0) {
  await supabase.from('questoes_log').insert({
    user_id: user.id,
    topico_id: topicoId,
    correto: true, // primary result: majority correct?
    tempo_resposta: null,
    dificuldade: null,
    questoes_acertos: params.data.questoesAcertos || 0, // custom fields
    questoes_erros: params.data.questoesErros || 0,
    created_at: new Date().toISOString(),
  });
}
```
Note: `questoes_log` table may need `questoes_acertos` and `questoes_erros` columns added. If not possible, keep single row with `correto = (acertos > erros)` and store details in a JSONB field or just simplify to 1 row.

- [ ] **Step 2:** Commit.

---

### Task 4: Chart Shows Per-Session Bars

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

CompactRevisionsChart currently receives aggregate acertos/erros. Change to query `questoes_log` for per-session data:

- [ ] **Step 1:** Create a hook or inline query that fetches recent questoes_log entries for this topic, grouped by date/session.
- [ ] **Step 2:** Each bar in the chart = 1 session (date + acertos + erros).
- [ ] **Step 3:** Max 6 bars visible (latest 6 sessions).
- [ ] **Step 4:** If only 1 session, show 1 bar (current behavior is fine).
- [ ] **Step 5:** Commit.

---

### Task 5: Edit/Delete Plan

**Files:**
- Modify: `src/views/EditaisPage.tsx` (plan cards)
- Modify: `src/views/DocumentsOrganizationPage.tsx` (header badge)

- [ ] **Step 1:** Add a small "..." menu (dropdown) on each plan card with: "Editar nome", "Definir data da prova", "Excluir plano".
- [ ] **Step 2:** "Excluir" shows confirmation dialog → calls `deletePlano(id)` → toast "Plano excluído".
- [ ] **Step 3:** In the edital header, the plan badge also gets a small edit/delete option.
- [ ] **Step 4:** Commit.

---

### Task 6: Loading State in Drawer

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1:** While `useLocalProgress` is loading (`isLoading = true`), show a subtle skeleton/shimmer instead of flashing blur → no blur.
- [ ] **Step 2:** The skeleton should match the layout of the stats section (same height, gray rectangles).
- [ ] **Step 3:** Commit.

---

### Task 7: Cronograma — Differentiate "No Plan" vs "Plan Without Schedule"

**Files:**
- Modify: `src/components/documents-organization/CronogramaWeekView.tsx`

- [ ] **Step 1:** Check for: (a) no plans at all, (b) plans exist but no schedule_items.
- [ ] **Step 2:** State A: "Crie um plano de estudo para ativar o cronograma" + "Explorar Editais" button.
- [ ] **Step 3:** State B: "Plano criado! Configure seu cronograma para distribuir as atividades na semana" + "Configurar Cronograma" button (opens GoalCreationDialog or similar).
- [ ] **Step 4:** Commit.

---

### Task 8: Plan Cards — Show Edital/Cargo Info + Responsive

**Files:**
- Modify: `src/views/EditaisPage.tsx`

- [ ] **Step 1:** Each plan card shows the edital sigla + cargo name below the plan name (smaller text). The data comes from `plano.editais[0]` → need to query the API for sigla/cargo name, or store it in the plan at creation time.
- [ ] **Step 2:** Simplest: store edital name + cargo name in plano metadata at creation time (add fields to `planos_estudo` or store as JSON).
- [ ] **Step 3:** Responsive: on screens < 768px, stack cards vertically instead of grid.
- [ ] **Step 4:** Commit.

---

### Task 9: Stabilize displayDisciplinas Reference (performance)

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1:** The `apiConvertedDisciplinas` state is set inside a `useEffect` that runs when `apiDisciplinas` changes. But `apiDisciplinas` from React Query might create new array references even with same data. Add a `useMemo` or use React Query's `structuralSharing` to stabilize.
- [ ] **Step 2:** The `allOriginRefs` useMemo depends on `displayDisciplinas` — ensure it only recalculates when actual data changes, not on reference changes.
- [ ] **Step 3:** Commit.

---

### Task 10: Split DocumentsOrganizationPage (code quality)

**Files:**
- Create: `src/components/documents-organization/EditalHeader.tsx`
- Create: `src/components/documents-organization/EditalTopicList.tsx`
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1:** Extract the edital header (cargo name, plan CTA, score display) into `EditalHeader`.
- [ ] **Step 2:** Extract the topic list (disciplinas → topics → rows) into `EditalTopicList`.
- [ ] **Step 3:** The page becomes a thin orchestrator: toggle + conditional render + Sheet + modals.
- [ ] **Step 4:** Commit.

---

### Task 11: Pre-fill Form Context

**Files:**
- Modify: `src/components/documents-organization/StudyCompletionForm.tsx`

- [ ] **Step 1:** Accept `sessionType` prop and show it as a badge in the form header: "Estudo", "Revisão", "Questões", "Lei Seca".
- [ ] **Step 2:** Pre-fill `estimatedMinutes` visibly in the form (currently passed as prop but not shown to user in quick mode).
- [ ] **Step 3:** Commit.

---

### Task 12: Verify Everything

- [ ] **Step 1:** `npm run lint && npm run build`
- [ ] **Step 2:** Test: plan cards show real progress bars
- [ ] **Step 3:** Test: edital loads faster (parallel fetch)
- [ ] **Step 4:** Test: register study → toast → drawer updates → list updates (React Query)
- [ ] **Step 5:** Test: plan edit/delete works
- [ ] **Step 6:** Test: cronograma shows correct empty state per scenario
- [ ] **Step 7:** Commit any fixes.
