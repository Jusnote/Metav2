# Cronograma V2 — Sub-plan 2: RPCs core (`gerar_cronograma_v2` + `criar_plano_completo`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o coração algorítmico do Cronograma V2 em PL/pgSQL: (1) `gerar_cronograma_v2` que distribui balanceadamente por semana com nível/pontos fracos/feriados/FSRS, e (2) `criar_plano_completo` que orquestra setup atômico (plano + config + disciplinas + chamada à `gerar_cronograma_v2` + predição inicial) num único round-trip.

**Architecture:** V2 coexiste com V1 (não substitui). Feature flag `cronograma_v2_enabled` (já em DB) decide qual roda no orquestrador TS. V2 é puro PL/pgSQL — sem dependência de Edge Functions, sem chamadas IA (decomposição IA fica em Sub-plan 3). Cada função tem helpers extraídos como funções puras testáveis isoladamente. Logs em `plan_decisions` pra observabilidade.

**Tech Stack:** Postgres 15 PL/pgSQL, jsonb, temp tables, partitioned tables (de Sub-plan 1), Supabase Management API (workaround pro CLI bloqueado).

**Spec ref:** `docs/superpowers/specs/2026-05-14-cronograma-cargo-integration-design.md` seções 6 (algoritmo `gerar_cronograma_v2`) e 7.5 + apêndice A (`criar_plano_completo`).

**Premissas:**
- Sub-plan 1 aplicado em produção (28 commits, schema V2 verificado ✅)
- V1 `gerar_cronograma(plano_uuid)` permanece intocado em `20260512000001_gerar_cronograma_function.sql`
- `psql` indisponível; verifies rodam no Supabase Studio
- Workaround Management API ativo pra `migration up`

---

## File Structure

Arquivos novos em `supabase/migrations/`:

```
20260515120000_cronograma_v2_helpers.sql                 — funções puras (3 helpers)
20260515120100_cronograma_v2_temp_tables_helper.sql      — TEMP table factory (1 helper)
20260515120200_cronograma_v2_gerar_skeleton.sql          — signature + load context + validation
20260515120300_cronograma_v2_gerar_blocks.sql            — geração de blocks lógicos (teoria + questões)
20260515120400_cronograma_v2_gerar_distribuicao.sql      — distribuição balanceada por semana
20260515120500_cronograma_v2_gerar_simulados_redacao.sql — simulados periódicos + redação
20260515120600_cronograma_v2_gerar_bulk_insert.sql       — bulk insert + weekly_stats + plan_decisions
20260515120700_cronograma_v2_criar_plano_completo.sql    — orquestrador atômico
20260515120800_cronograma_v2_compute_prediction.sql      — predição inicial (snapshot pra plano_predictions_history)
```

Verify scripts em `supabase/verify/cronograma_v2/`:
```
verify_08_helpers.sql              — testa helpers puros (multiplicador, feriados, capacidade)
verify_09_gerar_basico.sql         — caso minimal: 1 disciplina, 1 subtópico, 2 semanas
verify_10_gerar_balanceado.sql     — caso real: 5 disciplinas, 40 subtópicos, 8 semanas
verify_11_gerar_edge_cases.sql     — total_semanas<2, overflow, disciplina vazia
verify_12_criar_plano_atomico.sql  — rollback em erro, idempotência por user/cargo
verify_13_performance.sql          — EXPLAIN ANALYZE + duração média
```

TypeScript types regenerados ao final (`src/types/database.ts`).

Migration approach: cada migration é incremental sobre a anterior (`CREATE OR REPLACE FUNCTION`). Funções podem evoluir entre tasks sem quebrar idempotência.

---

## Pré-requisitos

- [ ] Sub-plan 1 verificado no Supabase Studio com 25/25 PASS
- [ ] Branch `cargo-transition-v2` (mesma de Sub-plan 1)
- [ ] Access token Supabase válido em `~/.supabase/access-token.json` (ou onde `supabase login` salvou)
- [ ] Working tree pode ter WIP — só `git add` arquivos específicos por task

---

### Task 0: Setup — branch + verify dir já existem

**Files:** nenhum novo

- [ ] **Step 1: Confirmar baseline**

```bash
cd "D:/meta novo/Metav2" && git log --oneline -3 && ls supabase/verify/cronograma_v2/ | wc -l
```

Expected: tip é `ce9fc9d` (fix de column names) ou commit posterior; dir tem ≥7 arquivos verify.

- [ ] **Step 2: Sem commit. Apenas confirmação.**

---

### Task 1: Helper `aplicar_nivel_multiplicador`

**Files:**
- Create: `supabase/migrations/20260515120000_cronograma_v2_helpers.sql`
- Create: `supabase/verify/cronograma_v2/verify_08_helpers.sql`

Função pura: dado um `nivel_conhecimento_enum` e duração base em minutos, retorna a duração ajustada. Iniciante ×1.5, intermediário ×1.0, avançado ×0.7. IMMUTABLE pra permitir uso em expressões de índice e GENERATED ALWAYS futuro.

- [ ] **Step 1: Criar migração**

Conteúdo de `20260515120000_cronograma_v2_helpers.sql`:

```sql
-- UP: helpers puros do algoritmo V2 + valor 'redacao' no schedule_item_type
-- DOWN: DROP FUNCTION cada helper (não reverter o enum value — PG não suporta)

-- 0. Adiciona 'redacao' ao enum schedule_item_type (idempotente)
-- Necessário pra Task 7 que aloca blocos de redação.
DO $$ BEGIN
  ALTER TYPE schedule_item_type ADD VALUE IF NOT EXISTS 'redacao';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Multiplicador de duração por nível de conhecimento
CREATE OR REPLACE FUNCTION aplicar_nivel_multiplicador(
  p_nivel nivel_conhecimento_enum,
  p_base_minutos INTEGER
) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_nivel
    WHEN 'iniciante'      THEN CEIL(p_base_minutos * 1.5)::INTEGER
    WHEN 'intermediario'  THEN p_base_minutos
    WHEN 'avancado'       THEN CEIL(p_base_minutos * 0.7)::INTEGER
  END;
$$;

COMMENT ON FUNCTION aplicar_nivel_multiplicador IS
  'Ajusta duração base por nível declarado pelo user. Iniciante 1.5x, intermediário 1.0x, avançado 0.7x. IMMUTABLE.';

-- Boost de ponto fraco (+30%)
CREATE OR REPLACE FUNCTION aplicar_ponto_fraco_boost(
  p_minutos INTEGER,
  p_is_ponto_fraco BOOLEAN
) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_is_ponto_fraco
    THEN CEIL(p_minutos * 1.3)::INTEGER
    ELSE p_minutos
  END;
$$;

COMMENT ON FUNCTION aplicar_ponto_fraco_boost IS
  '+30% de tempo em disciplinas marcadas como ponto fraco. IMMUTABLE.';

-- Cálculo de total de semanas entre duas datas (inclusivo data_inicio)
CREATE OR REPLACE FUNCTION calcular_total_semanas(
  p_data_inicio DATE,
  p_data_prova DATE
) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(
    CEIL((p_data_prova - p_data_inicio)::NUMERIC / 7)::INTEGER,
    0
  );
$$;

COMMENT ON FUNCTION calcular_total_semanas IS
  'Número de semanas entre data_inicio e data_prova (arredonda pra cima). Retorna 0 se data_prova ≤ data_inicio.';
```

- [ ] **Step 2: Criar verify**

Conteúdo de `verify_08_helpers.sql`:

