# Plan 4 (v2): Form de Conclusão + Registrar Estudo + questoes_log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completion form (rápido + detalhado) for finishing cronograma items. "Registrar Estudo" in drawer for manual logging. Both log to questoes_log, update mastery_score, and trigger CSSL revision scheduling. Score snapshot created after each session.

**Architecture:** Single form component with two modes. Saves to questoes_log + updates topicos fields + creates score_snapshot. useStudyCompletion hook orchestrates: save → recalc mastery → schedule revision → snapshot score. Lazy local record creation for API topics on first interaction.

**Tech Stack:** React, Supabase, ts-fsrs, shadcn/ui

**Depends on:** Plan 1 (rename), Plan 2 (schema + hooks), Plan 3 (cronograma)

**Spec:** `docs/superpowers/specs/2026-04-08-editais-integration-v2-complete.md` (sections "Form de Conclusão", "Registro de Estudo Manual", "CSSL")

---

### Task 1: Create StudyCompletionForm Component

**Files:**
- Create: `src/components/documents-organization/StudyCompletionForm.tsx`

- [ ] **Step 1: Create form with two modes**

**Modo Rápido (default):**
- 3 big buttons: Fácil 😊 / Médio 😐 / Difícil 😓
- "Confirmar" button
- Total: 1 click + 1 confirmation

**Modo Detalhado ("Adicionar detalhes ›"):**
- Tempo real gasto (pre-filled with estimated, editable)
- Questões: acertos / erros (number inputs)
- Lei Seca: artigos lidos (text)
- Teoria finalizada (checkbox)
- Comentários (textarea, optional)
- FSRS preview when questions filled: "Baseado no desempenho, próxima revisão em ~X dias"

**Props:** `{ topicoNome, disciplinaNome, sessionType?, estimatedMinutes?, onSave(CompletionData), onCancel }`

**CompletionData type:**
```typescript
export interface CompletionData {
  autoAvaliacao: 'facil' | 'medio' | 'dificil';
  tempoReal?: number;
  questoesAcertos?: number;
  questoesErros?: number;
  leisLidas?: string;
  teoriaFinalizada?: boolean;
  comentarios?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/StudyCompletionForm.tsx
git commit -m "feat: create StudyCompletionForm with quick and detailed modes"
```

---

### Task 2: Create useStudyCompletion Hook

**Files:**
- Create: `src/hooks/useStudyCompletion.ts`

- [ ] **Step 1: Create orchestration hook**

Main function `completeStudy(params)`:
1. Ensure local topico exists (lazy via useEditalSnapshot if needed)
2. Log to `questoes_log` if questions were answered
3. Update `topicos` fields (tempo_investido += tempoReal, questoes_acertos +=, etc.)
4. Recalculate `mastery_score` (v1 formula: accuracy×0.60 + teoria×0.15 + tempo×0.15 + leis×0.10)
5. Update `learning_stage` based on mastery (0-20:new, 20-50:learning, 50-75:consolidating, 75-90:maintaining, 90+:mastered)
6. Mark schedule_item as completed (if from cronograma)
7. Calculate FSRS rating:
   - Quick mode: auto-avaliação → Rating directly (facil=Easy, medio=Good, dificil=Hard)
   - Detailed mode with questions: combined rating (questions×0.50 + speed×0.20 + discrimination×0.20 + auto×0.10)
8. Create score_snapshot (basic v1: current score based on mastery scores)

Function `adaptCronograma(topicoId)`:
- If manual study registered for a topic that has a future scheduled item → mark as completed or convert to revision
- TODO v2: redistribute freed time

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useStudyCompletion.ts
git commit -m "feat: add useStudyCompletion with mastery recalc and CSSL scheduling"
```

---

### Task 3: Add "Registrar Estudo" to TopicDetailDrawer

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Add button and form**

Import form + hook. Add state for `showCompletionForm`.

"Registrar Estudo" button always visible in drawer (after materials section).

On save: call `completeStudy()` with context (apiTopicoId, disciplinaNome, etc.). Close form. Refresh drawer data.

For API-sourced topics (no local record yet): the hook creates the local record lazily before saving progress.

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/TopicDetailDrawer.tsx
git commit -m "feat: add 'Registrar Estudo' with completion form to drawer"
```

---

### Task 4: Wire Form to CronogramaDayView

**Files:**
- Modify: `src/components/documents-organization/CronogramaDayView.tsx`

- [ ] **Step 1: Add "Finalizar" button and completion flow**

Add state `completingItem`. When "Finalizar" clicked on an activity → show StudyCompletionForm with session context (type, duration, topic).

On save: call `completeStudy()` with `scheduleItemId`. Activity card transitions to completed state. Progress bar updates.

After completion, show brief toast: "Registrado! Próxima revisão em X dias."

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/CronogramaDayView.tsx
git commit -m "feat: wire completion form to cronograma activities"
```

---

### Task 5: Verify

- [ ] **Step 1: Test drawer** — click "Registrar Estudo" → form opens → quick mode works → saves
- [ ] **Step 2: Test detailed mode** — expand → fill questions → FSRS preview shows → saves
- [ ] **Step 3: Test cronograma** — click "Finalizar" on activity → form → saves → activity marked done
- [ ] **Step 4: Check database** — questoes_log has entries, topicos.mastery_score updated, score_snapshots created
- [ ] **Step 5: `npm run lint && npm run build`**
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete study completion and registration flow with v2 infrastructure"
```
