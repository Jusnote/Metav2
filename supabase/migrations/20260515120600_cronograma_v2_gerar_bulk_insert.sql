-- UP: finalize gerar_cronograma_v2 com bulk insert + weekly_stats + plan_decisions
-- DOWN: rever pra versão da Task 7
--
-- Schema divergences from plan, corrected here:
--   - schedule_items uses 'estimated_duration_minutes' (not 'duracao_minutos')
--   - weekly_stats has no user_id/week_start/week_end/minutes_total/minutes_completed;
--     uses 'minutes_estimated' instead of 'minutes_total'; PK is (plano_id, week_number)
--   - ON CONFLICT (plano_id, week_number) targets the PK — valid

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id           UUID;
  v_total_semanas     INTEGER;
  v_n_blocks          INTEGER;
  v_blocks_per_week   NUMERIC;
  v_simulados_freq    simulados_freq_enum;
  v_tem_redacao       BOOLEAN;
  v_simulado_interval INTEGER;
  v_items_created     INTEGER := 0;
  v_overflow_weeks    INTEGER := 0;
  v_warnings          JSONB := '[]'::JSONB;
  v_result            JSONB;
BEGIN
  -- 1. Carrega contexto via procedure (popula TEMP tables)
  CALL _v2_carrega_contexto(p_plano_uuid);

  -- 2. Validações
  SELECT user_id, total_semanas FROM _ctx_plano INTO v_user_id, v_total_semanas;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plano_uuid USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', p_plano_uuid USING ERRCODE = '42501';
  END IF;
  IF v_total_semanas < 2 THEN
    RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas (total_semanas=%)', v_total_semanas
      USING ERRCODE = 'P0001';
  END IF;

  SELECT simulados_freq, tem_redacao FROM _ctx_config INTO v_simulados_freq, v_tem_redacao;

  -- 3. Geração de blocks (Task 5 inlinado)
  CREATE TEMP TABLE IF NOT EXISTS _ctx_blocks ON COMMIT DROP AS
  WITH teoria AS (
    SELECT subtopico_id, topico_id, disciplina_id, disciplina_peso,
           'estudo_inicial_p1'::schedule_item_type AS tipo,
           duracao_ajustada AS minutos, nome AS title, 1 AS ordem
    FROM _ctx_subtopicos
  ),
  questoes AS (
    SELECT subtopico_id, topico_id, disciplina_id, disciplina_peso,
           'estudo_inicial_p2'::schedule_item_type AS tipo,
           GREATEST(20, CEIL(duracao_ajustada * 0.5)::INTEGER) AS minutos,
           nome AS title, 2 AS ordem
    FROM _ctx_subtopicos
  )
  SELECT * FROM teoria UNION ALL SELECT * FROM questoes;

  SELECT COUNT(*) FROM _ctx_blocks INTO v_n_blocks;
  IF v_n_blocks = 0 THEN
    RETURN jsonb_build_object('status', 'no_subtopics', 'items_created', 0);
  END IF;

  v_blocks_per_week := v_n_blocks::NUMERIC / v_total_semanas;

  -- 4. Distribuição balanceada (Task 6 inlinado)
  CREATE TEMP TABLE IF NOT EXISTS _ctx_assigned ON COMMIT DROP AS
  WITH numbered AS (
    SELECT b.*,
           ROW_NUMBER() OVER (
             PARTITION BY b.disciplina_id, b.ordem
             ORDER BY b.subtopico_id
           ) AS pos_in_disc_ordem,
           ROW_NUMBER() OVER (ORDER BY b.ordem, b.disciplina_id, b.subtopico_id) AS global_seq
    FROM _ctx_blocks b
  )
  SELECT
    n.*,
    LEAST(v_total_semanas, GREATEST(1, CEIL(n.global_seq::NUMERIC / v_blocks_per_week)::INTEGER)) AS week_number,
    NULL::UUID AS subtopico_ref
  FROM numbered n;

  -- 5. Simulados: aloca 1 a cada N semanas (Task 7 inlinado)
  v_simulado_interval := CASE v_simulados_freq
    WHEN 'nenhum'    THEN NULL
    WHEN 'mensal'    THEN 4
    WHEN 'quinzenal' THEN 2
    WHEN 'semanal'   THEN 1
  END;

  IF v_simulado_interval IS NOT NULL THEN
    INSERT INTO _ctx_assigned (
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      tipo, minutos, title, ordem, pos_in_disc_ordem, global_seq, week_number, subtopico_ref
    )
    SELECT
      NULL, NULL, NULL, NULL,
      'simulado'::schedule_item_type,
      180,
      'Simulado periódico — semana ' || s,
      99,
      NULL,
      NULL,
      s AS week_number,
      NULL
    FROM generate_series(v_simulado_interval, v_total_semanas, v_simulado_interval) s;
  END IF;

  -- 6. Redação: 1 bloco de 60min por semana (Task 7 inlinado)
  IF v_tem_redacao THEN
    INSERT INTO _ctx_assigned (
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      tipo, minutos, title, ordem, pos_in_disc_ordem, global_seq, week_number, subtopico_ref
    )
    SELECT
      NULL, NULL, NULL, NULL,
      'redacao'::schedule_item_type,
      60,
      'Redação — semana ' || s,
      98,
      NULL,
      NULL,
      s AS week_number,
      NULL
    FROM generate_series(1, v_total_semanas) s;
  END IF;

  -- 7. Bulk insert em schedule_items
  -- Note: column is 'estimated_duration_minutes' (not 'duracao_minutos' as in plan)
  -- subtopico_id and topico_id are nullable (YES) — simulado/redacao rows pass NULL safely
  INSERT INTO schedule_items (
    id, user_id, plano_id, week_number, type, status, title,
    estimated_duration_minutes, subtopico_id, topico_id, scheduled_date, version
  )
  SELECT
    gen_random_uuid(),
    v_user_id,
    p_plano_uuid,
    a.week_number,
    a.tipo,
    'pendente',
    a.title,
    a.minutos,
    a.subtopico_id,
    a.topico_id,
    -- scheduled_date = início da semana
    (SELECT data_inicio FROM _ctx_plano) + ((a.week_number - 1) * 7)::INTEGER,
    1
  FROM _ctx_assigned a;

  GET DIAGNOSTICS v_items_created = ROW_COUNT;

  -- 8. Popular weekly_stats (1 row por semana)
  -- Note: weekly_stats has no user_id/week_start/week_end/minutes_total/minutes_completed.
  --       Column is 'minutes_estimated'. PK is (plano_id, week_number) — ON CONFLICT targets PK.
  INSERT INTO weekly_stats (
    plano_id, week_number,
    items_total, items_completed, items_overdue, items_skipped,
    minutes_estimated, minutes_actual,
    questoes_total, questoes_correct,
    completion_pct, unlocked_early, overflow
  )
  SELECT
    p_plano_uuid,
    s.week_number,
    COALESCE(stats.cnt, 0),
    0,
    0,
    0,
    COALESCE(stats.mins, 0),
    0,
    0,
    0,
    0.0,
    FALSE,
    -- Overflow se total da semana > capacidade total da semana
    COALESCE(stats.mins, 0) > (
      SELECT SUM(capacidade_dia(
        s.week_start + dd::INTEGER,
        (SELECT weekday_minutes FROM _ctx_config),
        (SELECT weekend_minutes FROM _ctx_config),
        COALESCE((SELECT daily_exceptions FROM _ctx_config), '{}'::JSONB)
      ))
      FROM generate_series(0, 6) dd
    )
  FROM _ctx_semanas s
  LEFT JOIN (
    SELECT week_number, COUNT(*) AS cnt, SUM(minutos) AS mins
    FROM _ctx_assigned
    GROUP BY week_number
  ) stats USING (week_number)
  ON CONFLICT (plano_id, week_number) DO UPDATE SET
    items_total       = EXCLUDED.items_total,
    minutes_estimated = EXCLUDED.minutes_estimated,
    overflow          = EXCLUDED.overflow;

  SELECT COUNT(*) FROM weekly_stats
    WHERE plano_id = p_plano_uuid AND overflow = TRUE
    INTO v_overflow_weeks;

  IF v_overflow_weeks > 0 THEN
    v_warnings := v_warnings || jsonb_build_object(
      'warning', 'capacity_overflow',
      'weeks', v_overflow_weeks,
      'msg', format('%s semanas excedem a capacidade configurada', v_overflow_weeks)
    );
  END IF;

  -- 9. Log em plan_decisions
  INSERT INTO plan_decisions (plano_id, action, reason, output_summary, algorithm_variant, triggered_by)
  VALUES (
    p_plano_uuid,
    'initial_distribution',
    'gerar_cronograma_v2',
    jsonb_build_object(
      'items_created',   v_items_created,
      'overflow_weeks',  v_overflow_weeks,
      'total_semanas',   v_total_semanas
    ),
    'v2_default',
    'rpc_initial'
  );

  v_result := jsonb_build_object(
    'status',          'completed',
    'plano_id',        p_plano_uuid,
    'items_created',   v_items_created,
    'overflow_weeks',  v_overflow_weeks,
    'total_semanas',   v_total_semanas,
    'warnings',        v_warnings
  );

  RETURN v_result;
END $$;

COMMENT ON FUNCTION gerar_cronograma_v2 IS
  'Gera schedule_items para um plano, distribuindo balanceadamente por semana, respeitando nível, pontos fracos, feriados e mix configurado. Sub-plan 2 / spec 6.';
