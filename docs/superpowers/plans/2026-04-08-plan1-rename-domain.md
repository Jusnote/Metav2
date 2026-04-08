# Plan 1: Rename — Nomenclatura do Domínio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename units/topics/subtopics to disciplinas/topicos/subtopicos across database, types, hooks, components, and views.

**Architecture:** Single migration renames tables and columns in Supabase. TypeScript types, hooks, and components are updated via systematic find-replace. The rename is mechanical — no logic changes.

**Tech Stack:** Supabase migrations (SQL), TypeScript, React

**Spec:** `docs/superpowers/specs/2026-04-08-editais-documents-integration-design.md` (section "Rename — Nomenclatura do Domínio")

---

### Task 1: Supabase Migration — Rename Tables and Columns

**Files:**
- Create: `supabase/migrations/20260408000001_rename_to_domain_language.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Rename tables
ALTER TABLE units RENAME TO disciplinas;
ALTER TABLE topics RENAME TO topicos;
ALTER TABLE subtopics RENAME TO subtopicos;

-- Rename columns: disciplinas
ALTER TABLE disciplinas RENAME COLUMN title TO nome;

-- Rename columns: topicos
ALTER TABLE topicos RENAME COLUMN title TO nome;
ALTER TABLE topicos RENAME COLUMN unit_id TO disciplina_id;

-- Rename columns: subtopicos
ALTER TABLE subtopicos RENAME COLUMN title TO nome;
ALTER TABLE subtopicos RENAME COLUMN topic_id TO topico_id;

-- Rename FKs in documents
ALTER TABLE documents RENAME COLUMN subtopic_id TO subtopico_id;
ALTER TABLE documents RENAME COLUMN topic_id TO topico_id;

-- Rename FKs in notes
ALTER TABLE notes RENAME COLUMN subtopic_id TO subtopico_id;
ALTER TABLE notes RENAME COLUMN topic_id TO topico_id;

-- Rename FKs in schedule_items
ALTER TABLE schedule_items RENAME COLUMN unit_id TO disciplina_id;
ALTER TABLE schedule_items RENAME COLUMN topic_id TO topico_id;
ALTER TABLE schedule_items RENAME COLUMN subtopic_id TO subtopico_id;

-- Rename FKs in study_goals
ALTER TABLE study_goals RENAME COLUMN unit_id TO disciplina_id;

-- Rename indexes (drop and recreate with new names)
DROP INDEX IF EXISTS idx_topics_user_id;
CREATE INDEX idx_topicos_user_id ON topicos(user_id);

DROP INDEX IF EXISTS idx_topics_duration;
CREATE INDEX idx_topicos_duration ON topicos(estimated_duration_minutes);

DROP INDEX IF EXISTS idx_topics_last_access;
CREATE INDEX idx_topicos_last_access ON topicos(last_access);

DROP INDEX IF EXISTS idx_subtopics_user_id;
CREATE INDEX idx_subtopicos_user_id ON subtopicos(user_id);

DROP INDEX IF EXISTS idx_subtopics_duration;
CREATE INDEX idx_subtopicos_duration ON subtopicos(estimated_duration_minutes);

DROP INDEX IF EXISTS idx_subtopics_last_access;
CREATE INDEX idx_subtopicos_last_access ON subtopicos(last_access);

DROP INDEX IF EXISTS idx_units_user_id;
CREATE INDEX idx_disciplinas_user_id ON disciplinas(user_id);
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/20260408000001_rename_to_domain_language.sql
git commit -m "chore(db): rename units/topics/subtopics to disciplinas/topicos/subtopicos"
```

---

### Task 2: Rename Type Definitions

**Files:**
- Modify: `src/hooks/useUnitsManager.ts` (rename file to `src/hooks/useDisciplinasManager.ts`)
- Modify: `src/types/notes.ts`
- Modify: `src/types/plate-document.ts`

- [ ] **Step 1: Rename useUnitsManager.ts to useDisciplinasManager.ts and update interfaces**

Rename file: `src/hooks/useUnitsManager.ts` → `src/hooks/useDisciplinasManager.ts`

Replace the interfaces at the top:

