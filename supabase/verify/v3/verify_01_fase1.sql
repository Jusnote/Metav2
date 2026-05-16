-- V3 Fase 1 — Smoke test SQL
-- Retorna PASS/FAIL para cada check crítico
-- Executar no Supabase Studio SQL Editor após aplicar todas as migrations
-- Refs: doc 04 (schema), doc 10 (fase 1)

WITH
-- 1. Verificação de tabelas (16 tabelas esperadas)
tabelas_check AS (
  SELECT
    t.tablename,
    CASE WHEN t.tablename IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS result
  FROM (VALUES
    ('concursos'),
    ('editais_raw'),
    ('disciplinas'),
    ('blocos_tematicos'),
    ('topicos'),
    ('subtopicos'),
    ('conteudos'),
    ('questoes'),
    ('alunos'),
    ('semanas'),
    ('atividades'),
    ('fsrs_cards'),
    ('fsrs_reviews_log'),
    ('tentativas_questoes'),
    ('eventos'),
    -- concursos e editais_raw = 2 + 4 árvore + 2 conteúdo + 1 aluno + 2 semanas/ativ + 2 fsrs + 1 tentativas + 1 eventos = 15... editais_raw é a 16a
    ('alunos') -- verificado acima, total = 15 únicas + editais_raw = 16
  ) AS expected(tablename)
  LEFT JOIN pg_tables t
    ON t.schemaname = 'public' AND t.tablename = expected.tablename
),

-- Contagem definitiva de tabelas V3 existentes
tabelas_count AS (
  SELECT
    CASE
      WHEN COUNT(*) >= 16 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 16 tabelas encontradas'
    END AS result,
    'tabelas_v3_count' AS check_name,
    string_agg(tablename, ', ' ORDER BY tablename) AS detalhes
  FROM pg_tables
  WHERE schemaname = 'public'
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

-- 2. RLS habilitado nas 5 tabelas obrigatórias
rls_check AS (
  SELECT
    'rls_habilitado' AS check_name,
    CASE
      WHEN COUNT(*) = 5 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 5 tabelas com RLS'
    END AS result,
    string_agg(tablename, ', ' ORDER BY tablename) AS detalhes
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('alunos', 'atividades', 'fsrs_cards', 'tentativas_questoes', 'semanas')
    AND rowsecurity = true
),

-- 3. Views criadas
views_check AS (
  SELECT
    'views_v3' AS check_name,
    CASE
      WHEN COUNT(*) = 2 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(*) || ' de 2 views'
    END AS result,
    string_agg(viewname, ', ' ORDER BY viewname) AS detalhes
  FROM pg_views
  WHERE schemaname = 'public'
    AND viewname IN ('v_progresso_disciplinas', 'v_memoria_em_risco')
),

-- 4. Trigger update_atualizado_em aplicado nas tabelas mutáveis
triggers_check AS (
  SELECT
    'triggers_atualizado_em' AS check_name,
    CASE
      WHEN COUNT(DISTINCT event_object_table) >= 8 THEN 'PASS'
      ELSE 'FAIL — apenas ' || COUNT(DISTINCT event_object_table) || ' de 8+ tabelas com trigger'
    END AS result,
    string_agg(DISTINCT event_object_table, ', ' ORDER BY event_object_table) AS detalhes
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name LIKE 'trg_%_atualizado'
    AND event_object_table IN (
      'concursos', 'disciplinas', 'topicos', 'conteudos', 'questoes',
      'alunos', 'fsrs_cards'
    )
),

-- 5. Função is_admin() existe
is_admin_check AS (
  SELECT
    'funcao_is_admin' AS check_name,
    CASE
      WHEN COUNT(*) = 1 THEN 'PASS'
      ELSE 'FAIL — função is_admin() não encontrada'
    END AS result,
    COALESCE(string_agg(routine_name, ', '), 'nenhuma') AS detalhes
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'is_admin'
    AND routine_type = 'FUNCTION'
),

-- 6. Migrations V3 registradas em schema_migrations
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
SELECT check_name, result, detalhes FROM tabelas_count
UNION ALL
SELECT check_name, result, detalhes FROM rls_check
UNION ALL
SELECT check_name, result, detalhes FROM views_check
UNION ALL
SELECT check_name, result, detalhes FROM triggers_check
UNION ALL
SELECT check_name, result, detalhes FROM is_admin_check
UNION ALL
SELECT check_name, result, detalhes FROM migrations_check
ORDER BY check_name;
