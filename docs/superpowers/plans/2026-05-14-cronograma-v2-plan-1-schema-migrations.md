# Cronograma V2 — Sub-plan 1: Schema Migrations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar todas as mudanças de schema da spec V2 (novas tabelas, colunas, índices, triggers, RLS) de forma aditiva e atômica, sem quebrar o sistema V1 existente.

**Architecture:** Migrations SQL incrementais via Supabase CLI. Cada migração é um arquivo separado, idempotente quando possível, com smoke test SQL próprio em `verify-*.sql`. RLS validada via simulação de JWT. Tipos TypeScript regenerados ao final.

**Tech Stack:** Postgres 15 (Supabase), pg_cron extension, plpgsql, Supabase CLI, TypeScript (regen de tipos).

**Spec ref:** `docs/superpowers/specs/2026-05-14-cronograma-cargo-integration-design.md` seção 4

---

## File Structure

Arquivos criados (todos em `supabase/migrations/`):

```
20260514120000_cronograma_v2_enums.sql              — enums novos
20260514120100_cronograma_v2_plan_decisions.sql     — audit trail tabela + partitioning
20260514120200_cronograma_v2_behavioral_signals.sql — sinais comportamentais + partitioning
20260514120300_cronograma_v2_edital_cache.sql       — cache compartilhado IA
20260514120400_cronograma_v2_predictions.sql        — predictions history + view
20260514120500_cronograma_v2_plan_events.sql        — event bus + partitioning
20260514120600_cronograma_v2_dead_letters.sql       — eventos não processados
20260514120700_cronograma_v2_config_history.sql     — versionamento de config
20260514120800_cronograma_v2_feriados.sql           — feriados nacionais
20260514120900_cronograma_v2_plan_templates.sql     — templates comunidade
20260514121000_cronograma_v2_auxiliary.sql          — graphql_cache, analytics_events, rate_limit, feature_flags, ai_quality_feedback
20260514121100_cronograma_v2_alter_planos_estudo.sql
20260514121200_cronograma_v2_alter_plano_config.sql
20260514121300_cronograma_v2_alter_plano_disciplinas.sql
20260514121400_cronograma_v2_alter_schedule_items.sql
20260514121500_cronograma_v2_alter_topicos.sql
20260514121600_cronograma_v2_alter_weekly_stats.sql
20260514121700_cronograma_v2_triggers.sql           — triggers reativos (sem handlers ainda)
20260514121800_cronograma_v2_rls.sql                — políticas RLS em todas as novas tabelas
20260514121900_cronograma_v2_seed_feriados.sql      — seed inicial Carnaval/feriados nacionais 2026-2028
```

Verify scripts (em `supabase/verify/cronograma_v2/`):
```
verify_01_enums.sql
verify_02_tables.sql
verify_03_indexes.sql
verify_04_triggers.sql
verify_05_rls.sql
verify_06_partitioning.sql
verify_07_full_insert_flow.sql
```

TypeScript:
```
src/types/database.ts      — REGENERADO via supabase gen types
src/types/cronograma-v2.ts — NOVO: tipos derivados que não saem do gen types
```

**Princípio:** cada migration deve poder ser revertida com um `DOWN` correspondente. Convenção: comentário no topo descreve UP/DOWN.

---

## Pré-requisitos

- Supabase CLI ≥ v2.51 instalada (`npx supabase --version`)
- Acesso ao projeto Supabase remoto (já configurado em `supabase/config.toml`)
- `psql` disponível para verify scripts (ou usar `npx supabase db query`)
- Branch git limpa antes de começar (`git status` mostra working tree clean das migrations)

---

### Task 0: Setup — diretório verify + branch

**Files:**
- Create: `supabase/verify/cronograma_v2/.gitkeep`

- [ ] **Step 1: Criar diretório de verify scripts**

```bash
mkdir -p "supabase/verify/cronograma_v2"
touch "supabase/verify/cronograma_v2/.gitkeep"
```

- [ ] **Step 2: Commit**

```bash
git add supabase/verify/cronograma_v2/.gitkeep
git commit -m "chore(cronograma-v2): create verify scripts directory"
```

---

### Task 1: Novos enums

**Files:**
- Create: `supabase/migrations/20260514120000_cronograma_v2_enums.sql`
- Create: `supabase/verify/cronograma_v2/verify_01_enums.sql`

- [ ] **Step 1: Criar migração de enums**

Conteúdo de `20260514120000_cronograma_v2_enums.sql`:

```sql
-- UP: novos enums do Cronograma V2
-- DOWN: DROP TYPE em ordem reversa

-- Nível de conhecimento por disciplina (declarado pelo user)
DO $$ BEGIN
  CREATE TYPE nivel_conhecimento_enum AS ENUM (
    'iniciante', 'intermediario', 'avancado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Frequência de simulados periódicos
DO $$ BEGIN
  CREATE TYPE simulados_freq_enum AS ENUM (
    'nenhum', 'mensal', 'quinzenal', 'semanal'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tipo de material preferido pelo usuário
DO $$ BEGIN
  CREATE TYPE tipo_material_enum AS ENUM (
    'video', 'pdf', 'livro', 'questoes', 'misto'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Horário preferido de estudo
DO $$ BEGIN
  CREATE TYPE horario_preferido_enum AS ENUM (
    'manha', 'tarde', 'noite', 'madrugada', 'flexivel'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Visibility de templates (oficial / publico / privado)
DO $$ BEGIN
  CREATE TYPE plan_template_visibility AS ENUM (
    'publico', 'privado', 'oficial'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Adiciona valor 'rascunho' no enum existente plano_status
-- (DO BEGIN/EXCEPTION para idempotência; ADD VALUE não suporta IF NOT EXISTS antes do PG 14)
DO $$ BEGIN
  ALTER TYPE plano_status ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'ativo';
EXCEPTION WHEN duplicate_object THEN null; END $$;
```

- [ ] **Step 2: Criar verify script de enums**

Conteúdo de `verify_01_enums.sql`:

```sql
-- Lista enums esperados; cada SELECT deve retornar a row
SELECT typname FROM pg_type WHERE typname = 'nivel_conhecimento_enum';
SELECT typname FROM pg_type WHERE typname = 'simulados_freq_enum';
SELECT typname FROM pg_type WHERE typname = 'tipo_material_enum';
SELECT typname FROM pg_type WHERE typname = 'horario_preferido_enum';
SELECT typname FROM pg_type WHERE typname = 'plan_template_visibility';

-- Confirma valores dos enums
SELECT unnest(enum_range(NULL::nivel_conhecimento_enum));
SELECT unnest(enum_range(NULL::simulados_freq_enum));

-- Confirma 'rascunho' adicionado ao enum existente
SELECT 'rascunho' = ANY(enum_range(NULL::plano_status)::TEXT[]) AS rascunho_exists;
```

- [ ] **Step 3: Aplicar migration**

```bash
npx supabase migration up --linked
```

Expected output: `Applying migration 20260514120000_cronograma_v2_enums.sql... done`

- [ ] **Step 4: Rodar verify**

```bash
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_01_enums.sql"
```

Expected: cada SELECT retorna 1 row. `rascunho_exists` retorna `true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260514120000_cronograma_v2_enums.sql supabase/verify/cronograma_v2/verify_01_enums.sql
git commit -m "feat(cronograma-v2): add enum types for nivel/simulados/material/horario/templates"
```

---

### Task 2: Tabela `plan_decisions` (audit trail + partitioning)

**Files:**
- Create: `supabase/migrations/20260514120100_cronograma_v2_plan_decisions.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

Conteúdo de `20260514120100_cronograma_v2_plan_decisions.sql`:

```sql
-- UP: plan_decisions com particionamento mensal
-- DOWN: DROP TABLE plan_decisions

CREATE TABLE IF NOT EXISTS plan_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  week_number INTEGER,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  inputs_hash TEXT,
  output_summary JSONB NOT NULL,
  algorithm_variant TEXT NOT NULL DEFAULT 'v2_default',
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partições iniciais: corrente e próximo mês
CREATE TABLE IF NOT EXISTS plan_decisions_2026_05 PARTITION OF plan_decisions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS plan_decisions_2026_06 PARTITION OF plan_decisions
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Catch-all defensivo para evitar erros caso cron falhe
CREATE TABLE IF NOT EXISTS plan_decisions_default PARTITION OF plan_decisions DEFAULT;

CREATE INDEX IF NOT EXISTS ix_plan_decisions_plano_week
  ON plan_decisions(plano_id, week_number);
CREATE INDEX IF NOT EXISTS ix_plan_decisions_action_time
  ON plan_decisions(action, created_at DESC);

