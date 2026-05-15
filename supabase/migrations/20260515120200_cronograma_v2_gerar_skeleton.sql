-- UP: skeleton de gerar_cronograma_v2 (validações + carga de contexto)
-- DOWN: DROP FUNCTION gerar_cronograma_v2

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
  v_warnings      JSONB := '[]'::JSONB;
  v_result        JSONB;
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

  SELECT COUNT(*) FROM _ctx_subtopicos INTO v_n_subtopicos;
  IF v_n_subtopicos = 0 THEN
    v_warnings := v_warnings || jsonb_build_object('warning', 'no_subtopics', 'msg', 'Nenhum subtópico após filtros');
  END IF;

  -- 3. Skeleton: retorna shell
  v_result := jsonb_build_object(
    'status',           'skeleton',
    'plano_id',         p_plano_uuid,
    'total_semanas',    v_total_semanas,
    'subtopicos_count', v_n_subtopicos,
    'items_created',    0,
    'warnings',         v_warnings
  );

  RETURN v_result;
END $$;

COMMENT ON FUNCTION gerar_cronograma_v2 IS
  'Gera schedule_items para um plano, distribuindo balanceadamente por semana, respeitando nível, pontos fracos, feriados e mix configurado. Sub-plan 2 / spec 6.';
