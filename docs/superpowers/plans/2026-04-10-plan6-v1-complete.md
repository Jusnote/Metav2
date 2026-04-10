# Plan 6: Completar v1 — Feedback Loop + Dados Reais + Plano + Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform v1 from a static demo into a working app where the student registers study → sees progress → feels motivated → studies more. Connect all mock/hardcoded data to real Supabase data. Add "Criar Plano" CTA. Migrate references from `api_*_id` to `origin_*_ref` for stability.

**Architecture:** Same data flow (API structure + Supabase progress). This plan fixes the feedback loop, connects real data, and adds missing CTAs. Prepares all infrastructure for v2.

**Tech Stack:** React, Supabase, React Query, shadcn/ui toast (sonner), TypeScript

**Depends on:** Plans 1-5 completed.

**Spec:** `docs/superpowers/specs/2026-04-08-editais-integration-v2-complete.md`

---

### Task 1: Migration — Rename `api_*_id` to `origin_*_ref`

**Files:**
- Create: `supabase/migrations/20260410000001_rename_api_refs_to_origin.sql`

- [ ] **Step 1: Create migration**

```sql
-- Rename reference columns for stability and neutrality
-- origin_ref = stable external reference, never changes on reimport

ALTER TABLE disciplinas RENAME COLUMN api_disciplina_id TO origin_disciplina_ref;
ALTER TABLE topicos RENAME COLUMN api_topico_id TO origin_topico_ref;

-- Update indexes
DROP INDEX IF EXISTS idx_disciplinas_api;
CREATE INDEX idx_disciplinas_origin ON disciplinas(origin_disciplina_ref) WHERE origin_disciplina_ref IS NOT NULL;

DROP INDEX IF EXISTS idx_topicos_api;
CREATE INDEX idx_topicos_origin ON topicos(origin_topico_ref) WHERE origin_topico_ref IS NOT NULL;
```

- [ ] **Step 2: Update all TypeScript references**

Find and replace across codebase:
- `api_disciplina_id` → `origin_disciplina_ref`
- `api_topico_id` → `origin_topico_ref`
- `apiDisciplinaId` → `originDisciplinaRef`
- `apiTopicoId` → `originTopicoRef`
- `_apiId` → `_originRef`
- `_apiDisciplinaId` → `_originDisciplinaRef`

Files affected:
- `src/hooks/useEditalSnapshot.ts`
- `src/hooks/useEditaisData.ts` (types)
- `src/hooks/useStudyCompletion.ts`
- `src/hooks/useQuestoesLog.ts`
- `src/views/DocumentsOrganizationPage.tsx`
- `src/types/database.ts`

- [ ] **Step 3: API queries request `fonteId`**

Update GraphQL queries in `src/hooks/useEditaisData.ts` to request `fonteId`:
```graphql
query Disciplinas($cargoId: Int!) {
  disciplinas(cargoId: $cargoId) { id fonteId nome nomeEdital totalTopicos }
}
query Topicos($disciplinaId: Int!) {
  topicos(disciplinaId: $disciplinaId) { id fonteId nome ordem }
}
```

**NOTE:** This requires the API to expose `fonteId` in the GraphQL schema. The user (API owner) must add this field to the API before this task.

When converting API data to local format, use `fonteId` (not `id`) for `origin_*_ref`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename api_*_id to origin_*_ref for stable external references"
```

---

### Task 2: Install Toast (sonner) + Create Toast Utility

**Files:**
- Install: `shadcn add sonner` (or manual)
- Create: toast utility

- [ ] **Step 1: Install sonner**

```bash
shadcn add sonner --package-manager npm
```

If CLI fails, install manually:
```bash
npm install sonner
```

And add `<Toaster />` to the app layout (App.tsx), after the providers.

- [ ] **Step 2: Verify toast works**

Test with: `toast.success("Test")` from any component.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add toast notifications (sonner)"
```

---

### Task 3: Fix hasProgress Detection + Create useLocalProgress Hook

**Files:**
- Create: `src/hooks/useLocalProgress.ts`
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Create useLocalProgress hook**

This hook queries Supabase for local records matching API topic IDs. Used by the drawer and the topic list.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocalProgress {
  id: string;
  origin_topico_ref: number;
  mastery_score: number;
  learning_stage: string;
  question_accuracy: number;
  questions_total: number;
  questoes_acertos: number;
  questoes_erros: number;
  tempo_investido: number;
  teoria_finalizada: boolean;
  leis_lidas: string | null;
  last_access: string | null;
  completed_at: string | null;
}