COMMENT ON TABLE plan_decisions IS
  'Audit trail do algoritmo: cada decisão importante (distribuição, recalibração, FSRS) é logada para observabilidade e UI "Por que isso aconteceu?".';
```

- [ ] **Step 2: Acrescentar ao verify_02_tables.sql**

Conteúdo de `verify_02_tables.sql` (criar arquivo):

```sql
-- Verifica existência da tabela e suas partições
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'plan_decisions%';

-- Confirma particionamento ativo
SELECT
  parent.relname AS parent_table,
  child.relname AS partition_name
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'plan_decisions';

-- Confirma índices
SELECT indexname FROM pg_indexes
WHERE tablename = 'plan_decisions' OR tablename LIKE 'plan_decisions_%';

-- Insert smoke test (rollback at end)
BEGIN;
  -- Setup: criar plano fake (precisa de FK)
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001',
          'Test plan', CURRENT_DATE, CURRENT_DATE + 60, 'continuo', 'ativo');

  -- Insert na tabela particionada (deve cair na partição do mês corrente)
  INSERT INTO plan_decisions (plano_id, week_number, action, reason, output_summary, triggered_by)
  VALUES ('00000000-0000-0000-0000-0000000000aa', 1, 'initial_distribution', 'absorption_phase',
          '{"items_created": 10}'::JSONB, 'rpc_initial');

  SELECT COUNT(*) AS decisions_inserted FROM plan_decisions;  -- esperado: 1
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

Expected:
- `pg_tables` lista `plan_decisions`, `plan_decisions_2026_05`, `plan_decisions_2026_06`, `plan_decisions_default`
- `pg_inherits` confirma 3 partições atachadas ao parent
- `pg_indexes` mostra `ix_plan_decisions_plano_week` e `ix_plan_decisions_action_time`
- `decisions_inserted = 1`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120100_cronograma_v2_plan_decisions.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add plan_decisions audit trail with monthly partitioning"
```

---

### Task 3: Tabela `behavioral_signals` (sinais + partitioning + unique constraint)

**Files:**
- Create: `supabase/migrations/20260514120200_cronograma_v2_behavioral_signals.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: behavioral_signals com partitioning mensal + unique pra idempotência
-- DOWN: DROP TABLE behavioral_signals

CREATE TABLE IF NOT EXISTS behavioral_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
  schedule_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  value JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE IF NOT EXISTS behavioral_signals_2026_05 PARTITION OF behavioral_signals
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS behavioral_signals_2026_06 PARTITION OF behavioral_signals
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS behavioral_signals_default PARTITION OF behavioral_signals DEFAULT;

-- Unique pra idempotência (mesmo item, mesmo signal_type, mesmo dia → 1 row)
-- Aplica-se à coluna não particionada por dia, fica em cada partição
-- NOTE: usamos `(occurred_at AT TIME ZONE 'UTC')::date` em vez de `occurred_at::date`
-- porque cast de TIMESTAMPTZ para DATE depende do timezone da sessão (não-IMMUTABLE),
-- e Postgres rejeita funções não-imutáveis em expressões de índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_behavioral_signals_idempotency
  ON behavioral_signals (plano_id, schedule_item_id, signal_type, ((occurred_at AT TIME ZONE 'UTC')::date), occurred_at);

CREATE INDEX IF NOT EXISTS ix_behavioral_signals_user_type_time
  ON behavioral_signals(user_id, signal_type, occurred_at DESC);

COMMENT ON TABLE behavioral_signals IS
  'Sinais comportamentais passivos (LGPD opt-in): coleta quando user estuda, completa, pula. Alimenta level_drift detection e engine de predição.';
```

- [ ] **Step 2: Adicionar verify ao verify_02_tables.sql**

Append ao arquivo existente:

```sql
-- behavioral_signals
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'behavioral_signals%';

SELECT indexname FROM pg_indexes
WHERE tablename = 'behavioral_signals'
   OR tablename LIKE 'behavioral_signals_%';

-- Smoke test idempotência
BEGIN;
  INSERT INTO behavioral_signals (user_id, signal_type, value)
  VALUES ('00000000-0000-0000-0000-000000000001', 'session_start', '{"item_id": "test"}'::JSONB);

  -- Segundo insert no mesmo dia, mesmo signal_type, mesmo plano_id/item_id (NULLs aqui) → idempotente?
  -- NOTE: NULL não é considerado igual por UNIQUE; pra teste real usamos plano_id/item_id reais.
  -- Skip neste smoke; testar idempotência real após criar plano + item.

  SELECT COUNT(*) FROM behavioral_signals;  -- esperado: 1
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

Expected: tabela + 3 partições + 2 índices visíveis.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120200_cronograma_v2_behavioral_signals.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add behavioral_signals with partitioning and idempotency unique"
```

---

### Task 4: Tabela `edital_cache` (cache IA compartilhado)

**Files:**
- Create: `supabase/migrations/20260514120300_cronograma_v2_edital_cache.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: edital_cache (compartilhado, lookup por cargo+edital)
-- DOWN: DROP TABLE edital_cache

CREATE TABLE IF NOT EXISTS edital_cache (
  cargo_id INTEGER NOT NULL,
  edital_id INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  decomposicao JSONB NOT NULL,
  ai_model TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cargo_id, edital_id)
);

CREATE INDEX IF NOT EXISTS ix_edital_cache_last_validated
  ON edital_cache(last_validated_at);

COMMENT ON TABLE edital_cache IS
  'Cache compartilhado da decomposição IA por edital. Invalidação por mudança de payload_hash. Reduz custo de IA: 1 user paga, todos do mesmo cargo aproveitam.';
```

- [ ] **Step 2: Adicionar verify**

Append:

```sql
-- edital_cache
SELECT tablename FROM pg_tables WHERE tablename = 'edital_cache';
SELECT indexname FROM pg_indexes WHERE tablename = 'edital_cache';

BEGIN;
  INSERT INTO edital_cache (cargo_id, edital_id, payload_hash, decomposicao, ai_model)
  VALUES (1, 1, 'abc123', '{"disciplinas":[]}'::JSONB, 'claude-haiku-4.5');

  SELECT COUNT(*) FROM edital_cache;  -- esperado: 1
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

Expected: row visível em `pg_tables`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120300_cronograma_v2_edital_cache.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add edital_cache shared IA decomposition cache"
```

---

### Task 5: Tabela `plano_predictions_history` + view `plano_predictions`

**Files:**
- Create: `supabase/migrations/20260514120400_cronograma_v2_predictions.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: plano_predictions_history (append-only) + view plano_predictions (última row por plano)
-- DOWN: DROP VIEW plano_predictions; DROP TABLE plano_predictions_history

CREATE TABLE IF NOT EXISTS plano_predictions_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  coverage_pct NUMERIC(5,2) NOT NULL CHECK (coverage_pct >= 0 AND coverage_pct <= 100),
  slack_weeks NUMERIC(4,1),
  pace_index NUMERIC(4,2),
  weakest_disciplinas JSONB,
  recommendations JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_predictions_plano_time
  ON plano_predictions_history(plano_id, computed_at DESC);

CREATE OR REPLACE VIEW plano_predictions AS
SELECT DISTINCT ON (plano_id) *
FROM plano_predictions_history
ORDER BY plano_id, computed_at DESC;

COMMENT ON TABLE plano_predictions_history IS
  'Histórico append-only de predições do engine. View plano_predictions retorna última de cada plano.';
```

- [ ] **Step 2: Adicionar verify**

Append:

```sql
-- plano_predictions
SELECT tablename FROM pg_tables WHERE tablename = 'plano_predictions_history';
SELECT viewname FROM pg_views WHERE viewname = 'plano_predictions';

BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000001',
          'Test plan', CURRENT_DATE, CURRENT_DATE + 60, 'continuo', 'ativo');

  INSERT INTO plano_predictions_history (plano_id, coverage_pct, slack_weeks, pace_index)
  VALUES ('00000000-0000-0000-0000-0000000000bb', 87.5, 2.0, 1.0);
  INSERT INTO plano_predictions_history (plano_id, coverage_pct, slack_weeks, pace_index)
  VALUES ('00000000-0000-0000-0000-0000000000bb', 92.0, 2.5, 1.05);

  SELECT coverage_pct FROM plano_predictions WHERE plano_id = '00000000-0000-0000-0000-0000000000bb';
  -- esperado: 92.0 (última)

  -- Constraint test: 110% deveria falhar
  INSERT INTO plano_predictions_history (plano_id, coverage_pct)
  VALUES ('00000000-0000-0000-0000-0000000000bb', 110.0);
  -- ↑ esperado: ERROR ('coverage_pct' check constraint violated)
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

