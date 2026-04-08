# Plan 2 (v2): Planos de Estudo + Integração API + Schema Completo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the complete v2 database schema (all tables for current AND future features), hooks for study plans and API data reads, and wire the "Ver edital" / "Continuar" flow from /editais to /documents-organization.

**Architecture:** Single migration creates ALL v2 tables upfront (planos_estudo, planos_editais, questoes_log, study_sessions, score_snapshots, flash_questoes + extensions to topicos/disciplinas/user_study_config). API reads via React Query with localStorage persist. Lazy local record creation on personal actions. Bulk creation on cronograma.

**Tech Stack:** Supabase (PostgreSQL), URQL (GraphQL), React Query with persist, TypeScript

**Depends on:** Plan 1 (rename) completed.

**Spec:** `docs/superpowers/specs/2026-04-08-editais-integration-v2-complete.md`

---

### Task 1: Migration — Complete v2 Schema

**Files:**
- Create: `supabase/migrations/20260408000002_v2_complete_schema.sql`

- [ ] **Step 1: Create migration with ALL v2 tables and columns**

```sql
-- =============================================
-- NOVAS TABELAS
-- =============================================

-- Planos de estudo
CREATE TABLE IF NOT EXISTS planos_estudo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    nome            VARCHAR(200) NOT NULL,
    data_prova      TIMESTAMPTZ,
    source_type     VARCHAR(20) DEFAULT 'edital',  -- 'edital' | 'manual' | 'combined'
    study_mode      VARCHAR(20) DEFAULT 'continuo', -- 'continuo' | 'edital'
    target_score    DECIMAL(5,2),
    current_cycle   INTEGER DEFAULT 1,
    triage_enabled  BOOLEAN DEFAULT FALSE,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_planos_estudo_user ON planos_estudo(user_id);
ALTER TABLE planos_estudo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON planos_estudo
    FOR ALL USING (auth.uid() = user_id);

-- Vínculos plano ↔ edital/cargo
CREATE TABLE IF NOT EXISTS planos_editais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id        UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
    edital_id       INTEGER NOT NULL,
    cargo_id        INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plano_id, edital_id, cargo_id)
);
CREATE INDEX idx_planos_editais_plano ON planos_editais(plano_id);
ALTER TABLE planos_editais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan links" ON planos_editais
    FOR ALL USING (
        plano_id IN (SELECT id FROM planos_estudo WHERE user_id = auth.uid())
    );

-- Log detalhado de questões
CREATE TABLE IF NOT EXISTS questoes_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    topico_id           UUID REFERENCES topicos(id) ON DELETE SET NULL,
    questao_id          INTEGER,
    correto             BOOLEAN NOT NULL,
    tempo_resposta      INTEGER,
    dificuldade         DECIMAL(3,2),
    tipo_erro           VARCHAR(30),
    conceito_confundido VARCHAR(100),
    session_id          UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questoes_log_user ON questoes_log(user_id);
CREATE INDEX idx_questoes_log_topico ON questoes_log(topico_id);
ALTER TABLE questoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own question logs" ON questoes_log
    FOR ALL USING (auth.uid() = user_id);

-- Sessões de estudo
CREATE TABLE IF NOT EXISTS study_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    plano_id        UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    planned_minutes INTEGER,
    active_minutes  INTEGER,
    activities      JSONB,
    score_before    DECIMAL(5,2),
    score_after     DECIMAL(5,2),
    cycle           INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON study_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Snapshots de nota estimada
CREATE TABLE IF NOT EXISTS score_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    plano_id        UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
    score_current   DECIMAL(5,2),
    score_projected DECIMAL(5,2),
    pass_probability DECIMAL(3,2),
    breakdown       JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots" ON score_snapshots
    FOR ALL USING (auth.uid() = user_id);

-- FlashQuestões (infraestrutura pronta, implementação futura)
CREATE TABLE IF NOT EXISTS flash_questoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    topico_id       UUID REFERENCES topicos(id) ON DELETE SET NULL,
    questao_texto   TEXT NOT NULL,
    alternativas    JSONB NOT NULL,
    resposta_correta VARCHAR(1) NOT NULL,
    dificuldade     DECIMAL(3,2) DEFAULT 0.50,
    source          VARCHAR(20) DEFAULT 'manual',
    fsrs_stability  DECIMAL(10,2) DEFAULT 1.0,
    fsrs_difficulty DECIMAL(5,2) DEFAULT 0.3,
    next_review     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flash_questoes_user ON flash_questoes(user_id);
CREATE INDEX idx_flash_questoes_topico ON flash_questoes(topico_id);
CREATE INDEX idx_flash_questoes_review ON flash_questoes(next_review);
ALTER TABLE flash_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flash" ON flash_questoes
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- EXTENSÕES EM TABELAS EXISTENTES
-- =============================================

-- disciplinas: referências API + plano
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS api_disciplina_id INTEGER;
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL;
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual';
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS peso_edital DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS idx_disciplinas_api ON disciplinas(api_disciplina_id) WHERE api_disciplina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disciplinas_plano ON disciplinas(plano_id) WHERE plano_id IS NOT NULL;

-- topicos: referências API + modelo de aprendizado completo
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS api_topico_id INTEGER;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual';
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS mastery_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS learning_stage VARCHAR(20) DEFAULT 'new';
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS question_accuracy DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questions_total INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS speed_avg_seconds DECIMAL(7,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS retention_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS discrimination_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS fsrs_stability DECIMAL(10,2) DEFAULT 1.0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS fsrs_difficulty DECIMAL(5,2) DEFAULT 0.3;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS peso_edital DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS diagnostic_score DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS learning_rate DECIMAL(5,3) DEFAULT 0.15;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS marginal_gain DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS depends_on UUID[];
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS teoria_finalizada BOOLEAN DEFAULT FALSE;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questoes_acertos INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questoes_erros INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS leis_lidas TEXT;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_topicos_api ON topicos(api_topico_id) WHERE api_topico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topicos_mastery ON topicos(mastery_score);
CREATE INDEX IF NOT EXISTS idx_topicos_stage ON topicos(learning_stage);

-- user_study_config: extensões v2
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS peak_hours TEXT[];
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS session_duration INTEGER DEFAULT 50;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS break_duration INTEGER DEFAULT 10;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS max_new_topics_per_day INTEGER DEFAULT 3;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS questions_per_day INTEGER DEFAULT 30;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS interleaving BOOLEAN DEFAULT TRUE;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS revision_style VARCHAR(10) DEFAULT 'hybrid';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260408000002_v2_complete_schema.sql
git commit -m "feat(db): add complete v2 schema — planos, questoes_log, sessions, scores, flash_questoes, learning model fields"
```