```sql
-- Testes dos 3 helpers como queries (cada SELECT é um caso)
SELECT 'aplicar_nivel_multiplicador iniciante' AS test,
       aplicar_nivel_multiplicador('iniciante', 100)::TEXT AS actual,
       '150' AS expected;
SELECT 'aplicar_nivel_multiplicador intermediario',
       aplicar_nivel_multiplicador('intermediario', 100)::TEXT, '100';
SELECT 'aplicar_nivel_multiplicador avancado',
       aplicar_nivel_multiplicador('avancado', 100)::TEXT, '70';

SELECT 'aplicar_ponto_fraco_boost TRUE',
       aplicar_ponto_fraco_boost(100, TRUE)::TEXT, '130';
SELECT 'aplicar_ponto_fraco_boost FALSE',
       aplicar_ponto_fraco_boost(100, FALSE)::TEXT, '100';

SELECT 'calcular_total_semanas exata',
       calcular_total_semanas('2026-05-15', '2026-06-26')::TEXT, '6';
SELECT 'calcular_total_semanas 1 dia extra (ceil)',
       calcular_total_semanas('2026-05-15', '2026-06-27')::TEXT, '7';
SELECT 'calcular_total_semanas data invertida',
       calcular_total_semanas('2026-06-26', '2026-05-15')::TEXT, '0';
```

- [ ] **Step 3: Aplicar via Management API**

Usar Management API + INSERT em `supabase_migrations.schema_migrations` (mesmo padrão de Sub-plan 1).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260515120000_cronograma_v2_helpers.sql supabase/verify/cronograma_v2/verify_08_helpers.sql
git commit -m "feat(cronograma-v2): add pure helper functions (nivel/ponto_fraco/semanas)"
```

---

### Task 2: Helper `capacidade_dia` (respeita feriados + weekend/weekday)

**Files:**
- Modify: `supabase/migrations/20260515120000_cronograma_v2_helpers.sql` — adicionar `CREATE OR REPLACE`
- Modify: `supabase/verify/cronograma_v2/verify_08_helpers.sql` — adicionar casos

Função que retorna minutos disponíveis num dado dia, considerando: dia da semana (weekday vs weekend), `daily_exceptions` da config, e feriados em `feriados_nacionais`. Retorna 0 se feriado.

- [ ] **Step 1: Adicionar à migração existente**

Acrescentar ao FIM de `20260515120000_cronograma_v2_helpers.sql`:

```sql
-- Capacidade de minutos num dia específico
CREATE OR REPLACE FUNCTION capacidade_dia(
  p_data DATE,
  p_weekday_minutes INTEGER,
  p_weekend_minutes INTEGER,
  p_daily_exceptions JSONB DEFAULT '{}'::JSONB
) RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_iso_dow INTEGER;  -- 1..7 (segunda..domingo)
  v_exception TEXT;
  v_is_feriado BOOLEAN;
BEGIN
  -- Feriado nacional → 0 minutos
  SELECT EXISTS(SELECT 1 FROM feriados_nacionais WHERE data = p_data AND tipo = 'nacional')
  INTO v_is_feriado;
  IF v_is_feriado THEN RETURN 0; END IF;

  -- Exceção declarada na config (ex: {"2026-07-04": 0, "2026-12-24": 60})
  v_exception := p_daily_exceptions->>(p_data::TEXT);
  IF v_exception IS NOT NULL THEN
    RETURN v_exception::INTEGER;
  END IF;

  -- Base: weekday (Mon-Fri) ou weekend (Sat-Sun)
  v_iso_dow := EXTRACT(ISODOW FROM p_data);
  IF v_iso_dow <= 5 THEN
    RETURN p_weekday_minutes;
  ELSE
    RETURN p_weekend_minutes;
  END IF;
END $$;

COMMENT ON FUNCTION capacidade_dia IS
  'Minutos disponíveis num dia. Feriado nacional zera; daily_exceptions sobrescreve; fallback weekday/weekend.';
```

- [ ] **Step 2: Adicionar verify**

Append em `verify_08_helpers.sql`:

```sql
-- capacidade_dia: 2026-09-07 (Independência, feriado nacional → 0)
SELECT 'capacidade_dia feriado nacional',
       capacidade_dia('2026-09-07', 180, 240, '{}'::JSONB)::TEXT, '0';

-- 2026-05-18 (segunda, sem exceção, sem feriado) → weekday 180
SELECT 'capacidade_dia weekday normal',
       capacidade_dia('2026-05-18', 180, 240, '{}'::JSONB)::TEXT, '180';

-- 2026-05-17 (domingo) → weekend 240
SELECT 'capacidade_dia weekend',
       capacidade_dia('2026-05-17', 180, 240, '{}'::JSONB)::TEXT, '240';

-- Daily exception sobrescreve weekend
SELECT 'capacidade_dia daily_exception',
       capacidade_dia('2026-05-17', 180, 240, '{"2026-05-17": 60}'::JSONB)::TEXT, '60';

-- Daily exception não bate o feriado (feriado vence)
SELECT 'capacidade_dia feriado > exception',
       capacidade_dia('2026-09-07', 180, 240, '{"2026-09-07": 999}'::JSONB)::TEXT, '0';
```

- [ ] **Step 3: Aplicar (mesma migração, idempotente via CREATE OR REPLACE)**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260515120000_cronograma_v2_helpers.sql supabase/verify/cronograma_v2/verify_08_helpers.sql
git commit -m "feat(cronograma-v2): add capacidade_dia helper (feriados + weekday/weekend + exceptions)"
```

---

### Task 3: TEMP table factory `_v2_carrega_contexto`

**Files:**
- Create: `supabase/migrations/20260515120100_cronograma_v2_temp_tables_helper.sql`

Procedure que cria TEMP tables com plano + config + disciplinas + subtopicos pra um plano dado. Usada pelo skeleton de `gerar_cronograma_v2`. Mantém `gerar_cronograma_v2` enxuto.

- [ ] **Step 1: Criar migração**

```sql
-- UP: procedure que popula 4 TEMP tables com contexto do plano
-- DOWN: DROP PROCEDURE _v2_carrega_contexto

CREATE OR REPLACE PROCEDURE _v2_carrega_contexto(p_plano_uuid UUID)
LANGUAGE plpgsql AS $$
BEGIN
  -- 1. Plano + config (1 row cada)
  CREATE TEMP TABLE IF NOT EXISTS _ctx_plano ON COMMIT DROP AS
  SELECT p.id, p.user_id, p.data_inicio, p.data_prova, p.cargo_snapshot,
         calcular_total_semanas(p.data_inicio, p.data_prova) AS total_semanas
  FROM planos_estudo p WHERE p.id = p_plano_uuid;

  CREATE TEMP TABLE IF NOT EXISTS _ctx_config ON COMMIT DROP AS
  SELECT pc.*
  FROM plano_config pc WHERE pc.plano_id = p_plano_uuid;

  -- 2. Disciplinas com nivel + ponto_fraco + excluded
  CREATE TEMP TABLE IF NOT EXISTS _ctx_disciplinas ON COMMIT DROP AS
  SELECT pd.id AS plano_disciplina_id, pd.disciplina_id, pd.peso,
         pd.nivel_conhecimento, pd.is_ponto_fraco, pd.excluded_subtopico_ids
  FROM plano_disciplinas pd WHERE pd.plano_id = p_plano_uuid;

  -- 3. Subtopicos das disciplinas, filtrando exclusões
  CREATE TEMP TABLE IF NOT EXISTS _ctx_subtopicos ON COMMIT DROP AS
  SELECT
    s.id AS subtopico_id,
    s.topico_id,
    t.disciplina_id,
    s.nome,
    COALESCE(s.estimated_duration_minutes, s.average_time, 45) AS duracao_base,
    d.nivel_conhecimento,
    d.is_ponto_fraco,
    d.peso AS disciplina_peso,
    -- Ajusta duração: nivel × ponto_fraco
    aplicar_ponto_fraco_boost(
      aplicar_nivel_multiplicador(d.nivel_conhecimento, COALESCE(s.estimated_duration_minutes, s.average_time, 45)),
      d.is_ponto_fraco
    ) AS duracao_ajustada
  FROM subtopicos s
  JOIN topicos t ON t.id = s.topico_id
  JOIN _ctx_disciplinas d ON d.disciplina_id = t.disciplina_id
  WHERE NOT (s.id = ANY(d.excluded_subtopico_ids));

  -- 4. Sequence de semanas: 1..total_semanas com data_inicio_semana
  CREATE TEMP TABLE IF NOT EXISTS _ctx_semanas ON COMMIT DROP AS
  SELECT
    s AS week_number,
    (SELECT data_inicio FROM _ctx_plano) + ((s - 1) * 7)::INTEGER AS week_start,
    (SELECT data_inicio FROM _ctx_plano) + (s * 7 - 1)::INTEGER AS week_end
  FROM generate_series(1, (SELECT total_semanas FROM _ctx_plano)) s;
END $$;

COMMENT ON PROCEDURE _v2_carrega_contexto IS
  'Popula 4 TEMP tables (_ctx_plano, _ctx_config, _ctx_disciplinas, _ctx_subtopicos, _ctx_semanas) pra uso por gerar_cronograma_v2. ON COMMIT DROP.';
```