export function useLocalProgress(originTopicoRef: number | null) {
  const [progress, setProgress] = useState<LocalProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!originTopicoRef) { setProgress(null); return; }
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const { data } = await supabase
      .from('topicos')
      .select('*')
      .eq('user_id', user.id)
      .eq('origin_topico_ref', originTopicoRef)
      .maybeSingle();

    setProgress(data as LocalProgress | null);
    setIsLoading(false);
  }, [originTopicoRef]);

  useEffect(() => { fetch(); }, [fetch]);

  return { progress, isLoading, refetch: fetch };
}

// Batch version for the topic list
export function useLocalProgressBatch(originRefs: number[]) {
  const [progressMap, setProgressMap] = useState<Map<number, LocalProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (originRefs.length === 0) { setProgressMap(new Map()); return; }
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const { data } = await supabase
      .from('topicos')
      .select('*')
      .eq('user_id', user.id)
      .in('origin_topico_ref', originRefs);

    const map = new Map<number, LocalProgress>();
    if (data) {
      for (const row of data) {
        if (row.origin_topico_ref) map.set(row.origin_topico_ref, row as LocalProgress);
      }
    }
    setProgressMap(map);
    setIsLoading(false);
  }, [originRefs.join(',')]);

  useEffect(() => { fetch(); }, [fetch]);

  return { progressMap, isLoading, refetch: fetch };
}
```

- [ ] **Step 2: Use in drawer — fix hasProgress**

In TopicDetailDrawer's DrawerInnerContent, replace the hardcoded `hasProgress` check:

```typescript
// OLD (broken):
const hasProgress = !item.id.startsWith('api-') && ((item as any).tempo_investido > 0 || ...);

// NEW:
const { progress, refetch: refetchProgress } = useLocalProgress((item as any)._originRef || null);
const hasProgress = progress !== null && (progress.tempo_investido > 0 || progress.questoes_acertos > 0 || progress.completed_at !== null);
```

Pass `refetchProgress` to the completion form so it can refresh after registering.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add useLocalProgress hook — fix hasProgress for API topics"
```

---

### Task 4: Refresh After "Registrar Estudo" + Toast

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`
- Modify: `src/hooks/useStudyCompletion.ts`

- [ ] **Step 1: Fix quick mode to generate meaningful data**

In `useStudyCompletion.completeStudy()`, when `tempoReal` is not provided (quick mode):
```typescript
const tempoReal = params.data.tempoReal || params.estimatedMinutes || 30; // default 30min
```

Also, for first-time study in quick mode, set `teoria_finalizada = true`:
```typescript
if (!topico?.teoria_finalizada && !params.data.teoriaFinalizada) {
  updates.teoria_finalizada = true; // First study assumes theory was covered
}
```

- [ ] **Step 2: Add toast after completion**

In DrawerInnerContent, after `completeStudy()` succeeds:
```typescript
import { toast } from 'sonner';

// After completeStudy returns true:
toast.success(`Estudo registrado! Mastery: ${mastery}%`);
refetchProgress(); // refresh the local progress data
setShowCompletionForm(false);
```

On error:
```typescript
toast.error('Erro ao registrar estudo. Tente novamente.');
```

- [ ] **Step 3: Drawer updates after refresh**

When `refetchProgress()` completes, the `progress` state updates → `hasProgress` becomes true → blur lifts → stats show real data. This happens automatically because `useLocalProgress` updates its state.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: toast feedback + auto-refresh drawer after registering study"
```

---

### Task 5: Connect Drawer Stats to Real Data

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Use `progress` data in stats**

Replace hardcoded/mock values with real data from `progress`:

```typescript
// Stats row
const realLastAccess = progress?.last_access;
const realTempoInvestido = progress?.tempo_investido || 0;

// Mastery badge
const realMasteryScore = progress?.mastery_score || 0;
const realLearningStage = progress?.learning_stage || 'new';

// CompactRevisionsChart
const realAcertos = progress?.questoes_acertos || 0;
const realErros = progress?.questoes_erros || 0;
```

- [ ] **Step 2: CompactRevisionsChart with real data**