Expected: tabela + view existem. Constraint `coverage_pct <= 100` impede inserir 110.0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120400_cronograma_v2_predictions.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add plano_predictions_history + last-value view"
```

---

### Task 6: Tabela `plan_events` (event bus, append-only, partitioned)

**Files:**
- Create: `supabase/migrations/20260514120500_cronograma_v2_plan_events.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: plan_events event bus particionado
-- DOWN: DROP TABLE plan_events

CREATE SEQUENCE IF NOT EXISTS plan_events_seq;

CREATE TABLE IF NOT EXISTS plan_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_estudo(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  sequence_number BIGINT NOT NULL DEFAULT nextval('plan_events_seq'),
  payload JSONB NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  dead_letter BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id, fired_at)
) PARTITION BY RANGE (fired_at);

CREATE TABLE IF NOT EXISTS plan_events_2026_05 PARTITION OF plan_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS plan_events_2026_06 PARTITION OF plan_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS plan_events_default PARTITION OF plan_events DEFAULT;

CREATE INDEX IF NOT EXISTS ix_plan_events_plano_fired
  ON plan_events(plano_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS ix_plan_events_unprocessed
  ON plan_events(fired_at) WHERE processed_at IS NULL AND dead_letter = FALSE;
CREATE INDEX IF NOT EXISTS ix_plan_events_sequence
  ON plan_events(sequence_number);

COMMENT ON TABLE plan_events IS
  'Event bus append-only. Eventos publicados por triggers/jobs, consumidos por handlers (PL/pgSQL e TS via Realtime). Ordering garantido por sequence_number.';
```

- [ ] **Step 2: Adicionar verify**

Append:

```sql
-- plan_events
SELECT tablename FROM pg_tables WHERE tablename LIKE 'plan_events%';
SELECT indexname FROM pg_indexes WHERE tablename = 'plan_events' OR tablename LIKE 'plan_events_%';
SELECT 'plan_events_seq exists' AS msg WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'plan_events_seq');

BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-000000000001',
          'Test plan', CURRENT_DATE, CURRENT_DATE + 60, 'continuo', 'ativo');

  INSERT INTO plan_events (plano_id, event_type, payload)
  VALUES ('00000000-0000-0000-0000-0000000000cc', 'item.completed', '{"item_id": "x"}'::JSONB);
  INSERT INTO plan_events (plano_id, event_type, payload)
  VALUES ('00000000-0000-0000-0000-0000000000cc', 'week.completed', '{"week": 1}'::JSONB);

  -- sequence_number deve ser monotônico
  SELECT event_type, sequence_number FROM plan_events
  WHERE plano_id = '00000000-0000-0000-0000-0000000000cc'
  ORDER BY sequence_number;
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

Expected: 2 rows inseridas com `sequence_number` distintos e crescentes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120500_cronograma_v2_plan_events.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add plan_events event bus with partitioning and sequence"
```

---

### Task 7: Tabela `dead_letters` (eventos não processados)

**Files:**
- Create: `supabase/migrations/20260514120600_cronograma_v2_dead_letters.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: dead_letters (admin reprocessa manualmente)
-- DOWN: DROP TABLE dead_letters

CREATE TABLE IF NOT EXISTS dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  first_failed_at TIMESTAMPTZ NOT NULL,
  last_failed_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS ix_dead_letters_unresolved
  ON dead_letters(last_failed_at DESC) WHERE resolved_at IS NULL;

COMMENT ON TABLE dead_letters IS
  'Eventos não processados após 3 tentativas. Acessível só por admin via /admin/cronograma. Botão "Reprocess" reinsere em plan_events.';
```

- [ ] **Step 2: Adicionar verify**

```sql
-- dead_letters
SELECT tablename FROM pg_tables WHERE tablename = 'dead_letters';
SELECT indexname FROM pg_indexes WHERE tablename = 'dead_letters';

BEGIN;
  INSERT INTO dead_letters (event_type, payload, error_message, attempts, first_failed_at, last_failed_at)
  VALUES ('item.completed', '{"foo":"bar"}'::JSONB, 'timeout', 3, NOW(), NOW());
  SELECT COUNT(*) FROM dead_letters;  -- esperado: 1
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120600_cronograma_v2_dead_letters.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add dead_letters table for failed event handlers"
```

---

### Task 8: Tabela `plano_config_history` (versionamento)

**Files:**
- Create: `supabase/migrations/20260514120700_cronograma_v2_config_history.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: plano_config_history (snapshots de config a cada mudança)
-- DOWN: DROP TABLE plano_config_history

CREATE TABLE IF NOT EXISTS plano_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plano_id, version)
);

CREATE INDEX IF NOT EXISTS ix_plano_config_history_plano_version
  ON plano_config_history(plano_id, version DESC);

COMMENT ON TABLE plano_config_history IS
  'Snapshots versionados de plano_config. Recalibração e items históricos referenciam version pra saber em qual capacidade foram planejados.';
```

- [ ] **Step 2: Adicionar verify**

```sql
-- plano_config_history
SELECT tablename FROM pg_tables WHERE tablename = 'plano_config_history';

BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-000000000001',
          'Test', CURRENT_DATE, CURRENT_DATE + 60, 'continuo', 'ativo');

  INSERT INTO plano_config_history (plano_id, version, snapshot)
  VALUES ('00000000-0000-0000-0000-0000000000dd', 1, '{"weekday_minutes": 180}'::JSONB);

  -- Versão duplicada deve falhar
  INSERT INTO plano_config_history (plano_id, version, snapshot)
  VALUES ('00000000-0000-0000-0000-0000000000dd', 1, '{}'::JSONB);
  -- ↑ esperado: ERROR (unique constraint)
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120700_cronograma_v2_config_history.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add plano_config_history for config versioning"
```

---

### Task 9: Tabela `feriados_nacionais` (compartilhado público)

**Files:**
- Create: `supabase/migrations/20260514120800_cronograma_v2_feriados.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: feriados_nacionais (lookup público; seed acontece na task 20)
-- DOWN: DROP TABLE feriados_nacionais

CREATE TABLE IF NOT EXISTS feriados_nacionais (
  data DATE PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  uf CHAR(2),
  cidade TEXT
);

CREATE INDEX IF NOT EXISTS ix_feriados_data_tipo ON feriados_nacionais(tipo, data);

COMMENT ON TABLE feriados_nacionais IS
  'Lookup de feriados nacionais/estaduais/municipais. Cronograma respeita data como exceção (capacidade=0).';
```

- [ ] **Step 2: Adicionar verify**

```sql
-- feriados_nacionais
SELECT tablename FROM pg_tables WHERE tablename = 'feriados_nacionais';

BEGIN;
  INSERT INTO feriados_nacionais (data, nome, tipo)
  VALUES ('2026-09-07', 'Independência do Brasil', 'nacional');
  SELECT COUNT(*) FROM feriados_nacionais;  -- esperado: 1
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120800_cronograma_v2_feriados.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add feriados_nacionais lookup table"
```

---

### Task 10: Tabela `plan_templates` (comunidade)

**Files:**
- Create: `supabase/migrations/20260514120900_cronograma_v2_plan_templates.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: plan_templates (oficial/publico/privado)
-- DOWN: DROP TABLE plan_templates

CREATE TABLE IF NOT EXISTS plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL CHECK (duracao_dias >= 14),
  config JSONB NOT NULL,
  uses_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 100)),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visibility plan_template_visibility NOT NULL DEFAULT 'privado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plan_templates_cargo_visibility
  ON plan_templates(cargo_id, visibility);
CREATE INDEX IF NOT EXISTS ix_plan_templates_popular
  ON plan_templates(cargo_id, uses_count DESC) WHERE visibility IN ('publico', 'oficial');

COMMENT ON TABLE plan_templates IS
  'Templates de plano (oficiais pela equipe + comunidade). uses_count e success_rate atualizados por cron.';
```

- [ ] **Step 2: Adicionar verify**

```sql
-- plan_templates
SELECT tablename FROM pg_tables WHERE tablename = 'plan_templates';

BEGIN;
  INSERT INTO plan_templates (cargo_id, nome, duracao_dias, config, visibility)
  VALUES (1, 'PF Agente · 90 dias · Equilibrado', 90, '{"mix_ratio":{"teoria":0.4}}'::JSONB, 'oficial');
  SELECT COUNT(*) FROM plan_templates;  -- esperado: 1

  -- duracao < 14 deve falhar
  INSERT INTO plan_templates (cargo_id, nome, duracao_dias, config)
  VALUES (1, 'Invalid', 7, '{}'::JSONB);
  -- ↑ esperado: ERROR
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514120900_cronograma_v2_plan_templates.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add plan_templates community + official"
```

---

### Task 11: Tabelas auxiliares (graphql_cache, analytics_events, rate_limit_buckets, feature_flags, ai_quality_feedback)

**Files:**
- Create: `supabase/migrations/20260514121000_cronograma_v2_auxiliary.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: tabelas auxiliares (cache GraphQL, analytics UX, rate limit, feature flags, IA feedback)
-- DOWN: DROP em ordem reversa

