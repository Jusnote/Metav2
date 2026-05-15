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