```typescript
export interface Disciplina {
  id: string;
  nome: string;
  totalChapters: number;
  subject: string;
  topicos: Topico[];
}

export interface Topico {
  id: string;
  nome: string;
  date: string;
  totalAulas: number;
  subtopicos?: Subtopico[];
  lastAccess?: string;
  tempoInvestido?: string;
  estimated_duration_minutes?: number;
}

export interface Subtopico {
  id: string;
  nome: string;
  date: string;
  totalAulas: number;
  status: 'not-started' | 'in-progress' | 'completed';
  tempo: string;
  resumosVinculados: number;
  flashcardsVinculados: number;
  questoesVinculadas: number;
  lastAccess?: string;
  tempoInvestido?: string;
  estimated_duration_minutes?: number;
}
```

Inside the hook, apply these replacements throughout the file:
- `useUnitsManager` → `useDisciplinasManager`
- `units` → `disciplinas` (state name, variables)
- `setUnits` → `setDisciplinas`
- `loadUnitsFromDatabase` → `loadDisciplinasFromDatabase`
- `addUnit` → `addDisciplina`, `updateUnit` → `updateDisciplina`, `deleteUnit` → `deleteDisciplina`
- `addTopic` → `addTopico`, `updateTopic` → `updateTopico`, `deleteTopic` → `deleteTopico`
- `addSubtopic` → `addSubtopico`, `updateSubtopic` → `updateSubtopico`, `deleteSubtopic` → `deleteSubtopico`
- All Supabase table references: `.from('units')` → `.from('disciplinas')`, `.from('topics')` → `.from('topicos')`, `.from('subtopics')` → `.from('subtopicos')`
- All column references: `unit_id` → `disciplina_id`, `topic_id` → `topico_id`, `title` → `nome`
- Property mappings: `title: row.title` → `nome: row.nome`, `topics:` → `topicos:`, `subtopics:` → `subtopicos:`

Return object:
```typescript
return {
  disciplinas,
  setDisciplinas,
  isLoading,
  loadDisciplinasFromDatabase,
  addDisciplina, updateDisciplina, deleteDisciplina,
  addTopico, updateTopico, deleteTopico,
  addSubtopico, updateSubtopico, deleteSubtopico,
  editingItem, startEditing, stopEditing, isEditing,
  updateLastAccess,
  calculateTopicDuration, recalculateTopicDuration
};
```

- [ ] **Step 2: Update src/types/notes.ts**

```typescript
export interface Note {
  id: string;
  subtopico_id: string | null;
  topico_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
}
```

- [ ] **Step 3: Update src/types/plate-document.ts**

Change `subtopic_id` to `subtopico_id`:
```typescript
export interface PlateDocument extends BaseEntity {
  title: string;
  content: PlateContent;
  content_text?: string;
  is_favorite?: boolean;
  tags?: string[];
  subtopico_id?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDisciplinasManager.ts src/types/notes.ts src/types/plate-document.ts
git rm src/hooks/useUnitsManager.ts
git commit -m "refactor: rename types Unit/Topic/Subtopic to Disciplina/Topico/Subtopico"
```

---

### Task 3: Update All Hooks

**Files:**
- Modify: `src/hooks/useScheduleItems.ts`
- Modify: `src/hooks/useStudyGoals.ts`
- Modify: `src/hooks/usePlateDocuments.ts`
- Modify: `src/hooks/useNotes.ts`
- Modify: `src/hooks/useMaterialCounts.ts`
- Modify: `src/hooks/useHierarchyProgress.ts`
- Modify: `src/hooks/useManualSchedule.ts`
- Modify: `src/lib/schedule-distribution.ts`

- [ ] **Step 1: Update useScheduleItems.ts**

Apply replacements:
- `unitId` → `disciplinaId`
- `topicId` → `topicoId`
- `subtopicId` → `subtopicId` (already Portuguese-like, keep for consistency) OR `subtopicoId`
- `unit_id` → `disciplina_id`
- `topic_id` → `topico_id`
- `subtopic_id` → `subtopico_id`

- [ ] **Step 2: Update useStudyGoals.ts**

Apply replacements:
- `unit_id` → `disciplina_id`
- `topicId` → `topicoId`
- `subtopicId` → `subtopicoId`

- [ ] **Step 3: Update usePlateDocuments.ts**

Apply replacements:
- `subtopic_id` → `subtopico_id`
- `getDocumentsBySubtopic` → `getDocumentsBySubtopico`
- `subtopicId` parameter → `subtopicoId`

