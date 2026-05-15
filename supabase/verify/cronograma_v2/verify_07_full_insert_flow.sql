-- Simula fluxo completo: criar plano → config → disciplinas → schedule_items → atualizações
-- Tudo dentro de BEGIN/ROLLBACK pra não sujar o banco

BEGIN;

  -- 1. User fake
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000999', 'integration@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Plano com cargo_snapshot e novos campos
  INSERT INTO planos_estudo (
    id, user_id, nome, data_inicio, data_prova, mode, status,
    cargo_snapshot, algorithm_variant
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000999',
    'Integration Test',
    CURRENT_DATE,
    CURRENT_DATE + 90,
    'continuo',
    'ativo',
    '{"cargo_id": 1, "nome": "Test Cargo", "edital_id": 1, "qtd_disciplinas": 10, "captured_at": "2026-05-14T10:00:00Z"}'::JSONB,
    'v2_default'
  );

  -- 3. plano_config com novos campos
  INSERT INTO plano_config (
    plano_id, weekday_minutes, weekend_minutes, mix_ratio,
    simulados_freq, tem_redacao, tipo_material, horario_preferido
  ) VALUES (
    '11111111-1111-1111-1111-111111111111', 180, 240,
    '{"teoria": 0.4, "questoes": 0.4, "revisao": 0.15, "flashcards": 0.05}'::JSONB,
    'quinzenal', FALSE, 'misto', 'manha'
  );

  -- 4. plano_config_history versão 1
  INSERT INTO plano_config_history (plano_id, version, snapshot)
  VALUES ('11111111-1111-1111-1111-111111111111', 1, '{"weekday_minutes": 180}'::JSONB);

  -- 5. Disciplina + plano_disciplina com nivel e ponto_fraco
  INSERT INTO disciplinas (id, nome, user_id)
  VALUES ('22222222-2222-2222-2222-222222222222', 'Test Discipline', '00000000-0000-0000-0000-000000000999')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO plano_disciplinas (
    plano_id, disciplina_id, peso, prioridade,
    nivel_conhecimento, is_ponto_fraco, excluded_subtopico_ids
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    1.5, 'alta',
    'iniciante', TRUE, '{}'
  );

  -- 6. schedule_item com FSRS fields
  INSERT INTO schedule_items (
    id, user_id, plano_id, scheduled_date, type, status, title,
    is_anticipated, fsrs_due_date, version
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000999',
    '11111111-1111-1111-1111-111111111111',
    CURRENT_DATE, 'estudo_inicial_p1', 'pendente', 'Test item',
    FALSE, NULL, 1
  );

  -- 7. UPDATE pra trigger publicar event
  UPDATE schedule_items SET status = 'concluido', completed_at = NOW()
  WHERE id = '33333333-3333-3333-3333-333333333333';

  -- Verificações
  SELECT 'plano' AS check, COUNT(*) FROM planos_estudo WHERE id = '11111111-1111-1111-1111-111111111111';
  SELECT 'config' AS check, COUNT(*) FROM plano_config WHERE plano_id = '11111111-1111-1111-1111-111111111111';
  SELECT 'history' AS check, COUNT(*) FROM plano_config_history WHERE plano_id = '11111111-1111-1111-1111-111111111111';
  SELECT 'disciplina' AS check, COUNT(*) FROM plano_disciplinas WHERE plano_id = '11111111-1111-1111-1111-111111111111';
  SELECT 'item' AS check, version FROM schedule_items WHERE id = '33333333-3333-3333-3333-333333333333';
  SELECT 'event' AS check, event_type FROM plan_events WHERE plano_id = '11111111-1111-1111-1111-111111111111';

  -- 8. plan_decision smoke
  INSERT INTO plan_decisions (
    plano_id, week_number, action, reason, output_summary, triggered_by
  ) VALUES (
    '11111111-1111-1111-1111-111111111111', 1, 'initial_distribution',
    'absorption_phase', '{"items_created": 1}'::JSONB, 'rpc_initial'
  );
  SELECT 'decision' AS check, COUNT(*) FROM plan_decisions WHERE plano_id = '11111111-1111-1111-1111-111111111111';

  -- 9. prediction smoke
  INSERT INTO plano_predictions_history (plano_id, coverage_pct, slack_weeks, pace_index)
  VALUES ('11111111-1111-1111-1111-111111111111', 95.0, 2.0, 1.0);
  SELECT 'prediction' AS check, coverage_pct FROM plano_predictions
  WHERE plano_id = '11111111-1111-1111-1111-111111111111';

ROLLBACK;

SELECT 'Integration test completed' AS final_status;
