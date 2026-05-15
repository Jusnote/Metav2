-- UP: extende gerar_cronograma_v2 com simulados + redação
-- DOWN: rever pra versão da Task 6

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
  v_simulado_interval INTEGER;  -- a cada N semanas
  v_simulados_count   INTEGER := 0;
  v_redacao_count     INTEGER := 0;
  v_warnings          JSONB := '[]'::JSONB;
  v_result            JSONB;
BEGIN
  CALL _v2_carrega_contexto(p_plano_uuid);

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

  SELECT simulados_freq, tem_redacao FROM _ctx_config
    INTO v_simulados_freq, v_tem_redacao;

  -- Geração de blocks (Task 5 inlinado)
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
  IF v_n_blocks = 0 THEN RETURN jsonb_build_object('status', 'no_subtopics', 'items_created', 0); END IF;

  v_blocks_per_week := v_n_blocks::NUMERIC / v_total_semanas;

  -- Distribuição balanceada (Task 6 inlinado)
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
    NULL::UUID AS subtopico_ref  -- preenchido com subtopico_id no insert final
  FROM numbered n;

  -- Simulados: aloca 1 a cada N semanas
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
      180,  -- 3 horas
      'Simulado periódico — semana ' || s,
      99 AS ordem,
      NULL,
      NULL,
      s AS week_number,
      NULL
    FROM generate_series(v_simulado_interval, v_total_semanas, v_simulado_interval) s;

    SELECT COUNT(*) FROM _ctx_assigned WHERE tipo = 'simulado'
      INTO v_simulados_count;
  END IF;

  -- Redação: 1 bloco de 60min por semana
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
      98 AS ordem,
      NULL,
      NULL,
      s AS week_number,
      NULL
    FROM generate_series(1, v_total_semanas) s;

    SELECT COUNT(*) FROM _ctx_assigned WHERE tipo = 'redacao'
      INTO v_redacao_count;
  END IF;

  v_result := jsonb_build_object(
    'status',            'simulados_redacao_added',
    'plano_id',          p_plano_uuid,
    'total_semanas',     v_total_semanas,
    'blocks_count',      v_n_blocks,
    'simulados_count',   v_simulados_count,
    'redacao_count',     v_redacao_count,
    'items_created',     0,
    'warnings',          v_warnings
  );

  RETURN v_result;
END $$;
