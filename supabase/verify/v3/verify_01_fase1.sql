-- V3 Fase 1 — Smoke test SQL
-- Retorna PASS/FAIL para cada check crítico
-- Executar no Supabase Studio SQL Editor após aplicar todas as migrations
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- ATUALIZADO: todas as tabelas V3 vivem em schema "coaching" (não public)

WITH
-- 1. Contagem definitiva de tabelas V3 no schema coaching
tabelas_count AS (
  SELECT
    CASE
      WHEN COUNT(*) >= 15 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 15 tabelas encontradas'
    END AS result,
    'tabelas_v3_count' AS check_name,
    string_agg(tablename, ', ' ORDER BY tablename) AS detalhes
  FROM pg_tables
  WHERE schemaname = 'coaching'
    AND tablename IN (
      'concursos', 'editais_raw',
      'disciplinas', 'blocos_tematicos', 'topicos', 'subtopicos',
      'conteudos', 'questoes',
      'alunos',
      'semanas', 'atividades',
      'fsrs_cards', 'fsrs_reviews_log',
      'tentativas_questoes',
      'eventos'
    )
),

-- 2. Schema coaching existe e tem GRANTs
schema_check AS (
  SELECT
    'schema_coaching_existe' AS check_name,
    CASE
      WHEN COUNT(*) = 1 THEN 'PASS'
      ELSE 'FAIL — schema coaching não encontrado'
    END AS result,
    COALESCE(string_agg(schema_name, ', '), 'não existe') AS detalhes
  FROM information_schema.schemata
  WHERE schema_name = 'coaching'
),

-- 3. RLS habilitado nas tabelas de dados do aluno
rls_check AS (
  SELECT
    'rls_habilitado' AS check_name,
    CASE
      WHEN COUNT(*) = 5 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 5 tabelas com RLS'
    END AS result,
    string_agg(tablename, ', ' ORDER BY tablename) AS detalhes
  FROM pg_tables
  WHERE schemaname = 'coaching'
    AND tablename IN ('alunos', 'atividades', 'fsrs_cards', 'tentativas_questoes', 'semanas')
    AND rowsecurity = true
),

-- 4. Views criadas em coaching
views_check AS (
  SELECT
    'views_v3' AS check_name,
    CASE
      WHEN COUNT(*) = 2 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 2 views'
    END AS result,
    string_agg(viewname, ', ' ORDER BY viewname) AS detalhes
  FROM pg_views
  WHERE schemaname = 'coaching'
    AND viewname IN ('v_progresso_disciplinas', 'v_memoria_em_risco')
),

-- 5. Trigger update_atualizado_em aplicado nas tabelas mutáveis do schema coaching
triggers_check AS (
  SELECT
    'triggers_atualizado_em' AS check_name,
    CASE
      WHEN COUNT(DISTINCT event_object_table) >= 7 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(DISTINCT event_object_table) || ' de 7+ tabelas com trigger'
    END AS result,
    string_agg(DISTINCT event_object_table, ', ' ORDER BY event_object_table) AS detalhes
  FROM information_schema.triggers
  WHERE event_object_schema = 'coaching'
    AND trigger_name LIKE 'trg_%_atualizado'
    AND event_object_table IN (
      'concursos', 'disciplinas', 'topicos', 'conteudos', 'questoes',
      'alunos', 'fsrs_cards'
    )
),

-- 6. Função is_admin() existe em coaching
is_admin_check AS (
  SELECT
    'funcao_is_admin' AS check_name,
    CASE
      WHEN COUNT(*) = 1 THEN 'PASS'
      ELSE 'FAIL — função coaching.is_admin() não encontrada'
    END AS result,
    COALESCE(string_agg(routine_schema || '.' || routine_name, ', '), 'nenhuma') AS detalhes
  FROM information_schema.routines
  WHERE routine_schema = 'coaching'
    AND routine_name = 'is_admin'
    AND routine_type = 'FUNCTION'
),

-- 7. Função update_atualizado_em existe em coaching
trigger_fn_check AS (
  SELECT
    'funcao_update_atualizado_em' AS check_name,
    CASE
      WHEN COUNT(*) = 1 THEN 'PASS'
      ELSE 'FAIL — função coaching.update_atualizado_em() não encontrada'
    END AS result,
    COALESCE(string_agg(routine_schema || '.' || routine_name, ', '), 'nenhuma') AS detalhes
  FROM information_schema.routines
  WHERE routine_schema = 'coaching'
    AND routine_name = 'update_atualizado_em'
    AND routine_type = 'FUNCTION'
),

-- 8. Tabelas V2 em public intocadas (disciplinas, topicos, subtopicos)
v2_intacto_check AS (
  SELECT
    'v2_public_intacto' AS check_name,
    CASE
      WHEN COUNT(*) >= 3 THEN 'PASS — V2 em public intocado'
      ELSE 'WARN — ' || COUNT(*) || ' de 3 tabelas V2 esperadas em public'
    END AS result,
    COALESCE(string_agg(tablename, ', ' ORDER BY tablename), 'nenhuma') AS detalhes
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('disciplinas', 'topicos', 'subtopicos')
),

-- 9. Migrations V3 registradas em schema_migrations
migrations_check AS (
  SELECT
    'migrations_registradas' AS check_name,
    CASE
      WHEN COUNT(*) >= 11 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 11 migrations V3 registradas'
    END AS result,
    string_agg(version::text, ', ' ORDER BY version) AS detalhes
  FROM supabase_migrations.schema_migrations
  WHERE version::text LIKE '20260516130%'
    OR version::text = '20260516131000'
)

-- Resultado final consolidado
SELECT check_name, result, detalhes FROM schema_check
UNION ALL
SELECT check_name, result, detalhes FROM tabelas_count
UNION ALL
SELECT check_name, result, detalhes FROM rls_check
UNION ALL
SELECT check_name, result, detalhes FROM views_check
UNION ALL
SELECT check_name, result, detalhes FROM triggers_check
UNION ALL
SELECT check_name, result, detalhes FROM trigger_fn_check
UNION ALL
SELECT check_name, result, detalhes FROM is_admin_check
UNION ALL
SELECT check_name, result, detalhes FROM v2_intacto_check
UNION ALL
SELECT check_name, result, detalhes FROM migrations_check
ORDER BY check_name;