Accept props instead of hardcoded data:
```typescript
function CompactRevisionsChart({ acertos, erros, totalRevisoes }: {
  acertos: number;
  erros: number;
  totalRevisoes: number;
}) {
  const avg = (acertos + erros) > 0 ? Math.round((acertos / (acertos + erros)) * 100) : 0;
  // If no data, show empty state
  if (acertos === 0 && erros === 0) {
    return (
      <div className="text-center py-4 text-[11px] text-[#9e99ae]">
        Registre seu primeiro estudo para ver o desempenho
      </div>
    );
  }
  // Otherwise show chart with real data
  // ... existing chart code but with real data
}
```

- [ ] **Step 3: IA contextual based on real data**

Replace hardcoded AI text:
```typescript
function getAIInsight(masteryScore: number, learningStage: string): string {
  if (masteryScore === 0) return 'Comece a estudar este tópico para receber insights personalizados.';
  if (masteryScore < 30) return 'Tópico em fase inicial. Foque na teoria e questões básicas.';
  if (masteryScore < 50) return 'Progresso inicial. Continue com questões de dificuldade média.';
  if (masteryScore < 75) return 'Bom progresso. Aumente a dificuldade e pratique discriminação entre conceitos.';
  if (masteryScore < 90) return 'Próximo de dominar. Revise os pontos que mais erra e faça questões difíceis.';
  return 'Tópico dominado! Mantenha revisões periódicas para não esquecer.';
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: connect drawer stats, chart, and IA to real Supabase data"
```

---

### Task 6: Progress Indicators in Topic List

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Batch query progress on page load**

When in edital mode, after API data loads, get all `origin_topico_ref` values and batch query local progress:

```typescript
import { useLocalProgressBatch } from '@/hooks/useLocalProgress';

// Collect all origin refs from API data
const allOriginRefs = useMemo(() => {
  return displayDisciplinas.flatMap(d =>
    d.topicos.map(t => (t as any)._originRef).filter(Boolean)
  );
}, [displayDisciplinas]);

const { progressMap } = useLocalProgressBatch(allOriginRefs);
```

- [ ] **Step 2: Show progress in each topic row**

For each topic in the list, check `progressMap`:
```typescript
const originRef = (topico as any)._originRef;
const topicProgress = originRef ? progressMap.get(originRef) : null;

// Dot color based on progress
const dotColor = topicProgress
  ? topicProgress.learning_stage === 'mastered' ? 'bg-emerald-500'
    : topicProgress.learning_stage === 'maintaining' ? 'bg-[#6c63ff]'
    : topicProgress.mastery_score > 0 ? 'bg-[#9b8afb]'
    : 'bg-[#d4d0de]'
  : 'bg-[#d4d0de]';

// Optional: show mastery percentage
const masteryLabel = topicProgress && topicProgress.mastery_score > 0
  ? `${Math.round(topicProgress.mastery_score)}%`
  : null;
```

Apply `dotColor` to the dot element. Show `masteryLabel` as subtle text next to the duration.

- [ ] **Step 3: "Próximo tópico" suggestion after registrar**

After study is registered, show a subtle suggestion at the bottom of the drawer:
```tsx
{lastRegistered && (
  <div className="mt-3 text-[10px] text-[#9e99ae] flex items-center gap-1">
    Próximo: <button className="text-[#6c63ff] font-medium hover:underline">{nextTopicName} →</button>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: show real progress indicators in edital topic list"
```

---

### Task 7: "Criar Plano" CTA in Edital Header

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Add CTA when in edital mode without plan**

In the edital header section (where cargo name shows), add:

```tsx
{isEditalMode && !existingPlano && (
  <button
    onClick={() => setShowCreatePlan(true)}
    className="px-4 py-2 bg-[#6c63ff] hover:bg-[#5b54e0] text-white text-xs font-semibold rounded-lg transition-colors"
  >
    Criar Plano de Estudo
  </button>
)}
{isEditalMode && existingPlano && (
  <span className="text-xs text-[#6c63ff] font-medium bg-[#f5f3ff] px-3 py-1.5 rounded-lg">
    Plano: {existingPlano.nome}
  </span>
)}
```

- [ ] **Step 2: Simple plan creation dialog**