-- 1. graphql_cache (KV com TTL)
CREATE TABLE IF NOT EXISTS graphql_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_graphql_cache_expires ON graphql_cache(expires_at);

-- 2. analytics_events (funil UX)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_analytics_events_user_event
  ON analytics_events(user_id, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_analytics_events_event_time
  ON analytics_events(event_name, occurred_at DESC);

-- 3. rate_limit_buckets
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, action, window_start)
);

-- 4. feature_flags
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct INTEGER NOT NULL DEFAULT 0 CHECK (rollout_pct >= 0 AND rollout_pct <= 100),
  user_allowlist UUID[] NOT NULL DEFAULT '{}',
  user_blocklist UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ai_quality_feedback
CREATE TABLE IF NOT EXISTS ai_quality_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtopico_id UUID,  -- FK preenchida quando subtopicos tiver schema completo; sem REFERENCES por enquanto
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ai_feedback_subtopico
  ON ai_quality_feedback(subtopico_id);

-- Função pra checar feature flag por user (usada por handlers)
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_name TEXT,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_flag feature_flags%ROWTYPE;
  v_user_hash INTEGER;
BEGIN
  SELECT * INTO v_flag FROM feature_flags WHERE flag_name = p_flag_name;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF NOT v_flag.enabled THEN RETURN FALSE; END IF;
  IF p_user_id = ANY(v_flag.user_blocklist) THEN RETURN FALSE; END IF;
  IF p_user_id = ANY(v_flag.user_allowlist) THEN RETURN TRUE; END IF;
  -- Hash determinístico do user pra rollout consistente
  v_user_hash := ABS(hashtext(p_user_id::TEXT)) % 100;
  RETURN v_user_hash < v_flag.rollout_pct;
END $$;

COMMENT ON FUNCTION is_feature_enabled IS 'Verifica se feature_flag está ativa para user específico (allowlist > blocklist > rollout_pct).';
```

- [ ] **Step 2: Adicionar verify**

```sql
-- Auxiliary tables
SELECT tablename FROM pg_tables WHERE tablename IN (
  'graphql_cache', 'analytics_events', 'rate_limit_buckets', 'feature_flags', 'ai_quality_feedback'
) ORDER BY tablename;
-- esperado: 5 rows

-- Feature flag function
SELECT proname FROM pg_proc WHERE proname = 'is_feature_enabled';

BEGIN;
  INSERT INTO feature_flags (flag_name, enabled, rollout_pct) VALUES ('test_flag', TRUE, 50);

  -- User com hash < 50 → TRUE; >= 50 → FALSE. Verifica que ambos os casos existem.
  SELECT is_feature_enabled('test_flag', '00000000-0000-0000-0000-000000000001');
  SELECT is_feature_enabled('test_flag', '00000000-0000-0000-0000-000000000099');

  -- Blocklist sempre FALSE
  UPDATE feature_flags SET user_blocklist = ARRAY['00000000-0000-0000-0000-000000000001'::UUID]
  WHERE flag_name = 'test_flag';
  SELECT is_feature_enabled('test_flag', '00000000-0000-0000-0000-000000000001');  -- FALSE

  -- Allowlist sempre TRUE (mesmo com rollout=0)
  UPDATE feature_flags SET rollout_pct = 0, user_allowlist = ARRAY['00000000-0000-0000-0000-000000000002'::UUID]
  WHERE flag_name = 'test_flag';
  SELECT is_feature_enabled('test_flag', '00000000-0000-0000-0000-000000000002');  -- TRUE
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

Expected: 5 tabelas + função `is_feature_enabled`. Testes de blocklist/allowlist/rollout retornam valores esperados.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121000_cronograma_v2_auxiliary.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): add auxiliary tables (graphql_cache, analytics, rate_limit, flags, ai_feedback)"
```

---

### Task 12: ALTER `planos_estudo` (cargo_snapshot, template_id, algorithm_variant, deleted_at)

**Files:**
- Create: `supabase/migrations/20260514121100_cronograma_v2_alter_planos_estudo.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: novas colunas em planos_estudo
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE planos_estudo
  ADD COLUMN IF NOT EXISTS cargo_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS algorithm_variant TEXT NOT NULL DEFAULT 'v2_default',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_planos_estudo_user_active_not_deleted
  ON planos_estudo(user_id, status) WHERE deleted_at IS NULL;

COMMENT ON COLUMN planos_estudo.cargo_snapshot IS 'Snapshot do cargo no momento da criação (nome, edital_id, qtd_disciplinas)';
COMMENT ON COLUMN planos_estudo.template_id IS 'Template usado como ponto de partida, se aplicável';
COMMENT ON COLUMN planos_estudo.algorithm_variant IS 'Variante do algoritmo usada (pra A/B testing futuro)';
COMMENT ON COLUMN planos_estudo.deleted_at IS 'Soft delete; rows com valor não vazio não aparecem em queries do user';
```

- [ ] **Step 2: Adicionar verify**

```sql
-- Verifica que novas colunas existem em planos_estudo
SELECT column_name FROM information_schema.columns
WHERE table_name = 'planos_estudo'
  AND column_name IN ('cargo_snapshot', 'template_id', 'algorithm_variant', 'deleted_at')
ORDER BY column_name;
-- esperado: 4 rows
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121100_cronograma_v2_alter_planos_estudo.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): alter planos_estudo with cargo_snapshot, template_id, soft delete"
```

---

### Task 13: ALTER `plano_config` (simulados, redação, material, horário)

**Files:**
- Create: `supabase/migrations/20260514121200_cronograma_v2_alter_plano_config.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: novas colunas em plano_config
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE plano_config
  ADD COLUMN IF NOT EXISTS simulados_freq simulados_freq_enum NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS tem_redacao BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_material tipo_material_enum NOT NULL DEFAULT 'misto',
  ADD COLUMN IF NOT EXISTS horario_preferido horario_preferido_enum NOT NULL DEFAULT 'flexivel';

COMMENT ON COLUMN plano_config.simulados_freq IS 'Frequência de simulados periódicos no plano';
COMMENT ON COLUMN plano_config.tem_redacao IS 'Se TRUE, reserva ~1h/semana pra redação';
COMMENT ON COLUMN plano_config.tipo_material IS 'Tipo de material preferido (afeta duração de blocos)';
COMMENT ON COLUMN plano_config.horario_preferido IS 'Horário em que o user prefere estudar (UX hint)';
```

- [ ] **Step 2: Adicionar verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'plano_config'
  AND column_name IN ('simulados_freq', 'tem_redacao', 'tipo_material', 'horario_preferido')
ORDER BY column_name;
-- esperado: 4 rows
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121200_cronograma_v2_alter_plano_config.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): alter plano_config with simulados, redacao, material, horario"
```

---

### Task 14: ALTER `plano_disciplinas` (nivel, ponto_fraco, excluded)

**Files:**
- Create: `supabase/migrations/20260514121300_cronograma_v2_alter_plano_disciplinas.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: novas colunas em plano_disciplinas
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE plano_disciplinas
  ADD COLUMN IF NOT EXISTS nivel_conhecimento nivel_conhecimento_enum NOT NULL DEFAULT 'intermediario',
  ADD COLUMN IF NOT EXISTS is_ponto_fraco BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS excluded_subtopico_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS ix_plano_disciplinas_ponto_fraco
  ON plano_disciplinas(plano_id) WHERE is_ponto_fraco = TRUE;

COMMENT ON COLUMN plano_disciplinas.nivel_conhecimento IS 'Nível declarado pelo user. Ajusta multiplicadores de tempo e mix interno.';
COMMENT ON COLUMN plano_disciplinas.is_ponto_fraco IS 'Se TRUE, recebe +30% peso adicional. Máximo 3 por plano (enforced em RPC).';
COMMENT ON COLUMN plano_disciplinas.excluded_subtopico_ids IS 'Subtópicos desmarcados via drill-down opcional.';
```

- [ ] **Step 2: Adicionar verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'plano_disciplinas'
  AND column_name IN ('nivel_conhecimento', 'is_ponto_fraco', 'excluded_subtopico_ids')