---

### Task 2: Hook — usePlanosEstudo

**Files:**
- Create: `src/hooks/usePlanosEstudo.ts`

- [ ] **Step 1: Create hook for CRUD on planos_estudo + planos_editais**

Must include:
- `loadPlanos()` — fetch all active plans with linked editais
- `createPlano({nome, data_prova?, source_type, study_mode, edital_id?, cargo_id?})` — creates plan + optional edital link
- `findPlanoByEdital(editalId, cargoId)` — checks if student already has a plan for this edital/cargo
- `deletePlano(planoId)` — cascade deletes
- `updatePlano(planoId, updates)` — update name, target_score, etc.

Return: `{ planos, isLoading, createPlano, findPlanoByEdital, deletePlano, updatePlano }`

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePlanosEstudo.ts
git commit -m "feat: add usePlanosEstudo hook for study plan management"
```

---

### Task 3: Hook — useEditaisData (API reads with React Query)

**Files:**
- Create: `src/hooks/useEditaisData.ts`

- [ ] **Step 1: Create hooks for API reads**

Must include:
- `useCargoData(editalId, cargoId)` — fetch cargo info + edital metadata
- `useDisciplinasApi(cargoId)` — fetch disciplinas for a cargo
- `useTopicosApi(disciplinaId)` — fetch topicos for a disciplina
- All queries with `staleTime: 24h`, `gcTime: 7 days`
- Export types: `ApiDisciplina`, `ApiTopico`, `ApiCargo`

GraphQL queries from existing `editaisQuery` function in `src/lib/editais-client.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEditaisData.ts
git commit -m "feat: add useEditaisData hooks for API reads with React Query cache"
```

---

### Task 4: Hook — useEditalSnapshot (lazy + bulk local record creation)

**Files:**
- Create: `src/hooks/useEditalSnapshot.ts`

- [ ] **Step 1: Create hook**

Must include:
- `ensureTopicoLocal({apiTopicoId, apiDisciplinaId, topicoNome, disciplinaNome, planoId?})` — lazy creation of 1 topico + 1 disciplina if needed. Returns local UUID. Checks for existing first.
- `bulkCreateFromCargo({planoId, disciplinas: ApiDisciplina[], topicosPerDisciplina: Map})` — creates all disciplinas + topicos at once for cronograma. Uses upsert to avoid duplicates.
- `getLocalTopicoId(apiTopicoId)` — returns local UUID if exists, null if not.
- All created records have `source_type: 'edital'` and `api_*_id` set.
- `estimated_duration_minutes` defaults to 120 for edital-sourced topicos.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEditalSnapshot.ts
git commit -m "feat: add useEditalSnapshot hook for lazy and bulk local record creation"
```

---

### Task 5: Hook — useScoreEngine (basic v1, ready for v2)

**Files:**
- Create: `src/hooks/useScoreEngine.ts`

- [ ] **Step 1: Create basic score engine**

