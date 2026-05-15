-- UP: extende gerar_cronograma_v2 com geração de blocks
-- DOWN: rever pra versão da Task 4

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_total_semanas INTEGER;
  v_n_subtopicos  INTEGER;
  v_n_blocks      INTEGER;
  v_warnings      JSONB := '[]'::JSONB;
  v_result        JSONB;
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

  SELECT COUNT(*) FROM _ctx_subtopicos INTO v_n_subtopicos;
  IF v_n_subtopicos = 0 THEN
    RETURN jsonb_build_object('status', 'no_subtopics', 'items_created', 0);
  END IF;

  -- 4. Gera blocks: 1 teoria + 1 questões por subtópico
  CREATE TEMP TABLE IF NOT EXISTS _ctx_blocks ON COMMIT DROP AS
  WITH teoria AS (
    SELECT
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      'estudo_inicial_p1'::schedule_item_type AS tipo,
      duracao_ajustada AS minutos,
      nome AS title,
      1 AS ordem_no_subtopico
    FROM _ctx_subtopicos
  ),
  questoes AS (
    SELECT
      subtopico_id, topico_id, disciplina_id, disciplina_peso,
      'estudo_inicial_p2'::schedule_item_type AS tipo,
      GREATEST(20, CEIL(duracao_ajustada * 0.5)::INTEGER) AS minutos,  -- mínimo 20min de questões
      nome AS title,
      2 AS ordem_no_subtopico
    FROM _ctx_subtopicos
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY disciplina_id, subtopico_id, ordem_no_subtopico) AS block_seq,
    *
  FROM (SELECT * FROM teoria UNION ALL SELECT * FROM questoes) ALL_BLOCKS;

  SELECT COUNT(*) FROM _ctx_blocks INTO v_n_blocks;

  v_result := jsonb_build_object(
    'status',            'blocks_generated',
    'plano_id',          p_plano_uuid,
    'total_semanas',     v_total_semanas,
    'subtopicos_count',  v_n_subtopicos,
    'blocks_count',      v_n_blocks,
    'items_created',     0,
    'warnings',          v_warnings
  );

  RETURN v_result;
END $$;