ORDER BY column_name;
-- esperado: 3 rows
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121300_cronograma_v2_alter_plano_disciplinas.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): alter plano_disciplinas with nivel, ponto_fraco, excluded subtopicos"
```

---

### Task 15: ALTER `schedule_items` (anticipated, FSRS, parent, optimistic lock)

**Files:**
- Create: `supabase/migrations/20260514121400_cronograma_v2_alter_schedule_items.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: novas colunas em schedule_items
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS is_anticipated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fsrs_due_date DATE,
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unlocked_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS ix_schedule_items_fsrs_due
  ON schedule_items(fsrs_due_date) WHERE fsrs_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_schedule_items_parent
  ON schedule_items(parent_item_id) WHERE parent_item_id IS NOT NULL;

COMMENT ON COLUMN schedule_items.is_anticipated IS 'TRUE quando user puxou da semana seguinte pra atual';
COMMENT ON COLUMN schedule_items.fsrs_due_date IS 'Data ótima FSRS pra revisões (não move em recalibração)';
COMMENT ON COLUMN schedule_items.parent_item_id IS 'Item de teoria que gerou esta revisão';
COMMENT ON COLUMN schedule_items.version IS 'Optimistic lock pra concorrência';
```

- [ ] **Step 2: Adicionar verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'schedule_items'
  AND column_name IN ('is_anticipated', 'fsrs_due_date', 'parent_item_id', 'unlocked_early', 'version')
ORDER BY column_name;
-- esperado: 5 rows
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121400_cronograma_v2_alter_schedule_items.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): alter schedule_items with FSRS, anticipation, parent, version"
```

---

### Task 16: ALTER `topicos` (referencias_legais, nome_curto, ai_decomposed_at)

**Files:**
- Create: `supabase/migrations/20260514121500_cronograma_v2_alter_topicos.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: novas colunas em topicos
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE topicos
  ADD COLUMN IF NOT EXISTS referencias_legais JSONB,
  ADD COLUMN IF NOT EXISTS ai_decomposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nome_curto TEXT;

COMMENT ON COLUMN topicos.referencias_legais IS 'Lista de leis/decretos extraídos pela IA (ex: ["Lei 8.666/93"])';
COMMENT ON COLUMN topicos.ai_decomposed_at IS 'Timestamp da última decomposição IA';
COMMENT ON COLUMN topicos.nome_curto IS 'Nome resumido gerado pela IA (3-6 palavras)';
```

- [ ] **Step 2: Adicionar verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'topicos'
  AND column_name IN ('referencias_legais', 'ai_decomposed_at', 'nome_curto')
ORDER BY column_name;
-- esperado: 3 rows
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121500_cronograma_v2_alter_topicos.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): alter topicos with referencias_legais, nome_curto, ai_decomposed_at"
```

---

### Task 17: ALTER `weekly_stats` (unlocked_early, overflow)

**Files:**
- Create: `supabase/migrations/20260514121600_cronograma_v2_alter_weekly_stats.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: novas colunas em weekly_stats
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE weekly_stats
  ADD COLUMN IF NOT EXISTS unlocked_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overflow BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN weekly_stats.unlocked_early IS 'TRUE quando semana foi destravada antecipadamente';
COMMENT ON COLUMN weekly_stats.overflow IS 'TRUE quando capacidade insuficiente forçou overflow';
```

- [ ] **Step 2: Adicionar verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'weekly_stats'
  AND column_name IN ('unlocked_early', 'overflow')
ORDER BY column_name;
-- esperado: 2 rows
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121600_cronograma_v2_alter_weekly_stats.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): alter weekly_stats with unlocked_early and overflow flags"
```

---

### Task 18: Triggers reativos (sem handlers ainda, só publicação de eventos)

**Files:**
- Create: `supabase/migrations/20260514121700_cronograma_v2_triggers.sql`
- Create: `supabase/verify/cronograma_v2/verify_04_triggers.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: triggers que publicam eventos. Handlers reais vêm em sub-plan 5.
-- DOWN: DROP TRIGGER ... DROP FUNCTION

-- 1. trg_publish_completion_event: INSERT em plan_events quando schedule_items.status → 'concluido'
CREATE OR REPLACE FUNCTION fn_publish_completion_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluido') THEN
    INSERT INTO plan_events (plano_id, event_type, payload)
    VALUES (NEW.plano_id, 'item.completed', jsonb_build_object(
      'item_id', NEW.id,
      'week_number', NEW.week_number,
      'type', NEW.type,
      'completed_at', NEW.completed_at,
      'subtopico_id', NEW.subtopico_id
    ));
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pulado') THEN
    INSERT INTO plan_events (plano_id, event_type, payload)
    VALUES (NEW.plano_id, 'item.skipped', jsonb_build_object(
      'item_id', NEW.id,
      'week_number', NEW.week_number
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publish_completion_event ON schedule_items;
CREATE TRIGGER trg_publish_completion_event
  AFTER UPDATE OF status ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION fn_publish_completion_event();

-- 2. trg_publish_week_completed: INSERT em plan_events quando weekly_stats.completion_pct ≥ 100
CREATE OR REPLACE FUNCTION fn_publish_week_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE'
      AND (OLD.completion_pct IS NULL OR OLD.completion_pct < 100)
      AND NEW.completion_pct >= 100) THEN
    INSERT INTO plan_events (plano_id, event_type, payload)
    VALUES (NEW.plano_id, 'week.completed', jsonb_build_object(
      'week_number', NEW.week_number
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publish_week_completed ON weekly_stats;
CREATE TRIGGER trg_publish_week_completed
  AFTER UPDATE OF completion_pct ON weekly_stats
  FOR EACH ROW EXECUTE FUNCTION fn_publish_week_completed();

-- 3. Increment version on schedule_items UPDATE (optimistic lock)
CREATE OR REPLACE FUNCTION fn_increment_schedule_item_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_increment_version ON schedule_items;
CREATE TRIGGER trg_increment_version
  BEFORE UPDATE ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION fn_increment_schedule_item_version();

COMMENT ON FUNCTION fn_publish_completion_event IS 'Trigger: publica item.completed ou item.skipped em plan_events';
COMMENT ON FUNCTION fn_publish_week_completed IS 'Trigger: publica week.completed quando completion_pct cruza 100%';
COMMENT ON FUNCTION fn_increment_schedule_item_version IS 'Trigger: incrementa version pra optimistic lock';
```

- [ ] **Step 2: Criar verify_04_triggers.sql**

```sql
-- Triggers existem
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table IN ('schedule_items', 'weekly_stats')
  AND trigger_name IN ('trg_publish_completion_event', 'trg_publish_week_completed', 'trg_increment_version')
ORDER BY trigger_name;
-- esperado: 3 rows

-- Funções existem
SELECT proname FROM pg_proc
WHERE proname IN ('fn_publish_completion_event', 'fn_publish_week_completed', 'fn_increment_schedule_item_version')
ORDER BY proname;
-- esperado: 3 rows

-- Smoke test: simular completion
BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-000000000001',
          'Test', CURRENT_DATE, CURRENT_DATE + 60, 'continuo', 'ativo');
  INSERT INTO schedule_items (id, user_id, plano_id, scheduled_date, type, status, title)
  VALUES ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-0000000000ee', CURRENT_DATE, 'estudo_inicial_p1', 'pendente', 'Test item');

  -- Update status; trigger deve publicar evento
  UPDATE schedule_items SET status = 'concluido', completed_at = NOW()
  WHERE id = '00000000-0000-0000-0000-0000000000ff';

  SELECT event_type, payload->>'item_id' AS item_id FROM plan_events
  WHERE plano_id = '00000000-0000-0000-0000-0000000000ee';
  -- esperado: 1 row, event_type='item.completed'

  SELECT version FROM schedule_items WHERE id = '00000000-0000-0000-0000-0000000000ff';
  -- esperado: 2 (era 1, incrementou)
ROLLBACK;
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_04_triggers.sql"
```

Expected: 3 triggers + 3 funções existem. Event publicado após UPDATE. Version incrementada.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121700_cronograma_v2_triggers.sql supabase/verify/cronograma_v2/verify_04_triggers.sql
git commit -m "feat(cronograma-v2): add triggers for event publication and version increment"
```

---

### Task 19: RLS policies em todas as novas tabelas

**Files:**
- Create: `supabase/migrations/20260514121800_cronograma_v2_rls.sql`
- Create: `supabase/verify/cronograma_v2/verify_05_rls.sql`

- [ ] **Step 1: Criar migração**

```sql
-- UP: RLS policies para todas as novas tabelas
-- DOWN: DROP POLICY ... ALTER TABLE ... DISABLE ROW LEVEL SECURITY

-- 1. plan_decisions: leitura via plano do user
ALTER TABLE plan_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_decisions_select ON plan_decisions;
CREATE POLICY plan_decisions_select ON plan_decisions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM planos_estudo p
    WHERE p.id = plan_decisions.plano_id AND p.user_id = auth.uid()
  ));

