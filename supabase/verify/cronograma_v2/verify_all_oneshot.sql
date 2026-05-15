-- ============================================================================
-- VERIFY ALL — Cronograma V2 Schema (one-shot)
-- ============================================================================
-- Retorna UMA tabela com PASS/FAIL por check. Cole no Supabase Studio
-- SQL Editor e rode tudo de uma vez — você vê todos os resultados.
-- ============================================================================

WITH checks AS (
  -- Section 1: enums
  SELECT 1 AS seq, 'enum: nivel_conhecimento_enum'      AS check_name,
         (SELECT COUNT(*)::INT FROM pg_type WHERE typname = 'nivel_conhecimento_enum') AS actual, 1 AS expected
  UNION ALL SELECT 2, 'enum: simulados_freq_enum',
         (SELECT COUNT(*)::INT FROM pg_type WHERE typname = 'simulados_freq_enum'), 1
  UNION ALL SELECT 3, 'enum: tipo_material_enum',
         (SELECT COUNT(*)::INT FROM pg_type WHERE typname = 'tipo_material_enum'), 1
  UNION ALL SELECT 4, 'enum: horario_preferido_enum',
         (SELECT COUNT(*)::INT FROM pg_type WHERE typname = 'horario_preferido_enum'), 1
  UNION ALL SELECT 5, 'enum: plan_template_visibility',
         (SELECT COUNT(*)::INT FROM pg_type WHERE typname = 'plan_template_visibility'), 1
  UNION ALL SELECT 6, 'enum value: plano_status has rascunho',
         (SELECT CASE WHEN 'rascunho' = ANY(enum_range(NULL::plano_status)::TEXT[]) THEN 1 ELSE 0 END), 1

  -- Section 2: novas tabelas (14)
  UNION ALL SELECT 10, 'tables: 14 new tables exist',
         (SELECT COUNT(*)::INT FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
           'plan_decisions','behavioral_signals','edital_cache','plano_predictions_history',
           'plan_events','dead_letters','plano_config_history','feriados_nacionais',
           'plan_templates','graphql_cache','analytics_events','rate_limit_buckets',
           'feature_flags','ai_quality_feedback'
         )), 14
  UNION ALL SELECT 11, 'view: plano_predictions',
         (SELECT COUNT(*)::INT FROM pg_views WHERE viewname = 'plano_predictions'), 1
  UNION ALL SELECT 12, 'sequence: plan_events_seq',
         (SELECT COUNT(*)::INT FROM pg_class WHERE relkind = 'S' AND relname = 'plan_events_seq'), 1

  -- Section 3: partições
  UNION ALL SELECT 20, 'partitions: plan_decisions (3 expected)',
         (SELECT COUNT(*)::INT FROM pg_inherits i
          JOIN pg_class p ON i.inhparent = p.oid WHERE p.relname = 'plan_decisions'), 3
  UNION ALL SELECT 21, 'partitions: behavioral_signals (3 expected)',
         (SELECT COUNT(*)::INT FROM pg_inherits i
          JOIN pg_class p ON i.inhparent = p.oid WHERE p.relname = 'behavioral_signals'), 3
  UNION ALL SELECT 22, 'partitions: plan_events (3 expected)',
         (SELECT COUNT(*)::INT FROM pg_inherits i
          JOIN pg_class p ON i.inhparent = p.oid WHERE p.relname = 'plan_events'), 3

  -- Section 4: 21 colunas novas em tabelas V1
  UNION ALL SELECT 30, 'columns: planos_estudo (cargo_snapshot/template_id/algorithm_variant/deleted_at)',
         (SELECT COUNT(*)::INT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='planos_estudo'
          AND column_name IN ('cargo_snapshot','template_id','algorithm_variant','deleted_at')), 4
  UNION ALL SELECT 31, 'columns: plano_config (simulados/redacao/material/horario)',
         (SELECT COUNT(*)::INT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='plano_config'
          AND column_name IN ('simulados_freq','incluir_redacao','tipo_material','horario_preferido')), 4
  UNION ALL SELECT 32, 'columns: plano_disciplinas (nivel/ponto_fraco/excluded)',
         (SELECT COUNT(*)::INT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='plano_disciplinas'
          AND column_name IN ('nivel','ponto_fraco','excluded_subtopico_ids')), 3
  UNION ALL SELECT 33, 'columns: schedule_items (FSRS/anticipated/parent/version)',
         (SELECT COUNT(*)::INT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='schedule_items'
          AND column_name IN ('anticipated_at','fsrs_state','fsrs_data','parent_item_id','version')), 5
  UNION ALL SELECT 34, 'columns: topicos (referencias/nome_curto/ai_decomposed)',
         (SELECT COUNT(*)::INT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='topicos'
          AND column_name IN ('referencias_legais','nome_curto','ai_decomposed_at')), 3
  UNION ALL SELECT 35, 'columns: weekly_stats (unlocked_early/overflow)',
         (SELECT COUNT(*)::INT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='weekly_stats'
          AND column_name IN ('unlocked_early','overflow_count')), 2

  -- Section 5: triggers + functions
  UNION ALL SELECT 40, 'triggers: 3 expected',
         (SELECT COUNT(*)::INT FROM information_schema.triggers
          WHERE trigger_name IN ('trg_publish_completion_event','trg_publish_week_completed','trg_increment_version')), 3
  UNION ALL SELECT 41, 'functions: 4 expected (3 trg + is_feature_enabled)',
         (SELECT COUNT(*)::INT FROM pg_proc
          WHERE proname IN ('fn_publish_completion_event','fn_publish_week_completed',
                            'fn_increment_schedule_item_version','is_feature_enabled')), 4

  -- Section 6: RLS
  UNION ALL SELECT 50, 'RLS: 14 tables with rowsecurity=true',
         (SELECT COUNT(*)::INT FROM pg_tables WHERE schemaname='public' AND rowsecurity=TRUE
          AND tablename IN (
            'plan_decisions','behavioral_signals','edital_cache','plano_predictions_history',
            'plan_events','dead_letters','plano_config_history','feriados_nacionais',
            'plan_templates','graphql_cache','analytics_events','rate_limit_buckets',
            'feature_flags','ai_quality_feedback'
          )), 14
  UNION ALL SELECT 51, 'RLS policies: at least 13 (1+ per protected table)',
         (SELECT COUNT(DISTINCT tablename)::INT FROM pg_policies WHERE schemaname='public'
          AND tablename IN (
            'plan_decisions','behavioral_signals','edital_cache','plano_predictions_history',
            'plan_events','dead_letters','plano_config_history','feriados_nacionais',
            'plan_templates','graphql_cache','analytics_events','feature_flags','ai_quality_feedback'
          )), 13

  -- Section 7: seed feriados
  UNION ALL SELECT 60, 'seed: 39 feriados nacionais',
         (SELECT COUNT(*)::INT FROM feriados_nacionais), 39
  UNION ALL SELECT 61, 'seed: Independência 2026-09-07 present',
         (SELECT COUNT(*)::INT FROM feriados_nacionais WHERE data = '2026-09-07'), 1

  -- Section 8: migration history
  UNION ALL SELECT 70, 'migrations: 20 V2 migrations recorded',
         (SELECT COUNT(*)::INT FROM supabase_migrations.schema_migrations
          WHERE version LIKE '20260514%'), 20
)
SELECT
  seq,
  check_name,
  actual,
  expected,
  CASE WHEN actual = expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks
ORDER BY seq;