v1 calculation (simple, expanded in v2):
```typescript
interface ScoreProjection {
  current: number;          // nota atual
  breakdown: Array<{
    disciplinaNome: string;
    peso: number;
    accuracy: number;       // question_accuracy from topicos
    contribuicao: number;   // peso × accuracy
  }>;
}

function calculateScore(disciplinas, topicos): ScoreProjection {
  // For each disciplina: sum(peso × avg_accuracy of its topicos)
  // Returns current score + per-disciplina breakdown
}
```

v2 will add: projected score, pass probability, ROI per disciplina, marginal gain.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useScoreEngine.ts
git commit -m "feat: add useScoreEngine hook (basic v1, ready for v2 projection)"
```

---

### Task 6: Hook — useQuestoesLog

**Files:**
- Create: `src/hooks/useQuestoesLog.ts`

- [ ] **Step 1: Create hook for logging question answers**

Must include:
- `logAnswer({topicoId, questaoId?, correto, tempoResposta?, dificuldade?, tipoErro?, conceitoConfundido?, sessionId?})` — inserts into questoes_log
- `getAccuracyForTopico(topicoId, limit?)` — returns accuracy from last N answers
- `getStatsForPlano(planoId)` — aggregated stats per disciplina
- After logging, updates `topicos.question_accuracy`, `topicos.questions_total`, `topicos.mastery_score` (basic recalc)

Mastery score v1 (simple):
```
mastery_score = question_accuracy × 0.60 + (teoria_finalizada ? 15 : 0) + (tempo_investido > 0 ? 15 : 0) + (leis_lidas ? 10 : 0)
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useQuestoesLog.ts
git commit -m "feat: add useQuestoesLog hook with mastery score calculation"
```

---

### Task 7: Update EditaisPage — "Ver edital" / "Continuar"

**Files:**
- Modify: `src/views/EditaisPage.tsx`

- [ ] **Step 1: Import usePlanosEstudo and update cargo button**

Change "Estudar →" to:
- If student has a plan for this edital/cargo → **"Continuar →"** (green, navigates to `?planoId=X`)
- If not → **"Ver edital →"** (blue, navigates to `?editalId=X&cargoId=Y`)

Uses `findPlanoByEdital(edital.id, cargo.id)` to check.

- [ ] **Step 2: Commit**

```bash
git add src/views/EditaisPage.tsx
git commit -m "feat: update editais page with 'Ver edital' / 'Continuar' button logic"
```

---

### Task 8: Update DocumentsOrganizationPage — API data source

**Files:**
- Modify: `src/views/DocumentsOrganizationPage.tsx`
- Modify: `src/contexts/DocumentsOrganizationContext.tsx`

- [ ] **Step 1: Parse query params and detect mode**

```typescript
const editalId = searchParams.get('editalId') ? Number(searchParams.get('editalId')) : null;
const cargoId = searchParams.get('cargoId') ? Number(searchParams.get('cargoId')) : null;
const planoId = searchParams.get('planoId');

const isEditalMode = !!editalId && !!cargoId;
const isPlanoMode = !!planoId;
// else: manual mode (existing behavior)
```

- [ ] **Step 2: In edital mode, fetch from API and merge with local progress**

- Fetch disciplinas/topicos via `useDisciplinasApi(cargoId)` and `useTopicosApi(disciplinaId)`
- Convert to Disciplina/Topico types for existing components
- Check for local records (progress) via `getLocalTopicoId`
- Drawer shows API intelligence + local progress (if exists)

- [ ] **Step 3: Commit**

```bash
git add src/views/DocumentsOrganizationPage.tsx src/contexts/DocumentsOrganizationContext.tsx
git commit -m "feat: support edital/plano mode in documents-organization with API reads"
```

---

### Task 9: React Query Persist Setup

**Files:**
- Modify: `src/App.tsx` (or QueryClient config)

- [ ] **Step 1: Install and configure persist**

```bash
npm install @tanstack/react-query-persist-client
```

Configure `persistQueryClient` with `localStorage`, `maxAge: 7 days`.

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx package.json package-lock.json
git commit -m "feat: add React Query persist for offline edital cache"
```

---

### Task 10: Update database.ts types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add types for all new tables and columns**

Add TypeScript types for: planos_estudo, planos_editais, questoes_log, study_sessions, score_snapshots, flash_questoes. Add new columns to disciplinas and topicos types.

- [ ] **Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: update database types for v2 schema"
```

---

### Task 11: Verify

- [ ] **Step 1: Run migration on Supabase**
- [ ] **Step 2: Run `npm run lint && npm run build`**
- [ ] **Step 3: Test: navigate to `/editais`, click cargo → "Ver edital" → documents-organization loads from API**
- [ ] **Step 4: Test: navigate without params → existing manual mode works**
- [ ] **Step 5: Commit any fixes**
