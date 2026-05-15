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