- [ ] **Step 2: Aplicar via Management API**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515120100_cronograma_v2_temp_tables_helper.sql
git commit -m "feat(cronograma-v2): add _v2_carrega_contexto procedure (TEMP tables factory)"
```

---

### Task 4: `gerar_cronograma_v2` — skeleton + validação

**Files:**
- Create: `supabase/migrations/20260515120200_cronograma_v2_gerar_skeleton.sql`

Função com assinatura final, validações defensivas, e shell do retorno JSONB. Body ainda incompleto — só carrega contexto e retorna {items_created: 0, status: 'skeleton'}.

- [ ] **Step 1: Criar migração**

```sql
-- UP: skeleton de gerar_cronograma_v2 (validações + carga de contexto)
-- DOWN: DROP FUNCTION gerar_cronograma_v2

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_total_semanas INTEGER;
  v_n_subtopicos  INTEGER;
  v_warnings      JSONB := '[]'::JSONB;
  v_result        JSONB;
BEGIN
  -- 1. Carrega contexto via procedure (popula TEMP tables)
  CALL _v2_carrega_contexto(p_plano_uuid);

  -- 2. Validações
  SELECT user_id, total_semanas FROM _ctx_plano INTO v_user_id, v_total_semanas;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plano_uuid USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', p_plano_uuid USING ERRCODE = '42501';
  END IF;

  IF v_total_semanas < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas (total_semanas=%)', v_total_semanas
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) FROM _ctx_subtopicos INTO v_n_subtopicos;
  IF v_n_subtopicos = 0 THEN
    v_warnings := v_warnings || jsonb_build_object('warning', 'no_subtopics', 'msg', 'Nenhum subtópico após filtros');
  END IF;

  -- 3. Skeleton: retorna shell
  v_result := jsonb_build_object(
    'status',           'skeleton',
    'plano_id',         p_plano_uuid,
    'total_semanas',    v_total_semanas,
    'subtopicos_count', v_n_subtopicos,
    'items_created',    0,
    'warnings',         v_warnings
  );

  RETURN v_result;
END $$;

COMMENT ON FUNCTION gerar_cronograma_v2 IS
  'Gera schedule_items para um plano, distribuindo balanceadamente por semana, respeitando nível, pontos fracos, feriados e mix configurado. Sub-plan 2 / spec 6.';
```

- [ ] **Step 2: Aplicar + commit**

```bash
git add supabase/migrations/20260515120200_cronograma_v2_gerar_skeleton.sql
git commit -m "feat(cronograma-v2): scaffold gerar_cronograma_v2 (validation + context load)"
```

---

### Task 5: `gerar_cronograma_v2` — geração de blocks lógicos

**Files:**
- Create: `supabase/migrations/20260515120300_cronograma_v2_gerar_blocks.sql`

Gera 1 bloco de teoria + 1 bloco de questões por subtópico. Mix interno por disciplina respeita `mix_ratio` do config. Resultado em TEMP table `_ctx_blocks`.

- [ ] **Step 1: Criar migração**

```sql
-- UP: extende gerar_cronograma_v2 com geração de blocks
-- DOWN: rever pra versão da Task 4

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_total_semanas INTEGER;
  v_n_subtopicos  INTEGER;
  v_n_blocks      INTEGER;
  v_warnings      JSONB := '[]'::JSONB;
  v_result        JSONB;
BEGIN
  CALL _v2_carrega_contexto(p_plano_uuid);

  SELECT user_id, total_semanas FROM _ctx_plano INTO v_user_id, v_total_semanas;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plano_uuid USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', p_plano_uuid USING ERRCODE = '42501';
  END IF;
  IF v_total_semanas < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas (total_semanas=%)', v_total_semanas
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) FROM _ctx_subtopicos INTO v_n_subtopicos;
  IF v_n_subtopicos = 0 THEN
    RETURN jsonb_build_object('status', 'no_subtopics', 'items_created', 0);
  END IF;

  -- 4. Gera blocks: 1 teoria + 1 questões por subtópico
  CREATE TEMP TABLE IF NOT EXISTS _ctx_blocks ON COMMIT DROP AS
  WITH teoria AS (
    SELECT
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      'estudo_inicial_p1'::schedule_item_type AS tipo,
      duracao_ajustada AS minutos,
      nome AS title,
      1 AS ordem_no_subtopico
    FROM _ctx_subtopicos
  ),
  questoes AS (
    SELECT
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      'estudo_inicial_p2'::schedule_item_type AS tipo,
      GREATEST(20, CEIL(duracao_ajustada * 0.5)::INTEGER) AS minutos,  -- mínimo 20min de questões
      nome AS title,
      2 AS ordem_no_subtopico
    FROM _ctx_subtopicos
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY disciplina_id, subtopico_id, ordem_no_subtopico) AS block_seq,
    *
  FROM (SELECT * FROM teoria UNION ALL SELECT * FROM questoes) ALL_BLOCKS;

  SELECT COUNT(*) FROM _ctx_blocks INTO v_n_blocks;

  v_result := jsonb_build_object(
    'status',            'blocks_generated',
    'plano_id',          p_plano_uuid,
    'total_semanas',     v_total_semanas,
    'subtopicos_count',  v_n_subtopicos,
    'blocks_count',      v_n_blocks,
    'items_created',     0,
    'warnings',          v_warnings
  );

  RETURN v_result;
END $$;
```

- [ ] **Step 2: Aplicar + commit**

```bash
git add supabase/migrations/20260515120300_cronograma_v2_gerar_blocks.sql
git commit -m "feat(cronograma-v2): generate logical blocks (teoria + questoes per subtopico)"
```

---

### Task 6: `gerar_cronograma_v2` — distribuição balanceada por semana

**Files:**
- Create: `supabase/migrations/20260515120400_cronograma_v2_gerar_distribuicao.sql`

Estende a função com distribuição balanceada: fase 1 (absorção) = semanas 1..⌊total/2⌋, fase 2 (consolidação) = restante. Round-robin por disciplina dentro da semana. Cada subtópico aloca teoria primeiro, questões 1-2 semanas depois.

- [ ] **Step 1: Criar migração**

```sql
-- UP: distribuição balanceada por semana, round-robin disciplinas
-- DOWN: rever pra versão da Task 5

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID;
  v_total_semanas      INTEGER;
  v_n_blocks           INTEGER;
  v_blocks_per_week    NUMERIC;
  v_warnings           JSONB := '[]'::JSONB;
  v_result             JSONB;