-- 2. behavioral_signals: só o próprio user
ALTER TABLE behavioral_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS behavioral_signals_own ON behavioral_signals;
CREATE POLICY behavioral_signals_own ON behavioral_signals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. edital_cache: leitura pública (authenticated); escrita via service_role
ALTER TABLE edital_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS edital_cache_read ON edital_cache;
CREATE POLICY edital_cache_read ON edital_cache
  FOR SELECT TO authenticated USING (TRUE);

-- 4. plano_predictions_history: leitura via plano do user
ALTER TABLE plano_predictions_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plano_predictions_history_select ON plano_predictions_history;
CREATE POLICY plano_predictions_history_select ON plano_predictions_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM planos_estudo p
    WHERE p.id = plano_predictions_history.plano_id AND p.user_id = auth.uid()
  ));

-- 5. plan_events: leitura via plano do user; escrita via trigger
ALTER TABLE plan_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_events_select ON plan_events;
CREATE POLICY plan_events_select ON plan_events
  FOR SELECT TO authenticated
  USING (
    plano_id IS NULL OR
    EXISTS (SELECT 1 FROM planos_estudo p WHERE p.id = plan_events.plano_id AND p.user_id = auth.uid())
  );

-- 6. dead_letters: só admin (role check via app_metadata)
ALTER TABLE dead_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dead_letters_admin ON dead_letters;
CREATE POLICY dead_letters_admin ON dead_letters
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );

-- 7. plano_config_history: leitura via plano do user
ALTER TABLE plano_config_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plano_config_history_select ON plano_config_history;
CREATE POLICY plano_config_history_select ON plano_config_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM planos_estudo p
    WHERE p.id = plano_config_history.plano_id AND p.user_id = auth.uid()
  ));

-- 8. feriados_nacionais: leitura pública
ALTER TABLE feriados_nacionais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feriados_public_read ON feriados_nacionais;
CREATE POLICY feriados_public_read ON feriados_nacionais
  FOR SELECT TO authenticated USING (TRUE);

-- 9. plan_templates: publicos + próprios privados
ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_templates_select ON plan_templates;
CREATE POLICY plan_templates_select ON plan_templates
  FOR SELECT TO authenticated
  USING (visibility IN ('publico', 'oficial') OR created_by = auth.uid());

-- 10. graphql_cache: leitura pública (KV genérico)
ALTER TABLE graphql_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS graphql_cache_read ON graphql_cache;
CREATE POLICY graphql_cache_read ON graphql_cache
  FOR SELECT TO authenticated USING (TRUE);

-- 11. analytics_events: INSERT do próprio user; SELECT só admin
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_insert_own ON analytics_events;
CREATE POLICY analytics_insert_own ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS analytics_select_admin ON analytics_events;
CREATE POLICY analytics_select_admin ON analytics_events
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- 12. rate_limit_buckets: managed pelo service_role (sem policies pra authenticated)
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- 13. feature_flags: leitura pública; escrita só admin
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_flags_read ON feature_flags;
CREATE POLICY feature_flags_read ON feature_flags
  FOR SELECT TO authenticated USING (TRUE);

-- 14. ai_quality_feedback: INSERT do próprio user; SELECT admin
ALTER TABLE ai_quality_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_feedback_insert ON ai_quality_feedback;
CREATE POLICY ai_feedback_insert ON ai_quality_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Criar verify_05_rls.sql**

```sql
-- Lista RLS ativadas
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'plan_decisions', 'behavioral_signals', 'edital_cache',
    'plano_predictions_history', 'plan_events', 'dead_letters',
    'plano_config_history', 'feriados_nacionais', 'plan_templates',
    'graphql_cache', 'analytics_events', 'rate_limit_buckets',
    'feature_flags', 'ai_quality_feedback'
  )
ORDER BY tablename;
-- esperado: 14 rows, rowsecurity = true em todas

-- Lista policies por tabela
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'plan_decisions', 'behavioral_signals', 'edital_cache',
    'plano_predictions_history', 'plan_events', 'dead_letters',
    'plano_config_history', 'feriados_nacionais', 'plan_templates',
    'graphql_cache', 'analytics_events', 'feature_flags', 'ai_quality_feedback'
  )
ORDER BY tablename, policyname;
-- esperado: pelo menos 1 policy por tabela
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_05_rls.sql"
```

Expected: 14 tabelas com `rowsecurity=true`; >=14 policies listadas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121800_cronograma_v2_rls.sql supabase/verify/cronograma_v2/verify_05_rls.sql
git commit -m "feat(cronograma-v2): enable RLS on all new tables with appropriate policies"
```

---

### Task 20: Seed inicial de feriados nacionais 2026-2028

**Files:**
- Create: `supabase/migrations/20260514121900_cronograma_v2_seed_feriados.sql`
- Modify: `supabase/verify/cronograma_v2/verify_02_tables.sql`

- [ ] **Step 1: Criar migração com seed**

```sql
-- UP: seed inicial de feriados nacionais 2026-2028 (datas fixas + móveis calculadas)
-- DOWN: TRUNCATE feriados_nacionais ou DELETE específico (não destrutivo, idempotente via ON CONFLICT)

