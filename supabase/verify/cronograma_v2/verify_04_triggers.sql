-- Triggers existem
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table IN ('schedule_items', 'weekly_stats')
  AND trigger_name IN ('trg_publish_completion_event', 'trg_publish_week_completed', 'trg_increment_version')
ORDER BY trigger_name;
-- esperado: 3 rows

-- Funções existem
SELECT proname FROM pg_proc
WHERE proname IN ('fn_publish_completion_event', 'fn_publish_week_completed', 'fn_increment_schedule_item_version')
ORDER BY proname;
-- esperado: 3 rows

-- Smoke test: simular completion
BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@verify.local', '', NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO planos_estudo (id, user_id, nome, data_inicio, data_prova, mode, status)
  VALUES ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-000000000001',
          'Test', CURRENT_DATE, CURRENT_DATE + 60, 'continuo', 'ativo');
  INSERT INTO schedule_items (id, user_id, plano_id, scheduled_date, type, status, title)
  VALUES ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-0000000000ee', CURRENT_DATE, 'estudo_inicial_p1', 'pendente', 'Test item');

  -- Update status; trigger deve publicar evento
  UPDATE schedule_items SET status = 'concluido', completed_at = NOW()
  WHERE id = '00000000-0000-0000-0000-0000000000ff';

  SELECT event_type, payload->>'item_id' AS item_id FROM plan_events
  WHERE plano_id = '00000000-0000-0000-0000-0000000000ee';
  -- esperado: 1 row, event_type='item.completed'

  SELECT version FROM schedule_items WHERE id = '00000000-0000-0000-0000-0000000000ff';
  -- esperado: 2 (era 1, incrementou)
ROLLBACK;
