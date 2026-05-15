-- Cenários de teste para criar_plano_completo (atomic orchestrator)
-- 3 cenários: sucesso + 2 caminhos de erro
-- Não executar automaticamente — rodar no Supabase Studio.
-- Adapt: INSERT subtopicos uses 'estimated_duration_minutes' (real column name, not 'duracao_minutos')

-- ============================================================================
-- Cenário 1: sucesso — plano + 1 disciplina + 2 subtópicos → 4 items
-- ============================================================================
BEGIN;
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('00000000-0000-0000-0000-000000000a02', 'test-criar@verify.local', '',
    NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO disciplinas (id, nome) VALUES
    ('00000000-0000-0000-0000-000000000b02', 'Direito Penal (test)')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO topicos (id, disciplina_id, nome) VALUES
    ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000b02', 'Teoria do Crime')
  ON CONFLICT (id) DO NOTHING;

  -- Note: column is 'estimated_duration_minutes' (plan said 'duracao_minutos' — corrected here)
  INSERT INTO subtopicos (id, topico_id, nome, estimated_duration_minutes) VALUES
    ('00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000c02', 'Tipicidade', 50),
    ('00000000-0000-0000-0000-000000000d12', '00000000-0000-0000-0000-000000000c02', 'Ilicitude', 45)
  ON CONFLICT (id) DO NOTHING;

  SELECT criar_plano_completo(
    p_user_id => '00000000-0000-0000-0000-000000000a02',
    p_cargo_id => 1,
    p_cargo_snapshot => '{"nome":"Test","qtd_disciplinas":1}'::JSONB,
    p_data_inicio => '2026-05-15',
    p_data_prova => '2026-05-29',
    p_weekday_minutes => 180,
    p_weekend_minutes => 240,
    p_block_duration_minutes => 50,
    p_mix_ratio => '{"teoria":0.5,"questoes":0.5}'::JSONB,
    p_simulados_freq => 'nenhum',
    p_tem_redacao => FALSE,
    p_tipo_material => 'misto',
    p_horario_preferido => 'flexivel',
    p_disciplinas => '[{"disciplina_id":"00000000-0000-0000-0000-000000000b02","nivel_conhecimento":"intermediario","is_ponto_fraco":false}]'::JSONB
  ) AS result;

  -- Confere 4 items (2 teoria + 2 questoes para 2 subtópicos)
  SELECT COUNT(*) AS items FROM schedule_items
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02');
  -- esperado: 4

  -- Confere 1 prediction row
  SELECT COUNT(*) AS preds FROM plano_predictions_history
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02');
  -- esperado: 1

  -- Confere 1 config row
  SELECT COUNT(*) AS configs FROM plano_config
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02');
  -- esperado: 1

  -- Confere 1 plano_disciplinas row
  SELECT COUNT(*) AS discs FROM plano_disciplinas
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02');
  -- esperado: 1

  -- Confere 1 config_history row (version=1)
  SELECT COUNT(*) AS hist FROM plano_config_history
   WHERE plano_id = (SELECT id FROM planos_estudo WHERE user_id='00000000-0000-0000-0000-000000000a02')
     AND version = 1;
  -- esperado: 1
ROLLBACK;

-- ============================================================================
-- Cenário 2: erro de data → rollback completo (nenhuma row residual)
-- ============================================================================
BEGIN;
  -- Tentativa com data_prova antes de data_inicio → deve lançar ERRCODE 22023
  SELECT criar_plano_completo(
    p_user_id => '00000000-0000-0000-0000-000000000a02',
    p_cargo_id => 1,
    p_cargo_snapshot => '{}'::JSONB,
    p_data_inicio => '2026-05-15',
    p_data_prova => '2026-05-10',  -- ERRO: prova antes de inicio
    p_weekday_minutes => 180,
    p_weekend_minutes => 240,
    p_block_duration_minutes => 50,
    p_mix_ratio => '{}'::JSONB,
    p_simulados_freq => 'nenhum',
    p_tem_redacao => FALSE,
    p_tipo_material => 'misto',
    p_horario_preferido => 'flexivel',
    p_disciplinas => '[{"disciplina_id":"00000000-0000-0000-0000-000000000b02"}]'::JSONB
  );
  -- ↑ esperado: ERROR 22023 "data_prova deve ser > data_inicio"
  -- A transação inteira deve abortar; nenhuma row em planos_estudo, plano_config etc.

  -- Este SELECT não deve executar (erro acima abortou):
  SELECT COUNT(*) AS should_be_0 FROM planos_estudo
   WHERE user_id = '00000000-0000-0000-0000-000000000a02';
ROLLBACK;

-- ============================================================================
-- Cenário 3: 4 pontos fracos → erro de validação (máximo 3)
-- ============================================================================
BEGIN;
  SELECT criar_plano_completo(
    p_user_id => '00000000-0000-0000-0000-000000000a02',
    p_cargo_id => 1,
    p_cargo_snapshot => '{}'::JSONB,
    p_data_inicio => '2026-05-15',
    p_data_prova => '2026-08-15',
    p_weekday_minutes => 180,
    p_weekend_minutes => 240,
    p_block_duration_minutes => 50,
    p_mix_ratio => '{}'::JSONB,
    p_simulados_freq => 'nenhum',
    p_tem_redacao => FALSE,
    p_tipo_material => 'misto',
    p_horario_preferido => 'flexivel',
    p_disciplinas => '[
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true},
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true},
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true},
      {"disciplina_id":"00000000-0000-0000-0000-000000000b02","is_ponto_fraco":true}
    ]'::JSONB
  );
  -- ↑ esperado: ERROR 22023 "Máximo 3 disciplinas como ponto fraco"
ROLLBACK;