BEGIN
  CALL _v2_carrega_contexto(p_plano_uuid);

  SELECT user_id, total_semanas FROM _ctx_plano INTO v_user_id, v_total_semanas;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plano_uuid USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', p_plano_uuid USING ERRCODE = '42501';
  END IF;
  IF v_total_semanas < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas (total_semanas=%)', v_total_semanas
      USING ERRCODE = 'P0001';
  END IF;

  -- Gera _ctx_blocks (mesmo bloco da Task 5, inlinado aqui)
  CREATE TEMP TABLE IF NOT EXISTS _ctx_blocks ON COMMIT DROP AS
  WITH teoria AS (
    SELECT subtopico_id, topico_id, disciplina_id, disciplina_peso,
           'estudo_inicial_p1'::schedule_item_type AS tipo,
           duracao_ajustada AS minutos, nome AS title, 1 AS ordem
    FROM _ctx_subtopicos
  ),
  questoes AS (
    SELECT subtopico_id, topico_id, disciplina_id, disciplina_peso,
           'estudo_inicial_p2'::schedule_item_type AS tipo,
           GREATEST(20, CEIL(duracao_ajustada * 0.5)::INTEGER) AS minutos,
           nome AS title, 2 AS ordem
    FROM _ctx_subtopicos
  )
  SELECT * FROM teoria UNION ALL SELECT * FROM questoes;

  SELECT COUNT(*) FROM _ctx_blocks INTO v_n_blocks;
  IF v_n_blocks = 0 THEN
    RETURN jsonb_build_object('status', 'no_subtopics', 'items_created', 0);
  END IF;

  v_blocks_per_week := v_n_blocks::NUMERIC / v_total_semanas;

  -- Atribui week_number a cada block: round-robin por disciplina,
  -- teoria na 1ª passagem, questões na 2ª (ordem). Resultado: 
  -- balanceado ±1 por semana, mesma disciplina espaçada.
  CREATE TEMP TABLE IF NOT EXISTS _ctx_assigned ON COMMIT DROP AS
  WITH numbered AS (
    SELECT
      b.*,
      -- Posição global respeitando ordem: teoria antes de questões mesmo subtópico
      ROW_NUMBER() OVER (
        PARTITION BY b.disciplina_id, b.ordem
        ORDER BY b.subtopico_id
      ) AS pos_in_disc_ordem,
      ROW_NUMBER() OVER (
        ORDER BY b.ordem, b.disciplina_id, b.subtopico_id
      ) AS global_seq
    FROM _ctx_blocks b
  )
  SELECT
    n.*,
    -- Distribui no intervalo [1, total_semanas]: divisão inteira do global_seq
    LEAST(
      v_total_semanas,
      GREATEST(1, CEIL(n.global_seq::NUMERIC / v_blocks_per_week)::INTEGER)
    ) AS week_number
  FROM numbered n;

  v_result := jsonb_build_object(
    'status',            'distributed',
    'plano_id',          p_plano_uuid,
    'total_semanas',     v_total_semanas,
    'blocks_count',      v_n_blocks,
    'blocks_per_week',   ROUND(v_blocks_per_week, 2),
    'items_created',     0,
    'warnings',          v_warnings
  );

  RETURN v_result;
END $$;
```

- [ ] **Step 2: Aplicar + commit**

```bash
git add supabase/migrations/20260515120400_cronograma_v2_gerar_distribuicao.sql
git commit -m "feat(cronograma-v2): distribute blocks balanced across weeks (round-robin)"
```

---

### Task 7: `gerar_cronograma_v2` — simulados periódicos + redação

**Files:**
- Create: `supabase/migrations/20260515120500_cronograma_v2_gerar_simulados_redacao.sql`

Adiciona 1 simulado por intervalo `simulados_freq` (mensal=4sem, quinzenal=2sem, semanal=1sem) e 1 bloco de redação semanal se `tem_redacao=true`.

- [ ] **Step 1: Criar migração**

```sql
-- UP: extende gerar_cronograma_v2 com simulados + redação
-- DOWN: rever pra versão da Task 6

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id           UUID;
  v_total_semanas     INTEGER;
  v_n_blocks          INTEGER;
  v_blocks_per_week   NUMERIC;
  v_simulados_freq    simulados_freq_enum;
  v_tem_redacao       BOOLEAN;
  v_simulado_interval INTEGER;  -- a cada N semanas
  v_simulados_count   INTEGER := 0;
  v_redacao_count     INTEGER := 0;
  v_warnings          JSONB := '[]'::JSONB;
  v_result            JSONB;
BEGIN
  CALL _v2_carrega_contexto(p_plano_uuid);

  SELECT user_id, total_semanas FROM _ctx_plano INTO v_user_id, v_total_semanas;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plano_uuid USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', p_plano_uuid USING ERRCODE = '42501';
  END IF;
  IF v_total_semanas < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas (total_semanas=%)', v_total_semanas
      USING ERRCODE = 'P0001';
  END IF;

  SELECT simulados_freq, tem_redacao FROM _ctx_config
    INTO v_simulados_freq, v_tem_redacao;

  -- Distribuição base (Task 6 inlinado — abreviado, lógica idêntica)
  CREATE TEMP TABLE IF NOT EXISTS _ctx_blocks ON COMMIT DROP AS
  WITH teoria AS (
    SELECT subtopico_id, topico_id, disciplina_id, disciplina_peso,
           'estudo_inicial_p1'::schedule_item_type AS tipo,
           duracao_ajustada AS minutos, nome AS title, 1 AS ordem
    FROM _ctx_subtopicos
  ),
  questoes AS (
    SELECT subtopico_id, topico_id, disciplina_id, disciplina_peso,
           'estudo_inicial_p2'::schedule_item_type AS tipo,
           GREATEST(20, CEIL(duracao_ajustada * 0.5)::INTEGER) AS minutos,
           nome AS title, 2 AS ordem
    FROM _ctx_subtopicos
  )
  SELECT * FROM teoria UNION ALL SELECT * FROM questoes;

  SELECT COUNT(*) FROM _ctx_blocks INTO v_n_blocks;
  IF v_n_blocks = 0 THEN RETURN jsonb_build_object('status', 'no_subtopics', 'items_created', 0); END IF;

  v_blocks_per_week := v_n_blocks::NUMERIC / v_total_semanas;

  CREATE TEMP TABLE IF NOT EXISTS _ctx_assigned ON COMMIT DROP AS
  WITH numbered AS (
    SELECT b.*,
           ROW_NUMBER() OVER (ORDER BY b.ordem, b.disciplina_id, b.subtopico_id) AS global_seq
    FROM _ctx_blocks b
  )
  SELECT n.*,
         LEAST(v_total_semanas, GREATEST(1, CEIL(n.global_seq::NUMERIC / v_blocks_per_week)::INTEGER)) AS week_number,
         NULL::UUID AS subtopico_ref  -- preenchido com subtopico_id no insert final
  FROM numbered n;

  -- Simulados: aloca 1 a cada N semanas
  v_simulado_interval := CASE v_simulados_freq
    WHEN 'nenhum'    THEN NULL
    WHEN 'mensal'    THEN 4
    WHEN 'quinzenal' THEN 2
    WHEN 'semanal'   THEN 1
  END;

  IF v_simulado_interval IS NOT NULL THEN
    INSERT INTO _ctx_assigned (
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      tipo, minutos, title, ordem, global_seq, week_number, subtopico_ref
    )
    SELECT
      NULL, NULL, NULL, NULL,
      'simulado'::schedule_item_type,
      180,  -- 3 horas
      'Simulado periódico — semana ' || s,
      99 AS ordem,
      NULL,
      s AS week_number,
      NULL
    FROM generate_series(v_simulado_interval, v_total_semanas, v_simulado_interval) s;

    SELECT COUNT(*) FROM _ctx_assigned WHERE tipo = 'simulado'
      INTO v_simulados_count;
  END IF;

  -- Redação: 1 bloco de 60min por semana
  IF v_tem_redacao THEN
    INSERT INTO _ctx_assigned (
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      tipo, minutos, title, ordem, global_seq, week_number, subtopico_ref
    )
    SELECT
      NULL, NULL, NULL, NULL,
      'redacao'::schedule_item_type,
      60,
      'Redação — semana ' || s,
      98 AS ordem,
      NULL,
      s AS week_number,
      NULL
    FROM generate_series(1, v_total_semanas) s;

    SELECT COUNT(*) FROM _ctx_assigned WHERE tipo = 'redacao'
      INTO v_redacao_count;
  END IF;

  v_result := jsonb_build_object(
    'status',            'simulados_redacao_added',
    'plano_id',          p_plano_uuid,
    'total_semanas',     v_total_semanas,
    'blocks_count',      v_n_blocks,
    'simulados_count',   v_simulados_count,
    'redacao_count',     v_redacao_count,
    'items_created',     0,
    'warnings',          v_warnings
  );

  RETURN v_result;
