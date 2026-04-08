# Plan 5 (v2): Inteligência do Edital + Progresso Visual + Blur

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show edital intelligence in drawer ("O que mais cai", editais que cobram, legislação, bancas, mastery score, learning stage, ROI contribution). Progress segmented dots (4 dots per topic). Stats panel blur when no progress. Basic score display.

**Architecture:** Intelligence from API editais via React Query. Progress from local topicos. Drawer merges both. TopicoIntelligence component for API data. ProgressDots for visual indicators. Blur overlay on stats when no local record exists. BasicScoreDisplay shows current estimated score.

**Tech Stack:** URQL, React Query, Tailwind CSS, ECharts

**Depends on:** Plan 1 (rename), Plan 2 (schema + API hooks)

**Spec:** `docs/superpowers/specs/2026-04-08-editais-integration-v2-complete.md` (sections "Inteligência", "Progresso Segmentado", "Score Engine", "Drawer")

---

### Task 1: Create TopicoIntelligence Component

**Files:**
- Create: `src/components/documents-organization/TopicoIntelligence.tsx`

- [ ] **Step 1: Create component**

Shows edital intelligence for a specific topic:
- **"O que mais cai"**: subtopicos_enriquecidos with frequency bars (gradient indigo)
- **Editais que cobram**: badges (TRF 1ª, STJ, etc.)
- **Legislação vinculada**: clickable tags (⚖️ CP Art. 121)
- **Bancas**: pill badges
- **Stats line**: "X% das provas · peso Y% · #Z de N"
- Loading skeleton state
- Empty state when no API data

Background: subtle indigo gradient. Compact but informative.

Props: `{ data: IntelligenceData | null, isLoading: boolean }`

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/TopicoIntelligence.tsx
git commit -m "feat: create TopicoIntelligence component with frequency bars and cross-ref"
```

---

### Task 2: Create ProgressDots Component

**Files:**
- Create: `src/components/documents-organization/ProgressDots.tsx`

- [ ] **Step 1: Create component + calculation utility**

Visual: 4 small dots in a row.
- Dot 1: 📖 Estudo (green=done, amber=partial, gray=none)
- Dot 2: 🔄 Revisão (green=all done, amber=pending, gray=none)
- Dot 3: ❓ Questões (green=10+, amber=1-9, gray=0)
- Dot 4: ⚖️ Lei Seca (green=read, gray=not read)

`calculateProgressDots(topico, scheduleStatus?)` utility function that takes topico fields and returns dot states.

Props: `{ estudo, revisao, questoes, leiSeca, size?: 'sm' | 'md' }`

Tooltip on hover showing labels.

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/ProgressDots.tsx
git commit -m "feat: create ProgressDots with 4 segmented indicators"
```

---

### Task 3: Create MasteryBadge Component

**Files:**
- Create: `src/components/documents-organization/MasteryBadge.tsx`

- [ ] **Step 1: Create component**

Shows learning_stage as a colored badge:
- `new` → gray "Novo"
- `learning` → blue "Aprendendo"
- `consolidating` → indigo "Consolidando"
- `maintaining` → amber "Mantendo"
- `mastered` → green "Dominado"

Also shows mastery_score as a small progress bar (0-100).

Props: `{ stage: string, score: number }`

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/MasteryBadge.tsx
git commit -m "feat: create MasteryBadge with learning stage and score"
```

---

### Task 4: Create BasicScoreDisplay Component

**Files:**
- Create: `src/components/documents-organization/BasicScoreDisplay.tsx`

- [ ] **Step 1: Create component**

v1: Shows current estimated score (simple calculation).
Ready for v2: projected score, probability, ROI.

```
┌────────────────────────────┐
│ Nota estimada: 72/100      │
│ ████████████░░░░░░ 72%     │
│ Meta: 80 | Faltam: 8       │
└────────────────────────────┘
```

Shows per-disciplina breakdown if available. Compact for drawer placement.

Props: `{ score: ScoreProjection, targetScore?: number }`

Uses `useScoreEngine` hook from Plan 2.

- [ ] **Step 2: Commit**

```bash
git add src/components/documents-organization/BasicScoreDisplay.tsx
git commit -m "feat: create BasicScoreDisplay for estimated score"
```

---

### Task 5: Hook for Intelligence Data

**Files:**
- Create: `src/hooks/useTopicoIntelligence.ts`

- [ ] **Step 1: Create hook**

Fetches from API editais:
- `editaisPorDisciplina(nome)` — existing query
- `rankingDisciplinas(esfera, limite)` — existing query
- Subtopicos enriquecidos — from topico data (if available)

Returns `IntelligenceData` with what's available. Missing fields return empty arrays (will be populated as API is enriched).

Stale time: 24h. GC time: 7 days.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTopicoIntelligence.ts
git commit -m "feat: add useTopicoIntelligence hook for API data"
```

---

### Task 6: Integrate Everything into TopicDetailDrawer

**Files:**
- Modify: `src/components/documents-organization/TopicDetailDrawer.tsx`

- [ ] **Step 1: Add intelligence section after header**

Import and use `TopicoIntelligence`, `ProgressDots`, `MasteryBadge`, `BasicScoreDisplay`.

Layout in drawer:
1. Header (existing) + MasteryBadge + ProgressDots
2. TopicoIntelligence (always visible, nítida)
3. Contribution line: "Este tópico vale +X pontos se dominar"
4. --- divider ---
5. Stats/Revisões/Desempenho/IA panel (existing)
   - If no local record → **blur overlay** with "Estude para desbloquear"
   - If has local record → normal display
6. Materials (existing)
7. "Registrar Estudo" button (from Plan 4)

- [ ] **Step 2: Add blur overlay logic**

```tsx
const hasProgress = !!localTopico; // local record exists

<div className={`relative ${!hasProgress ? 'select-none' : ''}`}>
  {!hasProgress && (
    <div className="absolute inset-0 z-10 backdrop-blur-[3px] bg-white/40 rounded-xl
      flex items-center justify-center pointer-events-none">
      <span className="text-xs font-semibold text-muted-foreground">
        Estude para desbloquear suas estatísticas
      </span>
    </div>
  )}
  {/* existing stats content */}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/documents-organization/TopicDetailDrawer.tsx
git commit -m "feat: integrate intelligence, mastery, progress dots, blur, and score into drawer"
```

---

### Task 7: Add Progress Dots to Topic Cards

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`

- [ ] **Step 1: Add dots next to each topic in the central list**

Import `ProgressDots` + `calculateProgressDots`.

In each topic row/card, after the topic name:
```tsx
<ProgressDots {...calculateProgressDots(localTopico || {})} size="sm" />
```

Also show MasteryBadge if topic has progress.

- [ ] **Step 2: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx
git commit -m "feat: add progress dots and mastery badge to topic cards"
```

---

### Task 8: Verify

- [ ] **Step 1: Test intelligence** — open drawer for API topic → shows "O que mais cai", editais, bancas
- [ ] **Step 2: Test blur** — stats panel blurred when no progress
- [ ] **Step 3: Test after study** — register study → blur lifts → stats show → dots update
- [ ] **Step 4: Test mastery badge** — shows correct stage based on mastery_score
- [ ] **Step 5: Test score** — BasicScoreDisplay shows estimated score
- [ ] **Step 6: `npm run lint && npm run build`**
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete edital intelligence and progress visualization"
```
