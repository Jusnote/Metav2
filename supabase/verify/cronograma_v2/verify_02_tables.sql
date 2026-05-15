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

-- ============================================================================
-- Task 3: behavioral_signals
-- ============================================================================

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

-- ============================================================================
-- Task 4: edital_cache
-- ============================================================================

-- edital_cache
SELECT tablename FROM pg_tables WHERE tablename = 'edital_cache';
SELECT indexname FROM pg_indexes WHERE tablename = 'edital_cache';

BEGIN;
  INSERT INTO edital_cache (cargo_id, edital_id, payload_hash, decomposicao, ai_model)
  VALUES (1, 1, 'abc123', '{"disciplinas":[]}'::JSONB, 'claude-haiku-4.5');

  SELECT COUNT(*) FROM edital_cache;  -- esperado: 1
ROLLBACK;

-- ============================================================================
-- Task 5: plano_predictions_history + view plano_predictions
-- ============================================================================

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

-- ============================================================================
-- Task 6: plan_events
-- ============================================================================

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

-- ============================================================================
-- Task 7: dead_letters
-- ============================================================================

-- dead_letters
SELECT tablename FROM pg_tables WHERE tablename = 'dead_letters';
SELECT indexname FROM pg_indexes WHERE tablename = 'dead_letters';

BEGIN;
  INSERT INTO dead_letters (event_type, payload, error_message, attempts, first_failed_at, last_failed_at)
  VALUES ('item.completed', '{"foo":"bar"}'::JSONB, 'timeout', 3, NOW(), NOW());
  SELECT COUNT(*) FROM dead_letters;  -- esperado: 1
ROLLBACK;

-- ============================================================================
-- Task 8: plano_config_history
-- ============================================================================

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

-- ============================================================================
-- Task 9: feriados_nacionais
-- ============================================================================

-- feriados_nacionais
SELECT tablename FROM pg_tables WHERE tablename = 'feriados_nacionais';

BEGIN;
  INSERT INTO feriados_nacionais (data, nome, tipo)
  VALUES ('2026-09-07', 'Independência do Brasil', 'nacional');
  SELECT COUNT(*) FROM feriados_nacionais;  -- esperado: 1
ROLLBACK;

-- ============================================================================
-- Task 10: plan_templates
-- ============================================================================

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