END $$;
```

> **Nota:** `schedule_item_type` precisa ter os values `simulado_periodico` e `redacao`. Verificar em Sub-plan 1 / `cronograma_v2_clean_slate.sql` se existem. Se não, criar migration adicional ANTES da Task 7 pra adicionar (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`).

- [ ] **Step 2: Aplicar + commit**

```bash
git add supabase/migrations/20260515120500_cronograma_v2_gerar_simulados_redacao.sql
git commit -m "feat(cronograma-v2): allocate simulados periodicos and redacao blocks"
```

---

### Task 8: `gerar_cronograma_v2` — bulk insert + weekly_stats + plan_decisions

**Files:**
- Create: `supabase/migrations/20260515120600_cronograma_v2_gerar_bulk_insert.sql`

Fecha a função: bulk insert em `schedule_items`, atualiza `weekly_stats` por semana, loga 1 row em `plan_decisions`. Marca semanas em overflow (capacidade insuficiente).

- [ ] **Step 1: Criar migração**

```sql
-- UP: finalize gerar_cronograma_v2 com bulk insert + weekly_stats + plan_decisions
-- DOWN: rever pra versão da Task 7

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id           UUID;
  v_total_semanas     INTEGER;
  v_n_blocks          INTEGER;
  v_blocks_per_week   NUMERIC;
  v_simulados_freq    simulados_freq_enum;
  v_tem_redacao       BOOLEAN;
  v_simulado_interval INTEGER;
  v_items_created     INTEGER := 0;
  v_overflow_weeks    INTEGER := 0;
  v_warnings          JSONB := '[]'::JSONB;
  v_result            JSONB;
BEGIN
  CALL _v2_carrega_contexto(p_plano_uuid);

  SELECT user_id, total_semanas FROM _ctx_plano INTO v_user_id, v_total_semanas;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plano_uuid USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', p_plano_uuid USING ERRCODE = '42501';
  END IF;
  IF v_total_semanas < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas (total_semanas=%)', v_total_semanas
      USING ERRCODE = 'P0001';
  END IF;

  SELECT simulados_freq, tem_redacao FROM _ctx_config INTO v_simulados_freq, v_tem_redacao;

  -- [blocks + distribuição + simulados/redação — Task 7 inlinado, omitido por brevidade. COPIAR LÓGICA DA TASK 7 AQUI ANTES DE APLICAR.]
  -- IMPORTANTE: ao copiar, manter idêntico à Task 7 (não alterar lógica de distribuição).

  -- 8.1. Bulk insert em schedule_items
  INSERT INTO schedule_items (
    id, user_id, plano_id, week_number, type, status, title,
    duracao_minutos, subtopico_id, topico_id, scheduled_date, version
  )
  SELECT
    gen_random_uuid(), v_user_id, p_plano_uuid, a.week_number, a.tipo, 'pendente',
    a.title, a.minutos, a.subtopico_id, a.topico_id,
    -- scheduled_date = início da semana
    (SELECT data_inicio FROM _ctx_plano) + ((a.week_number - 1) * 7)::INTEGER,
    1
  FROM _ctx_assigned a;

  GET DIAGNOSTICS v_items_created = ROW_COUNT;

  -- 8.2. Popular weekly_stats (1 row por semana)
  INSERT INTO weekly_stats (
    plano_id, user_id, week_number, week_start, week_end,
    items_total, items_completed, minutes_total, minutes_completed,
    completion_pct, unlocked_early, overflow
  )
  SELECT
    p_plano_uuid, v_user_id, s.week_number, s.week_start, s.week_end,
    COALESCE(stats.cnt, 0),
    0,
    COALESCE(stats.mins, 0),
    0,
    0.0,
    FALSE,
    -- Overflow se total da semana > capacidade total da semana
    COALESCE(stats.mins, 0) > (
      SELECT SUM(capacidade_dia(
        s.week_start + dd::INTEGER,
        (SELECT weekday_minutes FROM _ctx_config),
        (SELECT weekend_minutes FROM _ctx_config),
        COALESCE((SELECT daily_exceptions FROM _ctx_config), '{}'::JSONB)
      ))
      FROM generate_series(0, 6) dd
    )
  FROM _ctx_semanas s
  LEFT JOIN (
    SELECT week_number, COUNT(*) AS cnt, SUM(minutos) AS mins
    FROM _ctx_assigned
    GROUP BY week_number
  ) stats USING (week_number)
  ON CONFLICT (plano_id, week_number) DO UPDATE SET
    items_total       = EXCLUDED.items_total,
    minutes_total     = EXCLUDED.minutes_total,
    overflow          = EXCLUDED.overflow;

  SELECT COUNT(*) FROM weekly_stats
    WHERE plano_id = p_plano_uuid AND overflow = TRUE
    INTO v_overflow_weeks;

  IF v_overflow_weeks > 0 THEN
    v_warnings := v_warnings || jsonb_build_object(
      'warning', 'capacity_overflow',
      'weeks', v_overflow_weeks,
      'msg', format('%s semanas excedem a capacidade configurada', v_overflow_weeks)
    );
  END IF;

  -- 8.3. Log em plan_decisions
  INSERT INTO plan_decisions (plano_id, action, reason, output_summary, algorithm_variant, triggered_by)
  VALUES (
    p_plano_uuid,
    'initial_distribution',
    'gerar_cronograma_v2',
    jsonb_build_object(
      'items_created',   v_items_created,
      'overflow_weeks',  v_overflow_weeks,
      'total_semanas',   v_total_semanas
    ),
    'v2_default',
    'rpc_initial'
  );

  v_result := jsonb_build_object(
    'status',          'completed',
    'plano_id',        p_plano_uuid,
    'items_created',   v_items_created,
    'overflow_weeks',  v_overflow_weeks,
    'total_semanas',   v_total_semanas,
    'warnings',        v_warnings
  );

  RETURN v_result;
END $$;
```

> ⚠️ **Subagent: ao escrever esta migração, COPIAR a lógica de blocks + distribuição + simulados/redação da Task 7 onde indicado.** Não deixar em "[omitido]". O reviewer vai checar.

- [ ] **Step 2: Aplicar + commit**

```bash
git add supabase/migrations/20260515120600_cronograma_v2_gerar_bulk_insert.sql
git commit -m "feat(cronograma-v2): finalize gerar_cronograma_v2 with bulk insert and stats"
```

---

### Task 9: `verify_09_gerar_basico.sql` — caso minimal end-to-end

**Files:**
- Create: `supabase/verify/cronograma_v2/verify_09_gerar_basico.sql`

Cria fake user + plano + config + 1 disciplina + 2 subtópicos. Chama `gerar_cronograma_v2`. Confere: 2 semanas, 4 items (2 teoria + 2 questões), weekly_stats com 2 rows, plan_decisions com 1 row. Tudo em transação ROLLBACK.

- [ ] **Step 1: Criar verify**

