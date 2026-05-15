-- ============================================================================
-- VERIFY ALL — Cronograma V2 Schema (Sub-plan 1)
-- ============================================================================
-- Read-only checks. Safe to run in Supabase Studio SQL Editor.
-- Each section is separated by a header; run all together or one section
-- at a time. Expected results in comments below each query.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: ENUMS (5 novos + 'rascunho' adicionado em plano_status)
-- ---------------------------------------------------------------------------
SELECT typname FROM pg_type
WHERE typname IN (
  'nivel_conhecimento_enum',
  'simulados_freq_enum',
  'tipo_material_enum',
  'horario_preferido_enum',
  'plan_template_visibility'
)
ORDER BY typname;
-- esperado: 5 rows

SELECT 'rascunho' = ANY(enum_range(NULL::plano_status)::TEXT[]) AS rascunho_in_plano_status;
-- esperado: true

-- ---------------------------------------------------------------------------
-- SECTION 2: NOVAS TABELAS (12)
-- ---------------------------------------------------------------------------
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'plan_decisions', 'behavioral_signals', 'edital_cache',
    'plano_predictions_history', 'plan_events', 'dead_letters',
    'plano_config_history', 'feriados_nacionais', 'plan_templates',
    'graphql_cache', 'analytics_events', 'rate_limit_buckets',
    'feature_flags', 'ai_quality_feedback'
  )
ORDER BY tablename;
-- esperado: 14 rows

-- View plano_predictions
SELECT viewname FROM pg_views WHERE viewname = 'plano_predictions';
-- esperado: 1 row

-- Sequence plan_events_seq
SELECT relname FROM pg_class WHERE relkind = 'S' AND relname = 'plan_events_seq';
-- esperado: 1 row

-- ---------------------------------------------------------------------------
-- SECTION 3: PARTITIONING (plan_decisions, behavioral_signals, plan_events)
-- ---------------------------------------------------------------------------
SELECT
  parent.relname AS parent_table,
  child.relname  AS partition_name
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname IN ('plan_decisions', 'behavioral_signals', 'plan_events')
ORDER BY parent.relname, child.relname;
-- esperado: 9 rows (3 partições por tabela: _2026_05, _2026_06, _default)

-- ---------------------------------------------------------------------------
-- SECTION 4: COLUNAS NOVAS EM TABELAS V1 (Phase B — 21 colunas)
-- ---------------------------------------------------------------------------
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'planos_estudo'      AND column_name IN ('cargo_snapshot', 'template_id', 'algorithm_variant', 'deleted_at')) OR
    (table_name = 'plano_config'       AND column_name IN ('simulados_freq', 'incluir_redacao', 'tipo_material', 'horario_preferido')) OR
    (table_name = 'plano_disciplinas'  AND column_name IN ('nivel', 'ponto_fraco', 'excluded_subtopico_ids')) OR
    (table_name = 'schedule_items'     AND column_name IN ('anticipated_at', 'fsrs_state', 'fsrs_data', 'parent_item_id', 'version')) OR
    (table_name = 'topicos'            AND column_name IN ('referencias_legais', 'nome_curto', 'ai_decomposed_at')) OR
    (table_name = 'weekly_stats'       AND column_name IN ('unlocked_early', 'overflow_count'))
  )
ORDER BY table_name, column_name;
-- esperado: 21 rows

-- ---------------------------------------------------------------------------
-- SECTION 5: TRIGGERS (3 novos)
-- ---------------------------------------------------------------------------
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_name IN (
  'trg_publish_completion_event',
  'trg_publish_week_completed',
  'trg_increment_version'
)
ORDER BY trigger_name;
-- esperado: 3 rows

SELECT proname FROM pg_proc
WHERE proname IN (
  'fn_publish_completion_event',
  'fn_publish_week_completed',
  'fn_increment_schedule_item_version',
  'is_feature_enabled'
)
ORDER BY proname;
-- esperado: 4 rows (3 trigger functions + is_feature_enabled)

-- ---------------------------------------------------------------------------
-- SECTION 6: RLS ATIVADO EM TODAS AS NOVAS TABELAS
-- ---------------------------------------------------------------------------
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
-- esperado: 14 rows, todas com rowsecurity = true

SELECT tablename, COUNT(*) AS policy_count FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'plan_decisions', 'behavioral_signals', 'edital_cache',
    'plano_predictions_history', 'plan_events', 'dead_letters',
    'plano_config_history', 'feriados_nacionais', 'plan_templates',
    'graphql_cache', 'analytics_events', 'feature_flags', 'ai_quality_feedback'
  )
GROUP BY tablename
ORDER BY tablename;
-- esperado: 13 rows, pelo menos 1 policy por tabela

-- ---------------------------------------------------------------------------
-- SECTION 7: SEED FERIADOS NACIONAIS (2026-2028)
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS total_feriados FROM feriados_nacionais;
-- esperado: 39 (13 por ano × 3 anos)

SELECT EXTRACT(YEAR FROM data) AS ano, COUNT(*) FROM feriados_nacionais
GROUP BY ano ORDER BY ano;
-- esperado: 3 rows, 13 cada (2026, 2027, 2028)

SELECT data, nome FROM feriados_nacionais
WHERE data = '2026-09-07';
-- esperado: 1 row, Independência do Brasil

-- ---------------------------------------------------------------------------
-- SECTION 8: MIGRATION HISTORY (deve listar todas as 20 migrations Phase A-C)
-- ---------------------------------------------------------------------------
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260514%'
ORDER BY version;
-- esperado: 20 rows (timestamps 20260514120000 → 20260514121900)

-- ============================================================================
-- FIM DO VERIFY READ-ONLY
-- Para teste end-to-end com inserts (transacional, sempre ROLLBACK):
--   abra `verify_07_full_insert_flow.sql` e cole no SQL Editor.
-- ============================================================================
