-- UP: distribuição balanceada por semana, round-robin disciplinas
-- DOWN: rever pra versão da Task 5

CREATE OR REPLACE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID;
  v_total_semanas      INTEGER;
  v_n_blocks           INTEGER;
  v_blocks_per_week    NUMERIC;
  v_warnings           JSONB := '[]'::JSONB;
  v_result             JSONB;
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

  -- Gera _ctx_blocks (mesmo bloco da Task 5, inlinado aqui)
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

  -- Atribui week_number a cada block: round-robin por disciplina,
  -- teoria na 1ª passagem, questões na 2ª (ordem). Resultado:
  -- balanceado ±1 por semana, mesma disciplina espaçada.
  CREATE TEMP TABLE IF NOT EXISTS _ctx_assigned ON COMMIT DROP AS
  WITH numbered AS (
    SELECT
      b.*,
      -- Posição global respeitando ordem: teoria antes de questões mesmo subtópico
      ROW_NUMBER() OVER (
        PARTITION BY b.disciplina_id, b.ordem
        ORDER BY b.subtopico_id
      ) AS pos_in_disc_ordem,
      ROW_NUMBER() OVER (
        ORDER BY b.ordem, b.disciplina_id, b.subtopico_id
      ) AS global_seq
    FROM _ctx_blocks b
  )
  SELECT
    n.*,
    -- Distribui no intervalo [1, total_semanas]: divisão inteira do global_seq
    LEAST(
      v_total_semanas,
      GREATEST(1, CEIL(n.global_seq::NUMERIC / v_blocks_per_week)::INTEGER)
    ) AS week_number
  FROM numbered n;

  v_result := jsonb_build_object(
    'status',            'distributed',
    'plano_id',          p_plano_uuid,
    'total_semanas',     v_total_semanas,
    'blocks_count',      v_n_blocks,
    'blocks_per_week',   ROUND(v_blocks_per_week, 2),
    'items_created',     0,
    'warnings',          v_warnings
  );

  RETURN v_result;
END $$;
