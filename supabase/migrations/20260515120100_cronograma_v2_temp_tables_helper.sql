-- UP: procedure que popula 4 TEMP tables com contexto do plano
-- DOWN: DROP PROCEDURE _v2_carrega_contexto

CREATE OR REPLACE PROCEDURE _v2_carrega_contexto(p_plano_uuid UUID)
LANGUAGE plpgsql AS $$
BEGIN
  -- 1. Plano + config (1 row cada)
  CREATE TEMP TABLE IF NOT EXISTS _ctx_plano ON COMMIT DROP AS
  SELECT p.id, p.user_id, p.data_inicio, p.data_prova, p.cargo_snapshot,
         calcular_total_semanas(p.data_inicio, p.data_prova) AS total_semanas
  FROM planos_estudo p WHERE p.id = p_plano_uuid;

  CREATE TEMP TABLE IF NOT EXISTS _ctx_config ON COMMIT DROP AS
  SELECT pc.*
  FROM plano_config pc WHERE pc.plano_id = p_plano_uuid;

  -- 2. Disciplinas com nivel + ponto_fraco + excluded
  CREATE TEMP TABLE IF NOT EXISTS _ctx_disciplinas ON COMMIT DROP AS
  SELECT pd.id AS plano_disciplina_id, pd.disciplina_id, pd.peso,
         pd.nivel_conhecimento, pd.is_ponto_fraco, pd.excluded_subtopico_ids
  FROM plano_disciplinas pd WHERE pd.plano_id = p_plano_uuid;

  -- 3. Subtopicos das disciplinas, filtrando exclusões
  CREATE TEMP TABLE IF NOT EXISTS _ctx_subtopicos ON COMMIT DROP AS
  SELECT
    s.id AS subtopico_id,
    s.topico_id,
    t.disciplina_id,
    s.nome,
    COALESCE(s.estimated_duration_minutes, s.average_time, 45) AS duracao_base,
    d.nivel_conhecimento,
    d.is_ponto_fraco,
    d.peso AS disciplina_peso,
    -- Ajusta duração: nivel × ponto_fraco
    aplicar_ponto_fraco_boost(
      aplicar_nivel_multiplicador(d.nivel_conhecimento, COALESCE(s.estimated_duration_minutes, s.average_time, 45)),
      d.is_ponto_fraco
    ) AS duracao_ajustada
  FROM subtopicos s
  JOIN topicos t ON t.id = s.topico_id
  JOIN _ctx_disciplinas d ON d.disciplina_id = t.disciplina_id
  WHERE NOT (s.id = ANY(d.excluded_subtopico_ids));

  -- 4. Sequence de semanas: 1..total_semanas com data_inicio_semana
  CREATE TEMP TABLE IF NOT EXISTS _ctx_semanas ON COMMIT DROP AS
  SELECT
    s AS week_number,
    (SELECT data_inicio FROM _ctx_plano) + ((s - 1) * 7)::INTEGER AS week_start,
    (SELECT data_inicio FROM _ctx_plano) + (s * 7 - 1)::INTEGER AS week_end
  FROM generate_series(1, (SELECT total_semanas FROM _ctx_plano)) s;
END $$;

COMMENT ON PROCEDURE _v2_carrega_contexto IS
  'Popula 4 TEMP tables (_ctx_plano, _ctx_config, _ctx_disciplinas, _ctx_subtopicos, _ctx_semanas) pra uso por gerar_cronograma_v2. ON COMMIT DROP.';
