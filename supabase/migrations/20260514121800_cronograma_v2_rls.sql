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
