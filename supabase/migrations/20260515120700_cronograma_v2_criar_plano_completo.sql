-- UP: criar_plano_completo (orquestrador atômico)
-- DOWN: DROP FUNCTION criar_plano_completo
--
-- Schema columns confirmed present before applying:
--   planos_estudo: cargo_snapshot, template_id, algorithm_variant (20260514121100)
--   plano_config: simulados_freq, tem_redacao, tipo_material, horario_preferido (20260514121200)
--   plano_disciplinas: nivel_conhecimento, is_ponto_fraco, excluded_subtopico_ids (20260514121300)
--   plano_config_history: id, plano_id, version, snapshot (20260514120700)
--   plano_predictions_history: plano_id, coverage_pct, slack_weeks, pace_index,
--                              weakest_disciplinas, recommendations (20260514120400)

CREATE OR REPLACE FUNCTION criar_plano_completo(
  p_user_id                 UUID,
  p_cargo_id                INTEGER,
  p_cargo_snapshot          JSONB,
  p_data_inicio             DATE,
  p_data_prova              DATE,
  p_weekday_minutes         INTEGER,
  p_weekend_minutes         INTEGER,
  p_block_duration_minutes  INTEGER,
  p_mix_ratio               JSONB,
  p_simulados_freq          TEXT,
  p_tem_redacao             BOOLEAN,
  p_tipo_material           TEXT,
  p_horario_preferido       TEXT,
  p_disciplinas             JSONB,
  p_template_id             UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plano_id    UUID;
  v_d           JSONB;
  v_gerar_res   JSONB;
BEGIN
  -- 1. Validações
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id obrigatório' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_data_prova <= p_data_inicio THEN
    RAISE EXCEPTION 'data_prova deve ser > data_inicio' USING ERRCODE = '22023';
  END IF;
  IF calcular_total_semanas(p_data_inicio, p_data_prova) < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas' USING ERRCODE = 'P0001';
  END IF;
  IF p_weekday_minutes < 30 OR p_weekend_minutes < 0 THEN
    RAISE EXCEPTION 'Capacidade diária inválida' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_disciplinas) != 'array' OR jsonb_array_length(p_disciplinas) = 0 THEN
    RAISE EXCEPTION 'p_disciplinas deve ser array não vazio' USING ERRCODE = '22023';
  END IF;

  -- Limite de pontos fracos: max 3
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_disciplinas) d
      WHERE (d->>'is_ponto_fraco')::BOOLEAN = TRUE) > 3 THEN
    RAISE EXCEPTION 'Máximo 3 disciplinas como ponto fraco' USING ERRCODE = '22023';
  END IF;

  -- 2. Insert plano
  INSERT INTO planos_estudo (
    id, user_id, nome, data_inicio, data_prova, mode, status,
    cargo_snapshot, template_id, algorithm_variant
  ) VALUES (
    gen_random_uuid(), p_user_id,
    COALESCE(p_cargo_snapshot->>'nome', 'Plano'),
    p_data_inicio, p_data_prova, 'edital', 'ativo',
    p_cargo_snapshot, p_template_id, 'v2_default'
  ) RETURNING id INTO v_plano_id;

  -- 3. Insert config + history snapshot
  INSERT INTO plano_config (
    plano_id, weekday_minutes, weekend_minutes, block_duration_minutes,
    mix_ratio, simulados_freq, tem_redacao, tipo_material, horario_preferido
  ) VALUES (
    v_plano_id, p_weekday_minutes, p_weekend_minutes, p_block_duration_minutes,
    p_mix_ratio, p_simulados_freq::simulados_freq_enum, p_tem_redacao,
    p_tipo_material::tipo_material_enum, p_horario_preferido::horario_preferido_enum
  );

  INSERT INTO plano_config_history (plano_id, version, snapshot)
  VALUES (v_plano_id, 1, jsonb_build_object(
    'weekday_minutes', p_weekday_minutes,
    'weekend_minutes', p_weekend_minutes,
    'mix_ratio', p_mix_ratio,
    'simulados_freq', p_simulados_freq,
    'tem_redacao', p_tem_redacao
  ));

  -- 4. Insert disciplinas (1 por elemento do JSONB)
  FOR v_d IN SELECT * FROM jsonb_array_elements(p_disciplinas)
  LOOP
    INSERT INTO plano_disciplinas (
      plano_id, disciplina_id, peso, nivel_conhecimento,
      is_ponto_fraco, excluded_subtopico_ids
    ) VALUES (
      v_plano_id,
      (v_d->>'disciplina_id')::UUID,
      COALESCE((v_d->>'peso')::NUMERIC, 1.0),
      COALESCE((v_d->>'nivel_conhecimento')::nivel_conhecimento_enum, 'intermediario'),
      COALESCE((v_d->>'is_ponto_fraco')::BOOLEAN, FALSE),
      COALESCE(
        ARRAY(SELECT (e #>> '{}')::UUID FROM jsonb_array_elements(v_d->'excluded_subtopico_ids') e),
        '{}'::UUID[]
      )
    );
  END LOOP;

  -- 5. Chama gerar_cronograma_v2 (inline na mesma transação)
  v_gerar_res := gerar_cronograma_v2(v_plano_id);

  -- 6. Predição inicial — coverage_pct baseado em overflow
  INSERT INTO plano_predictions_history (
    plano_id, coverage_pct, slack_weeks, pace_index, weakest_disciplinas, recommendations
  ) VALUES (
    v_plano_id,
    CASE
      WHEN (v_gerar_res->>'overflow_weeks')::INTEGER = 0 THEN 100.0
      ELSE GREATEST(0, 100 - (v_gerar_res->>'overflow_weeks')::INTEGER * 5)
    END,
    NULL, 1.0,
    '[]'::JSONB,
    CASE
      WHEN (v_gerar_res->>'overflow_weeks')::INTEGER > 0 THEN
        '[{"code":"capacity_overflow","msg":"Reduza disciplinas ou aumente capacidade"}]'::JSONB
      ELSE '[]'::JSONB
    END
  );

  -- 7. Return
  RETURN jsonb_build_object(
    'plano_id',       v_plano_id,
    'items_created',  v_gerar_res->'items_created',
    'overflow_weeks', v_gerar_res->'overflow_weeks',
    'warnings',       v_gerar_res->'warnings'
  );
END $$;

COMMENT ON FUNCTION criar_plano_completo IS
  'Orquestrador atômico do setup. Cria plano + config + disciplinas + chama gerar_cronograma_v2 + grava predição inicial. Spec 7.5.';
