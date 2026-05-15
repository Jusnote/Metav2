-- Smoke test: cenário minimal pra gerar_cronograma_v2
-- Adapt: INSERT subtopicos uses 'estimated_duration_minutes' (not 'duracao_minutos')
-- SELECT de schedule_items/weekly_stats usa colunas reais (Phase B2 divergences applied)
-- Não executar automaticamente — rodar no Supabase Studio, aguardar ROLLBACK final.
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

  -- Note: column is 'estimated_duration_minutes' (plan said 'duracao_minutos' — corrected here)
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
  -- Expected: 4 items (2 teoria + 2 questoes for 2 subtopicos)
  SELECT 'items_created' AS check, COUNT(*) AS actual, 4 AS expected
    FROM schedule_items WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  -- Expected: 2 weekly_stats rows (1 per week, total_semanas=2)
  -- Note: weekly_stats has no user_id/week_start/week_end — PK is (plano_id, week_number)
  SELECT 'weekly_stats_rows', COUNT(*), 2
    FROM weekly_stats WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  -- Expected: 1 plan_decisions row
  SELECT 'plan_decisions_rows', COUNT(*), 1
    FROM plan_decisions WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  -- Expected: 2 distinct types (estudo_inicial_p1, estudo_inicial_p2)
  SELECT 'teoria_e_questoes', COUNT(DISTINCT type), 2
    FROM schedule_items WHERE plano_id = '00000000-0000-0000-0000-000000001001';

  -- Spot-check: schedule_items uses 'estimated_duration_minutes' (real column name)
  SELECT 'col_estimated_duration_minutes_exists',
         COUNT(*) AS actual, 4 AS expected
    FROM schedule_items
   WHERE plano_id = '00000000-0000-0000-0000-000000001001'
     AND estimated_duration_minutes IS NOT NULL;

  -- Spot-check: weekly_stats uses 'minutes_estimated' (real column name, not 'minutes_total')
  SELECT 'weekly_stats_minutes_estimated_nonzero',
         COUNT(*) AS actual, 2 AS expected
    FROM weekly_stats
   WHERE plano_id = '00000000-0000-0000-0000-000000001001'
     AND minutes_estimated > 0;
ROLLBACK;