```sql
-- Smoke test: cenário minimal pra gerar_cronograma_v2
BEGIN;
  -- Fake user
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000a01', 'test-gerar@verify.local', '',
    NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Fake disciplina + topico + subtopicos (assumindo schema já existente)
  INSERT INTO disciplinas (id, nome) VALUES
    ('00000000-0000-0000-0000-000000000b01', 'Direito Constitucional (test)')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO topicos (id, disciplina_id, nome) VALUES
    ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000b01', 'Princípios Fundamentais')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO subtopicos (id, topico_id, nome, estimated_duration_minutes) VALUES
    ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000c01', 'Conceito de Estado', 45),
    ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000c01', 'Soberania', 50)
  ON CONFLICT (id) DO NOTHING;

  -- Plano + config + disciplina
  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000a01',
          'Plano teste', '2026-05-15', '2026-05-29', 'continuo', 'ativo');

  INSERT INTO plano_config (plano_id, weekday_minutes, weekend_minutes, block_duration_minutes,
    mix_ratio, simulados_freq, tem_redacao, tipo_material, horario_preferido)
  VALUES ('00000000-0000-0000-0000-000000001001', 180, 240, 50,
          '{"teoria":0.5,"questoes":0.5}'::JSONB, 'nenhum', FALSE, 'misto', 'flexivel');

  INSERT INTO plano_disciplinas (plano_id, disciplina_id, peso, nivel_conhecimento, is_ponto_fraco)
  VALUES ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000b01',
          1.0, 'intermediario', FALSE);

  -- Executa gerar_cronograma_v2
  SELECT gerar_cronograma_v2('00000000-0000-0000-0000-000000001001'::UUID) AS result;

  -- Asserts
  SELECT 'items_created' AS check, COUNT(*) AS actual, 4 AS expected
    FROM schedule_items WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  SELECT 'weekly_stats_rows', COUNT(*), 2
    FROM weekly_stats WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  SELECT 'plan_decisions_rows', COUNT(*), 1
    FROM plan_decisions WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  SELECT 'teoria_e_questoes', COUNT(DISTINCT type), 2
    FROM schedule_items WHERE plano_id = '00000000-0000-0000-0000-000000001001';
ROLLBACK;
```

- [ ] **Step 2: Commit (sem aplicar — verify só)**

```bash
git add supabase/verify/cronograma_v2/verify_09_gerar_basico.sql
git commit -m "test(cronograma-v2): basic end-to-end smoke for gerar_cronograma_v2"
```

> **Note**: user vai rodar manualmente no Supabase Studio. Subagent não tenta rodar.

---

### Task 10: `criar_plano_completo` — orquestrador atômico

**Files:**
- Create: `supabase/migrations/20260515120700_cronograma_v2_criar_plano_completo.sql`

Função única que: (1) valida params, (2) INSERT em `planos_estudo` com `status='ativo'`, (3) INSERT em `plano_config`, (4) INSERT em `plano_disciplinas` (1 por disciplina do JSONB), (5) chama `gerar_cronograma_v2`, (6) INSERT inicial em `plano_predictions_history`, (7) retorna `{plano_id, items_created, warnings}`. Tudo numa transação implícita PL/pgSQL — erro em qualquer passo aborta tudo.

- [ ] **Step 1: Criar migração**

```sql
-- UP: criar_plano_completo (orquestrador atômico)
-- DOWN: DROP FUNCTION criar_plano_completo

CREATE OR REPLACE FUNCTION criar_plano_completo(
  p_user_id                 UUID,
  p_cargo_id                INTEGER,
  p_cargo_snapshot          JSONB,
  p_data_inicio             DATE,
  p_data_prova              DATE,
  p_weekday_minutes         INTEGER,
  p_weekend_minutes         INTEGER,
  p_block_duration_minutes  INTEGER,
  p_mix_ratio               JSONB,
  p_simulados_freq          TEXT,
  p_tem_redacao             BOOLEAN,
  p_tipo_material           TEXT,
  p_horario_preferido       TEXT,
  p_disciplinas             JSONB,
  p_template_id             UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plano_id    UUID;
  v_d           JSONB;
  v_gerar_res   JSONB;
BEGIN
  -- 1. Validações
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id obrigatório' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_data_prova <= p_data_inicio THEN
    RAISE EXCEPTION 'data_prova deve ser > data_inicio' USING ERRCODE = '22023';
  END IF;
  IF calcular_total_semanas(p_data_inicio, p_data_prova) < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas' USING ERRCODE = 'P0001';
  END IF;
  IF p_weekday_minutes < 30 OR p_weekend_minutes < 0 THEN
    RAISE EXCEPTION 'Capacidade diária inválida' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_disciplinas) != 'array' OR jsonb_array_length(p_disciplinas) = 0 THEN
    RAISE EXCEPTION 'p_disciplinas deve ser array não vazio' USING ERRCODE = '22023';
  END IF;

  -- Limite de pontos fracos: max 3
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_disciplinas) d
      WHERE (d->>'is_ponto_fraco')::BOOLEAN = TRUE) > 3 THEN
    RAISE EXCEPTION 'Máximo 3 disciplinas como ponto fraco' USING ERRCODE = '22023';
  END IF;

  -- 2. Insert plano
  INSERT INTO planos_estudo (
    id, user_id, nome, data_inicio, data_prova, mode, status,
    cargo_snapshot, template_id, algorithm_variant
  ) VALUES (
    gen_random_uuid(), p_user_id,
    COALESCE(p_cargo_snapshot->>'nome', 'Plano'),
    p_data_inicio, p_data_prova, 'edital', 'ativo',
    p_cargo_snapshot, p_template_id, 'v2_default'
  ) RETURNING id INTO v_plano_id;

  -- 3. Insert config + history snapshot
  INSERT INTO plano_config (
    plano_id, weekday_minutes, weekend_minutes, block_duration_minutes,
    mix_ratio, simulados_freq, tem_redacao, tipo_material, horario_preferido
  ) VALUES (
    v_plano_id, p_weekday_minutes, p_weekend_minutes, p_block_duration_minutes,
    p_mix_ratio, p_simulados_freq::simulados_freq_enum, p_tem_redacao,
    p_tipo_material::tipo_material_enum, p_horario_preferido::horario_preferido_enum
  );

  INSERT INTO plano_config_history (plano_id, version, snapshot)
  VALUES (v_plano_id, 1, jsonb_build_object(
    'weekday_minutes', p_weekday_minutes,
    'weekend_minutes', p_weekend_minutes,
    'mix_ratio', p_mix_ratio,
    'simulados_freq', p_simulados_freq,
    'tem_redacao', p_tem_redacao
  ));

  -- 4. Insert disciplinas (1 por elemento do JSONB)
  FOR v_d IN SELECT * FROM jsonb_array_elements(p_disciplinas)
  LOOP
    INSERT INTO plano_disciplinas (
      plano_id, disciplina_id, peso, nivel_conhecimento,
      is_ponto_fraco, excluded_subtopico_ids
    ) VALUES (
      v_plano_id,
      (v_d->>'disciplina_id')::UUID,
      COALESCE((v_d->>'peso')::NUMERIC, 1.0),
      COALESCE((v_d->>'nivel_conhecimento')::nivel_conhecimento_enum, 'intermediario'),
      COALESCE((v_d->>'is_ponto_fraco')::BOOLEAN, FALSE),
      COALESCE(
        ARRAY(SELECT (e #>> '{}')::UUID FROM jsonb_array_elements(v_d->'excluded_subtopico_ids') e),
        '{}'::UUID[]
      )
    );
  END LOOP;

  -- 5. Chama gerar_cronograma_v2 (inline na mesma transação)
  v_gerar_res := gerar_cronograma_v2(v_plano_id);

  -- 6. Predição inicial — coverage_pct baseado em overflow
  INSERT INTO plano_predictions_history (
    plano_id, coverage_pct, slack_weeks, pace_index, weakest_disciplinas, recommendations
  ) VALUES (
    v_plano_id,
    CASE
      WHEN (v_gerar_res->>'overflow_weeks')::INTEGER = 0 THEN 100.0
      ELSE GREATEST(0, 100 - (v_gerar_res->>'overflow_weeks')::INTEGER * 5)
    END,
    NULL, 1.0,
    '[]'::JSONB,
    CASE
      WHEN (v_gerar_res->>'overflow_weeks')::INTEGER > 0 THEN
        '[{"code":"capacity_overflow","msg":"Reduza disciplinas ou aumente capacidade"}]'::JSONB
      ELSE '[]'::JSONB
    END
  );

  -- 7. Return
  RETURN jsonb_build_object(
    'plano_id',       v_plano_id,
    'items_created',  v_gerar_res->'items_created',
    'overflow_weeks', v_gerar_res->'overflow_weeks',
    'warnings',       v_gerar_res->'warnings'
  );
END $$;

COMMENT ON FUNCTION criar_plano_completo IS
  'Orquestrador atômico do setup. Cria plano + config + disciplinas + chama gerar_cronograma_v2 + grava predição inicial. Spec 7.5.';
```