- [ ] **Step 4: Update useNotes.ts**

Apply replacements:
- `subtopic_id` → `subtopico_id`
- `topic_id` → `topico_id`
- `subtopicId` → `subtopicoId`
- `topicId` → `topicoId`

- [ ] **Step 5: Update useMaterialCounts.ts**

Apply replacements:
- `subtopicId` → `subtopicoId`
- `topicId` → `topicoId`
- `subtopic_id` → `subtopico_id`
- `topic_id` → `topico_id`

- [ ] **Step 6: Update useHierarchyProgress.ts**

Update import:
```typescript
import type { Disciplina, Topico } from './useDisciplinasManager';
```
Replace `Unit` → `Disciplina`, `Topic` → `Topico` throughout.

- [ ] **Step 7: Update useManualSchedule.ts**

Apply replacements: `topic_id` → `topico_id`, `subtopic_id` → `subtopico_id`

- [ ] **Step 8: Update schedule-distribution.ts**

Update interfaces:
```typescript
export interface StudyItem {
  id: string;
  title: string;
  estimatedMinutes: number;
  topicoId?: string;
  subtopicoId?: string;
}

export interface ScheduleItem {
  itemId: string;
  title: string;
  date: string;
  durationMinutes: number;
  sessionType: 'part1' | 'part2' | 'revision';
  revisionNumber: number;
  topicoId?: string;
  subtopicoId?: string;
}
```

Replace all `topicId` → `topicoId`, `subtopicId` → `subtopicoId`, `topic_id` → `topico_id`, `subtopic_id` → `subtopico_id` throughout file.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/ src/lib/schedule-distribution.ts
git commit -m "refactor: rename unit/topic/subtopic references in all hooks and libs"
```

---

### Task 4: Update Context

**Files:**
- Modify: `src/contexts/DocumentsOrganizationContext.tsx`

- [ ] **Step 1: Update imports and type**

```typescript
import { useDisciplinasManager, type Disciplina, type Topico, type Subtopico } from "@/hooks/useDisciplinasManager";
```

Update interface:
- `units: Unit[]` → `disciplinas: Disciplina[]`
- `addUnit` → `addDisciplina`, `updateUnit` → `updateDisciplina`, `deleteUnit` → `deleteDisciplina`
- `addTopic` → `addTopico`, etc.
- `selectedSubtopic` type: `{ unitId → disciplinaId, topicId → topicoId, subtopic → subtopico }`
- `selectedTopic` type: `{ unitId → disciplinaId, topic → topico }`
- All modal state types: `unitId` → `disciplinaId`, `topicId` → `topicoId`, `subtopicId` → `subtopicoId`
- `QuickCreateModalState.type`: `'unit' | 'topic' | 'subtopic'` → `'disciplina' | 'topico' | 'subtopico'`

- [ ] **Step 2: Update provider implementation**

Replace all internal references:
- `useUnitsManager()` → `useDisciplinasManager()`
- `units` → `disciplinas` everywhere
- `expandedUnits` → `expandedDisciplinas`
- `expandedTopics` → `expandedTopicos`
- `toggleUnitExpansion` → `toggleDisciplinaExpansion`
- `toggleTopicExpansion` → `toggleTopicoExpansion`
- `editingUnit` → `editingDisciplina`
- `handleSubtopicSelect` → `handleSubtopicoSelect`
- `handleTopicSelect` → `handleTopicoSelect`
- `subtopicWithScheduleButton` → `subtopicoWithScheduleButton`

- [ ] **Step 3: Commit**

```bash
git add src/contexts/DocumentsOrganizationContext.tsx
git commit -m "refactor: rename context to use domain language (disciplinas/topicos/subtopicos)"
```

---

### Task 5: Update All Components

**Files:** All components that import Unit/Topic/Subtopic types or reference unitId/topicId/subtopicId.

- [ ] **Step 1: Update component imports and props**

For each file, update the import from `useUnitsManager` to `useDisciplinasManager` and rename types:

| File | Old Import | New Import |
|------|-----------|------------|
| `src/components/UnitItem.tsx` | `import type { Unit }` | Rename file to `DisciplinaItem.tsx`, `import type { Disciplina }` |
| `src/components/TopicItem.tsx` | `import type { Topic }` | Rename to `TopicoItem.tsx`, `import type { Topico }` |
| `src/components/SubtopicItem.tsx` | `import type { Subtopic }` | Rename to `SubtopicoItem.tsx`, `import type { Subtopico }` |
| `src/components/HierarchySearch.tsx` | `import { Unit, Topic, Subtopic }` | `import { Disciplina, Topico, Subtopico }` |
| `src/components/TopicScheduleDrawer.tsx` | `import type { Subtopic }` | `import type { Subtopico }` |
| `src/components/documents-organization/DisciplinesSidebar.tsx` | `import type { Unit }` | `import type { Disciplina }` |
| `src/components/documents-organization/TopicDetailDrawer.tsx` | `import type { Topic, Subtopic }` | `import type { Topico, Subtopico }` |
| `src/components/documents-organization/TopicsGrid.tsx` | `import type { Unit, Topic, Subtopic }` | `import type { Disciplina, Topico, Subtopico }` |
| `src/views/DocumentsOrganizationPage.tsx` | `import type { Topic, Subtopic }` | `import type { Topico, Subtopico }` |

Inside each component, replace all prop names and references:
- `unit` → `disciplina`, `units` → `disciplinas`
- `topic` → `topico`, `topics` → `topicos`
- `subtopic` → `subtopico`, `subtopics` → `subtopicos`
- `unitId` → `disciplinaId`, `topicId` → `topicoId`, `subtopicId` → `subtopicoId`
- `.title` → `.nome` (on disciplina/topico/subtopico objects)

- [ ] **Step 2: Update GoalCreationDialog interfaces**

In `src/components/goals/GoalCreationDialog.tsx`, rename local interfaces:
```typescript
interface Subtopico {
  id: string;
  nome: string;
  estimated_duration_minutes?: number;
  topico_id: string;
}