```tsx
const [showCreatePlan, setShowCreatePlan] = useState(false);
const { createPlano, findPlanoByEdital } = usePlanosEstudo();

const existingPlano = editalId && cargoId ? findPlanoByEdital(editalId, cargoId) : null;

// Dialog: input for name (pre-filled), optional date, confirm
// On confirm: createPlano({ nome, edital_id, cargo_id, data_prova? })
// Toast: "Plano criado!"
// URL updates to ?planoId=X
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add 'Criar Plano de Estudo' CTA in edital header"
```

---

### Task 8: Empty States + Cronograma Without Plan

**Files:**
- Modify: `src/components/documents-organization/CronogramaWeekView.tsx`
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Cronograma detects if plan exists**

```typescript
const { planos } = usePlanosEstudo();
const hasActivePlan = planos.length > 0;
```

When no plan: show clean empty state instead of mock data:
```tsx
{!hasActivePlan ? (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-3xl mb-3">📅</div>
    <h3 className="text-sm font-semibold text-[#1a1625] mb-1">Cronograma não ativo</h3>
    <p className="text-xs text-[#9e99ae] max-w-[280px] mb-4">
      Crie um plano de estudo vinculado a um edital para ativar o cronograma semanal.
    </p>
    <button className="px-4 py-2 bg-[#6c63ff] text-white text-xs font-semibold rounded-lg">
      Criar Plano
    </button>
  </div>
) : (
  // existing cockpit with rings, list, tabs
)}
```

- [ ] **Step 2: Drawer empty states**

When no progress (blur visible), show clean text instead of mock data behind blur:
- Chart area: "Registre seu primeiro estudo para ver o desempenho"
- AI area: "Comece a estudar para receber insights"

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: professional empty states for cronograma and drawer"
```

---

### Task 9: Sheet Overlay + Code Cleanup

**Files:**
- Modify: `src/components/ui/sheet.tsx`
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Subtle overlay**

In sheet.tsx, change overlay from `bg-black/80` to subtle:
```typescript
className={cn(
  "fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  className
)}
```

- [ ] **Step 2: Remove dead code from TopicDetailDrawer**

- Remove `ImportanceRing` function (not used)
- Remove `RevisionsSection` function (replaced by CompactRevisionsChart)
- Remove `DesempenhoChart` import (not used in drawer)
- Remove any leftover `overlayRef`, `handleOverlayClick` code

- [ ] **Step 3: Remove unused drawer.tsx**

If the vaul drawer component (`src/components/ui/drawer.tsx`) is no longer used anywhere:
```bash
git rm src/components/ui/drawer.tsx
```

Check for imports first:
```bash
grep -r "from.*ui/drawer" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: subtle overlay, remove dead code (ImportanceRing, RevisionsSection, DesempenhoChart, drawer.tsx)"
```

---

### Task 10: Nota Estimada in Edital Header

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Calculate and display score**

When the student has progress on ≥3 topics, show BasicScoreDisplay:

```tsx
import { useScoreEngine } from '@/hooks/useScoreEngine';
import { BasicScoreDisplay } from '@/components/documents-organization/BasicScoreDisplay';

// Build topicoData from progressMap
const topicoDataForScore = useMemo(() => {
  return Array.from(progressMap.entries()).map(([ref, prog]) => ({
    disciplinaNome: '...', // resolve from displayDisciplinas
    peso_edital: prog.peso_edital,
    mastery_score: prog.mastery_score,
  }));
}, [progressMap]);

const score = useScoreEngine(topicoDataForScore);

// In header, when score.current > 0:
{score.current > 0 && (
  <BasicScoreDisplay score={score.current} targetScore={80} />
)}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: show nota estimada in edital header when student has progress"
```

---

### Task 11: Verify Everything

- [ ] **Step 1: Run migration on Supabase**
- [ ] **Step 2: Add `fonteId` to API GraphQL schema** (user does this)
- [ ] **Step 3: `npm run lint && npm run build`**
- [ ] **Step 4: Test complete flow:**
  1. /editais → "Ver edital" → page loads from API
  2. Click topic → Sheet opens → intelligence shows → stats blurred
  3. "Registrar Estudo" → quick mode → confirm → toast shows → drawer refreshes → blur lifts → stats appear
  4. Close drawer → topic in list shows purple dot + mastery %
  5. "Criar Plano" → dialog → confirm → toast → badge appears
  6. Toggle "Cronograma" → empty state "Crie um plano" (or cockpit if plan exists)
  7. Return to /editais → cargo shows "Continuar" instead of "Ver edital"
- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: v1 complete — feedback loop, real data, plan creation, empty states, score"
```