- [ ] **Step 2: Aplicar + commit**

```bash
git add supabase/migrations/20260515120700_cronograma_v2_criar_plano_completo.sql
git commit -m "feat(cronograma-v2): add criar_plano_completo atomic orchestrator"
```

---

### Task 11: `verify_12_criar_plano_atomico.sql` — end-to-end + rollback em erro

**Files:**
- Create: `supabase/verify/cronograma_v2/verify_12_criar_plano_atomico.sql`

Caso de sucesso (insert plano + 1 disciplina + 2 subtopicos → 4 items). Caso de erro (data_prova <= data_inicio → tudo aborta, sem rows residuais). Caso de limite (4 pontos fracos → erro).

- [ ] **Step 1: Criar verify**

```sql
-- Cenário 1: sucesso
BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000a02', 'test-criar@verify.local', '',
    NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO disciplinas (id, nome) VALUES
    ('00000000-0000-0000-0000-000000000b02', 'Direito Penal (test)')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO topicos (id, disciplina_id, nome) VALUES
    ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000b02', 'Teoria do Crime')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO subtopicos (id, topico_id, nome, estimated_duration_minutes) VALUES
    ('00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000c02', 'Tipicidade', 50),
    ('00000000-0000-0000-0000-000000000d12', '00000000-0000-0000-0000-000000000c02', 'Ilicitude', 45)
  ON CONFLICT (id) DO NOTHING;

  SELECT criar_plano_completo(
    p_user_id => '00000000-0000-0000-0000-000000000a02',
    p_cargo_id => 1,
    p_cargo_snapshot => '{"nome":"Test","qtd_disciplinas":1}'::JSONB,
    p_data_inicio => '2026-05-15',
    p_data_prova => '2026-05-29',
    p_weekday_minutes => 180,
    p_weekend_minutes => 240,
    p_block_duration_minutes => 50,
    p_mix_ratio => '{"teoria":0.5,"questoes":0.5}'::JSONB,
    p_simulados_freq => 'nenhum',
    p_tem_redacao => FALSE,
    p_tipo_material => 'misto',
    p_horario_preferido => 'flexivel',
    p_disciplinas => '[{"disciplina_id":"00000000-0000-0000-0000-000000000b02","nivel_conhecimento":"intermediario","is_ponto_fraco":false}]'::JSONB
  ) AS result;

  -- Confere 4 items + 1 prediction + 1 config + 1 disciplina
  SELECT COUNT(*) AS items FROM schedule_items
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02');
  -- esperado: 4

  SELECT COUNT(*) AS preds FROM plano_predictions_history
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02');
  -- esperado: 1
ROLLBACK;

-- Cenário 2: erro de data → rollback completo
BEGIN;
  -- Tentativa com data_prova antes de data_inicio
  SELECT criar_plano_completo(
    p_user_id => '00000000-0000-0000-0000-000000000a02',
    p_cargo_id => 1,
    p_cargo_snapshot => '{}'::JSONB,
    p_data_inicio => '2026-05-15',
    p_data_prova => '2026-05-10',  -- ERRO
    p_weekday_minutes => 180, p_weekend_minutes => 240, p_block_duration_minutes => 50,
    p_mix_ratio => '{}'::JSONB, p_simulados_freq => 'nenhum', p_tem_redacao => FALSE,
    p_tipo_material => 'misto', p_horario_preferido => 'flexivel',
    p_disciplinas => '[]'::JSONB
  );
  -- ↑ esperado: ERROR P0001 ou 22023
ROLLBACK;

-- Cenário 3: 4 pontos fracos → erro
BEGIN;
  SELECT criar_plano_completo(
    p_user_id => '00000000-0000-0000-0000-000000000a02',
    p_cargo_id => 1, p_cargo_snapshot => '{}'::JSONB,
    p_data_inicio => '2026-05-15', p_data_prova => '2026-08-15',
    p_weekday_minutes => 180, p_weekend_minutes => 240, p_block_duration_minutes => 50,
    p_mix_ratio => '{}'::JSONB, p_simulados_freq => 'nenhum', p_tem_redacao => FALSE,
    p_tipo_material => 'misto', p_horario_preferido => 'flexivel',
    p_disciplinas => '[
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true},
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true},
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true},
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true}
    ]'::JSONB
  );
  -- ↑ esperado: ERROR 22023 "Máximo 3 disciplinas como ponto fraco"
ROLLBACK;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/verify/cronograma_v2/verify_12_criar_plano_atomico.sql
git commit -m "test(cronograma-v2): atomic test for criar_plano_completo (success + 2 error paths)"
```

---

### Task 12: Regenerar `src/types/database.ts` + atualizar `cronograma-v2.ts`

**Files:**
- Modify: `src/types/database.ts` (regen)
- Modify: `src/types/cronograma-v2.ts` (adicionar types das novas RPCs)

- [ ] **Step 1: Regen tipos**

```bash
cd "D:/meta novo/Metav2"
npx supabase gen types typescript --linked > src/types/database.ts
```

Confere que `gerar_cronograma_v2` e `criar_plano_completo` aparecem como `Database['public']['Functions']`.

- [ ] **Step 2: Adicionar wrappers tipados em `cronograma-v2.ts`**

Append ao arquivo:

```typescript
// ============================================================================
// Sub-plan 2 — RPC payload/result types
// ============================================================================

export type GerarCronogramaV2Result = {
  status: 'completed' | 'no_subtopics' | 'skeleton'
  plano_id: string
  items_created: number
  overflow_weeks: number
  total_semanas: number
  warnings: Array<{ warning: string; msg: string; [k: string]: unknown }>
}

export type CriarPlanoCompletoInput = {
  p_user_id: string
  p_cargo_id: number
  p_cargo_snapshot: {
    nome: string
    edital_id?: number
    qtd_disciplinas?: number
  }
  p_data_inicio: string  // YYYY-MM-DD
  p_data_prova: string
  p_weekday_minutes: number
  p_weekend_minutes: number
  p_block_duration_minutes: number
  p_mix_ratio: {
    teoria: number
    questoes: number
    revisao?: number
    flashcards?: number
  }
  p_simulados_freq: 'nenhum' | 'mensal' | 'quinzenal' | 'semanal'
  p_tem_redacao: boolean
  p_tipo_material: 'video' | 'pdf' | 'livro' | 'questoes' | 'misto'
  p_horario_preferido: 'manha' | 'tarde' | 'noite' | 'madrugada' | 'flexivel'
  p_disciplinas: Array<{
    disciplina_id: string
    peso?: number
    nivel_conhecimento?: 'iniciante' | 'intermediario' | 'avancado'
    is_ponto_fraco?: boolean
    excluded_subtopico_ids?: string[]
  }>
  p_template_id?: string | null
}

export type CriarPlanoCompletoResult = {
  plano_id: string
  items_created: number
  overflow_weeks: number
  warnings: GerarCronogramaV2Result['warnings']
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts src/types/cronograma-v2.ts
git commit -m "chore(cronograma-v2): regen types + add RPC payload/result interfaces"
```

---

### Task 13: Verify consolidado one-shot (extensão da Sub-plan 1)

**Files:**
- Modify: `supabase/verify/cronograma_v2/verify_all_oneshot.sql`

Adicionar seções 9-10 ao verify global: helpers existem, gerar_cronograma_v2 existe, criar_plano_completo existe, ambos com signatures esperados.