interface Topico {
  id: string;
  nome: string;
  estimated_duration_minutes?: number;
  subtopicos: Subtopico[];
}

interface Disciplina {
  id: string;
  nome: string;
  topicos: Topico[];
}
```

Update all references inside the component: `unit` → `disciplina`, `topic` → `topico`, `subtopic` → `subtopico`, `.title` → `.nome`.

- [ ] **Step 3: Update remaining goal components**

Apply same renames in:
- `src/components/goals/SubtopicSelector.tsx`
- `src/components/goals/GoalPreviewSummary.tsx`
- `src/components/goals/TopicConflictAccordion.tsx`

- [ ] **Step 4: Update views**

Apply renames in:
- `src/views/DocumentsOrganizationPage.tsx`
- `src/views/StudyPage.tsx`
- `src/views/CronogramaPage.tsx`
- `src/views/EditResumoPage.tsx`

- [ ] **Step 5: Update remaining components**

Apply renames in:
- `src/components/NotesModal.tsx`
- `src/components/SubtopicDocumentsModal.tsx` → rename to `SubtopicoDocumentsModal.tsx`
- `src/components/QuickCreateModal.tsx`
- `src/components/TopicSubtopicCreateModal.tsx` → rename to `TopicoSubtopicoCreateModal.tsx`
- `src/components/TopicAIAssistant.tsx` → rename to `TopicoAIAssistant.tsx`
- `src/components/QuickSchedulePopover.tsx`
- `src/components/DocumentsOrganizationSidebar.tsx`
- `src/components/EditModeToggle.tsx`
- `src/components/HierarchyBreadcrumbs.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/views/
git commit -m "refactor: rename all components to use domain language"
```

---

### Task 6: Update database.ts Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerate Supabase types**

After applying the migration to Supabase, regenerate types:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

If not using CLI, manually rename in the file:
- `units` table → `disciplinas`
- `topics` table → `topicos`
- `subtopics` table → `subtopicos`
- All `unit_id` → `disciplina_id`, `topic_id` → `topico_id`, `subtopic_id` → `subtopico_id`
- All `title` → `nome` in disciplinas/topicos/subtopicos table types

- [ ] **Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerate database types after rename"
```

---

### Task 7: Verify Build

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: 0 errors (fix any remaining references)

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Fix any remaining references**

Search for any remaining old references:
```bash
grep -r "useUnitsManager\|unit_id\|unitId\|\.title" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

Fix any found references following the same rename patterns.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete domain language rename - units→disciplinas, topics→topicos, subtopics→subtopicos"
```