INSERT INTO feriados_nacionais (data, nome, tipo) VALUES
  -- 2026
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval (segunda)', 'nacional'),
  ('2026-02-17', 'Carnaval (terça)', 'nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalhador', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia da Consciência Negra', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional'),
  -- 2027
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-02-08', 'Carnaval (segunda)', 'nacional'),
  ('2027-02-09', 'Carnaval (terça)', 'nacional'),
  ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'),
  ('2027-05-01', 'Dia do Trabalhador', 'nacional'),
  ('2027-05-27', 'Corpus Christi', 'nacional'),
  ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'),
  ('2027-11-20', 'Dia da Consciência Negra', 'nacional'),
  ('2027-12-25', 'Natal', 'nacional'),
  -- 2028
  ('2028-01-01', 'Confraternização Universal', 'nacional'),
  ('2028-02-28', 'Carnaval (segunda)', 'nacional'),
  ('2028-02-29', 'Carnaval (terça)', 'nacional'),
  ('2028-04-14', 'Sexta-feira Santa', 'nacional'),
  ('2028-04-21', 'Tiradentes', 'nacional'),
  ('2028-05-01', 'Dia do Trabalhador', 'nacional'),
  ('2028-06-15', 'Corpus Christi', 'nacional'),
  ('2028-09-07', 'Independência do Brasil', 'nacional'),
  ('2028-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2028-11-02', 'Finados', 'nacional'),
  ('2028-11-15', 'Proclamação da República', 'nacional'),
  ('2028-11-20', 'Dia da Consciência Negra', 'nacional'),
  ('2028-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;
```

- [ ] **Step 2: Adicionar verify**

Append em `verify_02_tables.sql`:

```sql
-- Seed feriados
SELECT COUNT(*) AS total_feriados FROM feriados_nacionais WHERE tipo = 'nacional';
-- esperado: >= 39 (13 por ano × 3 anos)

SELECT data, nome FROM feriados_nacionais
WHERE data BETWEEN '2026-09-01' AND '2026-09-30'
ORDER BY data;
-- esperado: 7 de setembro
```

- [ ] **Step 3: Aplicar e verificar**

```bash
npx supabase migration up --linked
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_02_tables.sql"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514121900_cronograma_v2_seed_feriados.sql supabase/verify/cronograma_v2/verify_02_tables.sql
git commit -m "feat(cronograma-v2): seed feriados nacionais 2026-2028"
```

---

### Task 21: Regenerar `src/types/database.ts`

**Files:**
- Modify: `src/types/database.ts` (regenerado, não editado manualmente)

- [ ] **Step 1: Regenerar tipos via Supabase CLI**

```bash
npx --silent supabase gen types typescript --project-id xmtleqquivcukwgdexhc 2>/dev/null > src/types/database.ts
```

- [ ] **Step 2: Verificar regeneração**

```bash
head -3 src/types/database.ts
wc -l src/types/database.ts
```

Expected: arquivo começa com `export type Json = ...`. Tem >2900 linhas (cresceu com novas tabelas).

- [ ] **Step 3: Confirmar que tipos das novas tabelas existem**

```bash
grep -c "plan_decisions" src/types/database.ts
grep -c "behavioral_signals" src/types/database.ts
grep -c "edital_cache" src/types/database.ts
grep -c "plan_events" src/types/database.ts
grep -c "plan_templates" src/types/database.ts
```

Expected: cada grep retorna número > 0.

- [ ] **Step 4: Verificar type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "TS[0-9]+" | head -20
```

Expected: nenhum erro novo em arquivos relacionados a cronograma. Erros pré-existentes em outras áreas são aceitáveis.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(cronograma-v2): regen database types after schema migrations"
```

---

### Task 22: Tipos derivados — `src/types/cronograma-v2.ts`

**Files:**
- Create: `src/types/cronograma-v2.ts`

- [ ] **Step 1: Criar arquivo com tipos derivados/auxiliares**

Conteúdo de `src/types/cronograma-v2.ts`:

```typescript
/**
 * Tipos derivados do Cronograma V2 — não saem do gen types.
 * Espelha enums e payloads do plan_events.
 */
import type { Database } from './database';

// =============================================================================
// Enums (re-exports do database.ts pra ergonomia)
// =============================================================================

export type NivelConhecimento = Database['public']['Enums']['nivel_conhecimento_enum'];
export type SimuladosFreq = Database['public']['Enums']['simulados_freq_enum'];
export type TipoMaterial = Database['public']['Enums']['tipo_material_enum'];
export type HorarioPreferido = Database['public']['Enums']['horario_preferido_enum'];
export type PlanTemplateVisibility = Database['public']['Enums']['plan_template_visibility'];

// =============================================================================
// Event payloads (plan_events.payload tipados)
// =============================================================================

export type PlanEventType =
  | 'item.completed'
  | 'item.skipped'
  | 'week.completed'
  | 'week.behind'
  | 'pendencia.created'
  | 'level_drift.detected'
  | 'template.copied';

export interface PlanEventPayloads {
  'item.completed': {
    item_id: string;
    week_number: number;
    type: string;
    completed_at: string | null;
    subtopico_id: string | null;
  };
  'item.skipped': {
    item_id: string;
    week_number: number;
    reason?: string;
  };
  'week.completed': {
    week_number: number;
  };
  'week.behind': {
    week_number: number;
    current_pct: number;
  };
  'pendencia.created': {
    from_week: number;
    items: string[];
    total_minutes: number;
  };
  'level_drift.detected': {
    disciplina_id: string;
    declared_level: NivelConhecimento;
    observed_level: NivelConhecimento;
    confidence: number;
  };
  'template.copied': {
    template_id: string;
    plano_id: string;
  };
}

// =============================================================================
// Decomposição IA (cache estruturado)
// =============================================================================

export interface EditalDecomposicao {
  version: string;
  generated_by: string;
  disciplinas: Array<{
    external_id: number;
    nome: string;
    topicos: Array<{
      external_id: number;
      nome_original: string;
      nome_curto: string;
      conceitos_pai: string[];
      referencias_legais: string[];
      subtopicos: Array<{
        nome: string;
        duracao_min: number;
        conceito_pai?: string;
      }>;
    }>;
  }>;
}

// =============================================================================
// Cargo snapshot (planos_estudo.cargo_snapshot)
// =============================================================================

export interface CargoSnapshot {
  cargo_id: number;
  nome: string;
  edital_id: number;
  qtd_disciplinas: number;
  captured_at: string;  // ISO timestamp
}

// =============================================================================
// Reason codes (plan_decisions.reason)
// =============================================================================

export type ReasonCode =
  | 'absorption_phase'
  | 'consolidation_phase'
  | 'fsrs_optimal'
  | 'round_robin_disciplina'
  | 'ponto_fraco_boost'
  | 'nivel_iniciante_multiplier'
  | 'nivel_avancado_multiplier'
  | 'pendencia_carryover'
  | 'simulado_periodic'
  | 'redacao_weekly'
  | 'feriado_skip'
  | 'week_completed_early'
  | 'week_behind';

export const REASON_LABELS: Record<ReasonCode, string> = {
  absorption_phase: 'Fase de absorção de conteúdo novo',
  consolidation_phase: 'Fase de consolidação + revisões',
  fsrs_optimal: 'Timing FSRS calculado pelo desempenho',
  round_robin_disciplina: 'Round-robin entre disciplinas',
  ponto_fraco_boost: 'Mais peso por ponto fraco declarado',
  nivel_iniciante_multiplier: 'Tempo ampliado por nível iniciante',
  nivel_avancado_multiplier: 'Tempo reduzido por nível avançado',
  pendencia_carryover: 'Reagendado de semana anterior',
  simulado_periodic: 'Simulado periódico configurado',
  redacao_weekly: 'Bloco de redação semanal',
  feriado_skip: 'Pulado por feriado nacional',
  week_completed_early: 'Recalibrado por término antecipado',
  week_behind: 'Detectado atraso na semana',
};
```

- [ ] **Step 2: Verificar type-check do novo arquivo**

```bash
npx tsc --noEmit src/types/cronograma-v2.ts 2>&1 | grep -E "TS[0-9]+" | head -10
```

Expected: vazio (sem erros).

- [ ] **Step 3: Commit**

```bash
git add src/types/cronograma-v2.ts
git commit -m "feat(cronograma-v2): add derived TS types (event payloads, decomposicao, cargo snapshot)"
```

---

### Task 23: Integration test final — fluxo completo simulado

**Files:**
- Create: `supabase/verify/cronograma_v2/verify_07_full_insert_flow.sql`

- [ ] **Step 1: Criar script de integration test**

Conteúdo de `verify_07_full_insert_flow.sql`:

```sql
-- Simula fluxo completo: criar plano → config → disciplinas → schedule_items → atualizações
-- Tudo dentro de BEGIN/ROLLBACK pra não sujar o banco

BEGIN;

  -- 1. User fake
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000999', 'integration@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Plano com cargo_snapshot e novos campos
  INSERT INTO planos_estudo (
    id, user_id, nome, data_inicio, data_prova, mode, status,
    cargo_snapshot, algorithm_variant
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000999',
    'Integration Test',
    CURRENT_DATE,
    CURRENT_DATE + 90,
    'continuo',
    'ativo',
    '{"cargo_id": 1, "nome": "Test Cargo", "edital_id": 1, "qtd_disciplinas": 10, "captured_at": "2026-05-14T10:00:00Z"}'::JSONB,
    'v2_default'
  );

  -- 3. plano_config com novos campos
  INSERT INTO plano_config (
    plano_id, weekday_minutes, weekend_minutes, mix_ratio,
    simulados_freq, tem_redacao, tipo_material, horario_preferido
  ) VALUES (
    '11111111-1111-1111-1111-111111111111', 180, 240,
    '{"teoria": 0.4, "questoes": 0.4, "revisao": 0.15, "flashcards": 0.05}'::JSONB,
    'quinzenal', FALSE, 'misto', 'manha'
  );

  -- 4. plano_config_history versão 1
  INSERT INTO plano_config_history (plano_id, version, snapshot)
  VALUES ('11111111-1111-1111-1111-111111111111', 1, '{"weekday_minutes": 180}'::JSONB);

  -- 5. Disciplina + plano_disciplina com nivel e ponto_fraco
  INSERT INTO disciplinas (id, nome, user_id)
  VALUES ('22222222-2222-2222-2222-222222222222', 'Test Discipline', '00000000-0000-0000-0000-000000000999')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO plano_disciplinas (
    plano_id, disciplina_id, peso, prioridade,
    nivel_conhecimento, is_ponto_fraco, excluded_subtopico_ids
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    1.5, 'alta',
    'iniciante', TRUE, '{}'
  );

  -- 6. schedule_item com FSRS fields
  INSERT INTO schedule_items (
    id, user_id, plano_id, scheduled_date, type, status, title,
    is_anticipated, fsrs_due_date, version
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000999',
    '11111111-1111-1111-1111-111111111111',
    CURRENT_DATE, 'estudo_inicial_p1', 'pendente', 'Test item',
    FALSE, NULL, 1
  );

  -- 7. UPDATE pra trigger publicar event
  UPDATE schedule_items SET status = 'concluido', completed_at = NOW()
  WHERE id = '33333333-3333-3333-3333-333333333333';

  -- Verificações
  SELECT 'plano' AS check, COUNT(*) FROM planos_estudo WHERE id = '11111111-1111-1111-1111-111111111111';
  SELECT 'config' AS check, COUNT(*) FROM plano_config WHERE plano_id = '11111111-1111-1111-1111-111111111111';
  SELECT 'history' AS check, COUNT(*) FROM plano_config_history WHERE plano_id = '11111111-1111-1111-1111-111111111111';
  SELECT 'disciplina' AS check, COUNT(*) FROM plano_disciplinas WHERE plano_id = '11111111-1111-1111-1111-111111111111';
  SELECT 'item' AS check, version FROM schedule_items WHERE id = '33333333-3333-3333-3333-333333333333';
  SELECT 'event' AS check, event_type FROM plan_events WHERE plano_id = '11111111-1111-1111-1111-111111111111';

  -- 8. plan_decision smoke
  INSERT INTO plan_decisions (
    plano_id, week_number, action, reason, output_summary, triggered_by
  ) VALUES (
    '11111111-1111-1111-1111-111111111111', 1, 'initial_distribution',
    'absorption_phase', '{"items_created": 1}'::JSONB, 'rpc_initial'
  );
  SELECT 'decision' AS check, COUNT(*) FROM plan_decisions WHERE plano_id = '11111111-1111-1111-1111-111111111111';

  -- 9. prediction smoke
  INSERT INTO plano_predictions_history (plano_id, coverage_pct, slack_weeks, pace_index)
  VALUES ('11111111-1111-1111-1111-111111111111', 95.0, 2.0, 1.0);
  SELECT 'prediction' AS check, coverage_pct FROM plano_predictions
  WHERE plano_id = '11111111-1111-1111-1111-111111111111';

ROLLBACK;

SELECT 'Integration test completed' AS final_status;
```

- [ ] **Step 2: Rodar integration test**

```bash
psql $DATABASE_URL -f "supabase/verify/cronograma_v2/verify_07_full_insert_flow.sql"
```

Expected output:
- `plano: 1`
- `config: 1`
- `history: 1`
- `disciplina: 1`
- `item: 2` (version incrementada de 1 → 2 via trigger)
- `event: item.completed` (trigger publicou)
- `decision: 1`
- `prediction: 95.0`
- `Integration test completed`

- [ ] **Step 3: Commit**

```bash
git add supabase/verify/cronograma_v2/verify_07_full_insert_flow.sql
git commit -m "test(cronograma-v2): add full integration smoke test for V2 schema"
```

---

### Task 24: Documentação resumo + checklist final

**Files:**
- Create: `docs/cronograma-v2/migrations-applied.md`

- [ ] **Step 1: Criar doc resumo**

Conteúdo de `docs/cronograma-v2/migrations-applied.md`:

```markdown
# Cronograma V2 — Migrations Aplicadas (Sub-plan 1)

**Data:** 2026-05-14
**Status:** Schema V2 aplicado em produção, sem efeito visível ao usuário.

## Migrations criadas (em ordem)

| # | Migration | Conteúdo |
|---|---|---|
| 01 | `20260514120000_cronograma_v2_enums.sql` | 5 enums + 'rascunho' em plano_status |
| 02 | `20260514120100_cronograma_v2_plan_decisions.sql` | Audit trail + particionamento mensal |
| 03 | `20260514120200_cronograma_v2_behavioral_signals.sql` | Sinais comportamentais + idempotência |
| 04 | `20260514120300_cronograma_v2_edital_cache.sql` | Cache compartilhado IA |
| 05 | `20260514120400_cronograma_v2_predictions.sql` | History append-only + view |
| 06 | `20260514120500_cronograma_v2_plan_events.sql` | Event bus + sequence |
| 07 | `20260514120600_cronograma_v2_dead_letters.sql` | Eventos não processados |
| 08 | `20260514120700_cronograma_v2_config_history.sql` | Versionamento de config |
| 09 | `20260514120800_cronograma_v2_feriados.sql` | Lookup de feriados |
| 10 | `20260514120900_cronograma_v2_plan_templates.sql` | Templates oficial/comunidade |
| 11 | `20260514121000_cronograma_v2_auxiliary.sql` | 5 tabelas auxiliares + função is_feature_enabled |
| 12 | `20260514121100_cronograma_v2_alter_planos_estudo.sql` | cargo_snapshot, template_id, algorithm_variant, deleted_at |
| 13 | `20260514121200_cronograma_v2_alter_plano_config.sql` | simulados, redação, material, horário |
| 14 | `20260514121300_cronograma_v2_alter_plano_disciplinas.sql` | nivel, ponto_fraco, excluded |
| 15 | `20260514121400_cronograma_v2_alter_schedule_items.sql` | FSRS, anticipated, parent, version |
| 16 | `20260514121500_cronograma_v2_alter_topicos.sql` | referencias_legais, nome_curto, ai_decomposed_at |
| 17 | `20260514121600_cronograma_v2_alter_weekly_stats.sql` | unlocked_early, overflow |
| 18 | `20260514121700_cronograma_v2_triggers.sql` | 3 triggers (events + version) |
| 19 | `20260514121800_cronograma_v2_rls.sql` | RLS policies em todas as novas tabelas |
| 20 | `20260514121900_cronograma_v2_seed_feriados.sql` | Seed feriados 2026-2028 |

## Verify scripts

Localizados em `supabase/verify/cronograma_v2/`:

- `verify_01_enums.sql`
- `verify_02_tables.sql`
- `verify_04_triggers.sql`
- `verify_05_rls.sql`
- `verify_07_full_insert_flow.sql`

Rodar tudo:
```bash
for f in supabase/verify/cronograma_v2/verify_*.sql; do
  echo "=== $f ===";
  psql $DATABASE_URL -f "$f";
done
```

## Rollback

Se necessário, executar em ordem reversa:

```bash
# Lista migrations a reverter
ls -r supabase/migrations/2026051412*.sql
```

Cada migration tem comentário `-- DOWN:` no topo descrevendo a reversão.

## Próximos passos

- Sub-plan 2: implementar `gerar_cronograma_v2` + `criar_plano_completo` RPCs
- Sub-plan 3: implementar SyncEditalService + TopicoDecomposer (TS)
- Sub-plan 4-7: setup flow, event loop, crons, migração V1→V2
```

- [ ] **Step 2: Commit final**

```bash
mkdir -p docs/cronograma-v2
git add docs/cronograma-v2/migrations-applied.md
git commit -m "docs(cronograma-v2): summary of schema migrations applied (sub-plan 1)"
```

- [ ] **Step 3: Push para remote**

```bash
git push origin cargo-transition-v2
```

Expected: push bem-sucedido, branch atualizada.

---

## Self-Review

Verificando o plano contra a spec (seção 4):

**Tabelas mapeadas (10 novas):**
- ✅ plan_decisions (Task 2)
- ✅ behavioral_signals (Task 3)
- ✅ edital_cache (Task 4)
- ✅ plano_predictions_history (Task 5)
- ✅ plan_events (Task 6)
- ✅ dead_letters (Task 7)
- ✅ plano_config_history (Task 8)
- ✅ feriados_nacionais (Task 9)
- ✅ plan_templates (Task 10)
- ✅ Auxiliares (graphql_cache, analytics_events, rate_limit_buckets, feature_flags, ai_quality_feedback) — Task 11

**ALTERs em tabelas existentes:**
- ✅ planos_estudo (Task 12)
- ✅ plano_config (Task 13)
- ✅ plano_disciplinas (Task 14)
- ✅ schedule_items (Task 15)
- ✅ topicos (Task 16)
- ✅ weekly_stats (Task 17)

**Triggers (3 novos da spec 4.3):**
- ✅ trg_publish_completion_event (Task 18)
- ✅ trg_publish_week_completed (Task 18)
- ✅ trg_increment_version (extra, pra optimistic lock)
- ⚠️ `trg_collect_behavioral_signal` — propositalmente NÃO implementado aqui (depende de logic mais complexa, fica no sub-plan 5)
- ⚠️ `trg_invalidate_graphql_cache` — cron job, não trigger; fica no sub-plan 6
- ⚠️ `trg_compute_week_number` — já existe no schema V1, preservado

**RLS (14 tabelas novas):**
- ✅ Todas com policies definidas (Task 19)

**TypeScript types:**
- ✅ database.ts regenerado (Task 21)
- ✅ cronograma-v2.ts criado com tipos derivados (Task 22)

**Integration test:**
- ✅ Full flow smoke test (Task 23)

**Coverage gaps detectados e fechados:**
- ❌ → ✅ Faltava trigger de version increment (adicionado)
- ❌ → ✅ Faltava seed de feriados (Task 20)
- ❌ → ✅ Faltava função `is_feature_enabled` (Task 11)

**Placeholders detectados:** nenhum.

**Type consistency:** todos os nomes (tabelas, colunas, funções) consistentes entre tasks e com a spec.

---

## Tempo estimado

- 24 tasks × ~5min = ~2 horas total
- Pode ser executado de uma vez ou em batches de 5-6 tasks

## Pré-execução checklist

Antes de começar:
- [ ] Branch git limpa (`git status`)
- [ ] Supabase CLI logged in (`npx supabase login`)
- [ ] `DATABASE_URL` exportado pra psql (`echo $DATABASE_URL`)
- [ ] Backup recente do banco (Supabase faz automatico, mas confirmar)