- [ ] **Step 1: Append seções**

```sql
-- Adicionar à CTE `checks`:

  -- Section 9: helpers + RPCs
  UNION ALL SELECT 80, 'function: aplicar_nivel_multiplicador',
         (SELECT COUNT(*)::INT FROM pg_proc WHERE proname = 'aplicar_nivel_multiplicador'), 1
  UNION ALL SELECT 81, 'function: aplicar_ponto_fraco_boost',
         (SELECT COUNT(*)::INT FROM pg_proc WHERE proname = 'aplicar_ponto_fraco_boost'), 1
  UNION ALL SELECT 82, 'function: calcular_total_semanas',
         (SELECT COUNT(*)::INT FROM pg_proc WHERE proname = 'calcular_total_semanas'), 1
  UNION ALL SELECT 83, 'function: capacidade_dia',
         (SELECT COUNT(*)::INT FROM pg_proc WHERE proname = 'capacidade_dia'), 1
  UNION ALL SELECT 84, 'function: gerar_cronograma_v2 (signature 1-arg uuid)',
         (SELECT COUNT(*)::INT FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
          WHERE n.nspname='public' AND p.proname='gerar_cronograma_v2' AND p.pronargs=1), 1
  UNION ALL SELECT 85, 'function: criar_plano_completo (signature 15-arg)',
         (SELECT COUNT(*)::INT FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
          WHERE n.nspname='public' AND p.proname='criar_plano_completo' AND p.pronargs=15), 1
  UNION ALL SELECT 86, 'procedure: _v2_carrega_contexto',
         (SELECT COUNT(*)::INT FROM pg_proc WHERE proname='_v2_carrega_contexto' AND prokind='p'), 1

  -- Section 10: migration history (deve ter +9 migrations 20260515*)
  UNION ALL SELECT 90, 'migrations: 9 V2 sub-plan-2 migrations recorded',
         (SELECT COUNT(*)::INT FROM supabase_migrations.schema_migrations
          WHERE version LIKE '20260515%'), 9
```

- [ ] **Step 2: Commit**

```bash
git add supabase/verify/cronograma_v2/verify_all_oneshot.sql
git commit -m "test(cronograma-v2): extend one-shot verify with sub-plan 2 functions"
```

---

### Task 14: Doc — `docs/cronograma-v2/sub-plan-2-applied.md`

**Files:**
- Create: `docs/cronograma-v2/sub-plan-2-applied.md`

Espelha o doc da Sub-plan 1: lista migrations, commit chain, observações.

- [ ] **Step 1: Criar doc**

Conteúdo template:

```markdown
# Sub-plan 2 — RPCs core (applied)

## Migrations aplicadas (9)

| Timestamp | Arquivo | Conteúdo |
|-----------|---------|----------|
| 20260515120000 | cronograma_v2_helpers.sql | aplicar_nivel/ponto_fraco/total_semanas/capacidade_dia |
| 20260515120100 | cronograma_v2_temp_tables_helper.sql | _v2_carrega_contexto procedure |
| 20260515120200 | cronograma_v2_gerar_skeleton.sql | gerar_cronograma_v2 v0 (validation) |
| 20260515120300 | cronograma_v2_gerar_blocks.sql | gerar_cronograma_v2 v1 (blocks) |
| 20260515120400 | cronograma_v2_gerar_distribuicao.sql | gerar_cronograma_v2 v2 (weekly distribution) |
| 20260515120500 | cronograma_v2_gerar_simulados_redacao.sql | gerar_cronograma_v2 v3 (simulados + redação) |
| 20260515120600 | cronograma_v2_gerar_bulk_insert.sql | gerar_cronograma_v2 v4 (insert + stats + log) |
| 20260515120700 | cronograma_v2_criar_plano_completo.sql | orquestrador atômico |
| 20260515120800 | (reservado pra prediction helper futuro) | — |

## Commit chain

[Gerado via `git log --oneline ce9fc9d..HEAD`]

## Validação no Supabase Studio

1. Abrir SQL Editor
2. Colar `verify_all_oneshot.sql` (versão extendida da Sub-plan 2)
3. Esperar 32 rows (25 da Sub-plan 1 + 7 da Sub-plan 2) com result=PASS
4. Para testes E2E: colar `verify_09_gerar_basico.sql` e `verify_12_criar_plano_atomico.sql`

## Próximo passo

Sub-plan 3: `SyncEditalService` + `TopicoDecomposer` (TypeScript + Claude Haiku).
```

- [ ] **Step 2: Commit**

```bash
git add docs/cronograma-v2/sub-plan-2-applied.md
git commit -m "docs(cronograma-v2): summary of sub-plan 2 (RPCs) applied"
```

---

## Self-Review

**Spec coverage check:**

- Spec §6.1 (signature) → Task 4 ✅
- Spec §6.2 step 1 (contexto) → Task 3 (procedure) + Task 4 (CALL) ✅
- Spec §6.2 step 2 (nivel multiplicador) → Task 1 ✅
- Spec §6.2 step 3 (ponto fraco +30%) → Task 1 ✅
- Spec §6.2 step 4 (blocks lógicos) → Task 5 ✅
- Spec §6.2 step 5 (distribuição balanceada) → Task 6 ✅
- Spec §6.2 step 6 (ciclo teoria→questões 1-2sem) → parcialmente em Task 6 (round-robin com ordem). **Gap conhecido:** o gap exato de 1-2 semanas teoria→questões não está garantido — depende da posição global. Marcar como "future improvement" no doc.
- Spec §6.2 step 7 (simulados) → Task 7 ✅
- Spec §6.2 step 8 (redação) → Task 7 ✅
- Spec §6.2 step 9 (feriados) → Task 2 (capacidade_dia) + Task 8 (weekly_stats.overflow usa) ✅
- Spec §6.2 step 10 (bulk insert) → Task 8 ✅
- Spec §6.2 step 11 (log plan_decisions) → Task 8 ✅
- Spec §6.3 garantias (±1 por semana) → enforced pela divisão `global_seq / blocks_per_week` ✅
- Spec §6.4 edge cases (total_semanas<2) → Task 4 RAISE ✅
- Spec §6.4 edge cases (overflow) → Task 8 weekly_stats.overflow + warning ✅
- Spec §7.5 (criar_plano_completo) → Task 10 ✅
- Spec §A (mapeamento payload) → Task 12 (types TS) ✅

**Placeholder scan:** A Task 7 e Task 8 referenciam "Task X inlinado, omitido por brevidade". O subagent precisa de instrução explícita pra COPIAR a lógica das tasks anteriores ao escrever a nova versão da função (não pode deixar "[omitido]"). Reviewer deve checar.

**Type consistency:** Nomes de colunas (`is_anticipated`, `tem_redacao`, etc.) batem com Sub-plan 1 ✅. Enums (`schedule_item_type`) precisam ter values `simulado_periodico` e `redacao` — checar antes da Task 7.

**Scope check:** Sub-plan 2 fica em PL/pgSQL. Decomposição IA, sync edital, e setup UI ficam pra Sub-plans 3 e 4. ✅

---

## Pré-execução checklist

Antes de despachar:

- [ ] Confirmar que `schedule_item_type` enum tem values `simulado_periodico` e `redacao` (rodar `SELECT unnest(enum_range(NULL::schedule_item_type))`)
- [ ] Confirmar que tabela `disciplinas`, `topicos`, `subtopicos` existem (do schema V1)
- [ ] Confirmar que `plano_disciplinas.peso` é coluna existente (Leva 1)
- [ ] Confirmar tabela `subtopicos` tem coluna `duracao_minutos`

Se algum não existir, criar migration adicional ANTES de Task 1. Ou ajustar SQL pra usar o que existe.

---

## Plano completo. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-2-rpcs.md`.

**Duas opções de execução:**

1. **Subagent-Driven** (continuar com o padrão da Sub-plan 1)
2. **Inline Execution** (executar tasks nesta sessão)

Qual abordagem?
