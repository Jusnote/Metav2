-- ============================================================================
-- CRONOGRAMA V2 — Função de Geração
-- gerar_cronograma(plano_uuid UUID) → JSONB
--
-- Gera todos os schedule_items contínuos pro plano dado, distribuindo
-- tópicos em blocos de `block_duration_minutes` e respeitando capacidade
-- diária (weekday/weekend + exceções) e pesos por disciplina (round-robin).
--
-- Revisões FSRS NÃO são geradas aqui — são criadas reativamente conforme
-- o usuário completa items.
--
-- Retorno: JSONB com items_created, blocks_total, overflow_minutes, warnings.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION gerar_cronograma(plano_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id              UUID;
  v_data_inicio          DATE;
  v_data_prova           DATE;
  v_weekday_minutes      INTEGER;
  v_weekend_minutes      INTEGER;
  v_weekend_minutes_eff  INTEGER;
  v_daily_exceptions     JSONB;
  v_block_duration       INTEGER;
  v_items_created        INTEGER := 0;
  v_blocks_total         INTEGER := 0;
  v_overflow_minutes     INTEGER := 0;
  v_warnings             JSONB   := '[]'::jsonb;
  v_disciplinas_count    INTEGER;
  v_topicos_count        INTEGER;
BEGIN
  -- ------------------------------------------------------------------------
  -- 1. Carregar plano + validar
  -- ------------------------------------------------------------------------
  SELECT user_id, data_inicio, data_prova
    INTO v_user_id, v_data_inicio, v_data_prova
  FROM planos_estudo
  WHERE id = plano_uuid;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', plano_uuid USING ERRCODE = 'P0002';
  END IF;

  -- Auth: o usuário precisa ser o dono do plano (RLS deveria pegar, mas garantimos)
  IF auth.uid() IS NOT NULL AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'Acesso negado ao plano %', plano_uuid USING ERRCODE = '42501';
  END IF;

  -- ------------------------------------------------------------------------
  -- 2. Carregar plano_config
  -- ------------------------------------------------------------------------
  SELECT weekday_minutes, weekend_minutes, daily_exceptions, block_duration_minutes
    INTO v_weekday_minutes, v_weekend_minutes, v_daily_exceptions, v_block_duration
  FROM plano_config
  WHERE plano_id = plano_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plano_config não encontrado para plano %', plano_uuid USING ERRCODE = 'P0002';
  END IF;

  -- ------------------------------------------------------------------------
  -- 3. Validar pré-condições
  -- ------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_disciplinas_count
  FROM plano_disciplinas
  WHERE plano_id = plano_uuid AND enabled = TRUE;

  IF v_disciplinas_count = 0 THEN
    v_warnings := v_warnings || jsonb_build_array('nenhuma_disciplina_ativa');
    RETURN jsonb_build_object(
      'items_created', 0,
      'blocks_total', 0,
      'overflow_minutes', 0,
      'warnings', v_warnings
    );
  END IF;

  SELECT COUNT(*) INTO v_topicos_count
  FROM topicos t
  JOIN plano_disciplinas pd ON pd.disciplina_id = t.disciplina_id
  WHERE pd.plano_id = plano_uuid
    AND pd.enabled = TRUE
    AND t.user_id = v_user_id;

  IF v_topicos_count = 0 THEN
    v_warnings := v_warnings || jsonb_build_array('nenhum_topico');
    RETURN jsonb_build_object(
      'items_created', 0,
      'blocks_total', 0,
      'overflow_minutes', 0,
      'warnings', v_warnings
    );
  END IF;

  -- ------------------------------------------------------------------------
  -- 4. Limpar items pendentes anteriores (preserva concluídos)
  -- ------------------------------------------------------------------------
  DELETE FROM schedule_items
   WHERE plano_id = plano_uuid
     AND status = 'pendente';

  -- ------------------------------------------------------------------------
  -- 5. Temp table: dias com capacidade
  -- ------------------------------------------------------------------------
  CREATE TEMP TABLE _day_budget (
    day_date  DATE PRIMARY KEY,
    remaining INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _day_budget (day_date, remaining)
  SELECT
    d.day_date,
    COALESCE(
      (v_daily_exceptions ->> d.day_date::text)::int,
      CASE
        WHEN EXTRACT(DOW FROM d.day_date) IN (0, 6) THEN v_weekend_minutes
        ELSE v_weekday_minutes
      END
    ) AS remaining
  FROM generate_series(v_data_inicio, v_data_prova, INTERVAL '1 day') AS d(day_date);

  -- ------------------------------------------------------------------------
  -- 6. Temp table: blocos a alocar (round-robin por peso de disciplina)
  --
  -- Estratégia:
  --   • Cada tópico vira N blocos = CEIL(estimated_duration / block_duration)
  --   • Round-robin entre disciplinas, com disciplinas de peso maior
  --     puxando mais blocos por ciclo (proporção peso/maxPeso × 2, min 1).
  --   • Dentro da mesma disciplina, blocos seguem ordem do tópico.
  -- ------------------------------------------------------------------------
  CREATE TEMP TABLE _blocks (
    seq            BIGSERIAL PRIMARY KEY,
    disciplina_id  UUID NOT NULL,
    topico_id      UUID NOT NULL,
    title          TEXT NOT NULL,
    block_idx      INTEGER NOT NULL,
    total_blocks   INTEGER NOT NULL,
    peso           INTEGER NOT NULL,
    cycle_position INTEGER NOT NULL  -- usado pra ordenar pelo round-robin
  ) ON COMMIT DROP;

  -- Expandir tópicos em blocos
  WITH topicos_blocos AS (
    SELECT
      pd.disciplina_id,
      pd.peso,
      pd.ordem AS disc_ordem,
      t.id AS topico_id,
      t.nome AS topico_nome,
      COALESCE(t.estimated_duration_minutes, 60) AS dur,
      GREATEST(1, CEIL(COALESCE(t.estimated_duration_minutes, 60)::numeric / v_block_duration)::int) AS total_blocks,
      ROW_NUMBER() OVER (PARTITION BY pd.disciplina_id ORDER BY t.created_at) AS topico_order_in_disc
    FROM topicos t
    JOIN plano_disciplinas pd ON pd.disciplina_id = t.disciplina_id
    WHERE pd.plano_id = plano_uuid
      AND pd.enabled = TRUE
      AND t.user_id = v_user_id
  ),
  expanded AS (
    SELECT
      tb.*,
      gs AS block_idx
    FROM topicos_blocos tb
    CROSS JOIN LATERAL generate_series(1, tb.total_blocks) gs
  ),
  -- Calcular posição "cycle" pra round-robin balanceado por peso
  max_peso AS (
    SELECT MAX(peso) AS mp FROM expanded
  ),
  with_cycle AS (
    SELECT
      e.*,
      -- Posição global do bloco DENTRO da sua disciplina (1, 2, 3, ...)
      ROW_NUMBER() OVER (
        PARTITION BY e.disciplina_id
        ORDER BY e.topico_order_in_disc, e.block_idx
      ) AS pos_in_disc,
      mp.mp AS max_peso
    FROM expanded e CROSS JOIN max_peso mp
  )
  INSERT INTO _blocks (disciplina_id, topico_id, title, block_idx, total_blocks, peso, cycle_position)
  SELECT
    wc.disciplina_id,
    wc.topico_id,
    CASE
      WHEN wc.total_blocks > 1 THEN wc.topico_nome || ' — Parte ' || wc.block_idx
      ELSE wc.topico_nome
    END AS title,
    wc.block_idx,
    wc.total_blocks,
    wc.peso,
    -- cycle_position: posiciona blocos pra round-robin.
    -- Disciplinas de peso maior aparecem mais cedo dentro do mesmo "ciclo".
    -- Ex: 3 disciplinas (pesos 10/5/3) → bloco1=disc10, bloco2=disc10, bloco3=disc5, bloco4=disc3, bloco5=disc10, ...
    -- Fórmula simplificada: pos_in_disc * (max_peso / peso) gera um valor inversamente
    -- proporcional ao peso, fazendo disciplinas pesadas terem cycle_position menor.
    (wc.pos_in_disc * 1000 * wc.max_peso / GREATEST(wc.peso, 1))::int AS cycle_position
  FROM with_cycle wc
  ORDER BY wc.disciplina_id, wc.topico_order_in_disc, wc.block_idx;

  SELECT COUNT(*) INTO v_blocks_total FROM _blocks;

  -- ------------------------------------------------------------------------
  -- 7. Alocar blocos em dias (greedy, em ordem de cycle_position)
  -- ------------------------------------------------------------------------
  CREATE TEMP TABLE _items_to_insert (
    scheduled_date DATE NOT NULL,
    type           schedule_item_type NOT NULL,
    disciplina_id  UUID NOT NULL,
    topico_id      UUID NOT NULL,
    title          TEXT NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    priority       INTEGER NOT NULL
  ) ON COMMIT DROP;

  DECLARE
    v_block RECORD;
    v_day   RECORD;
    v_allocated BOOLEAN;
  BEGIN
    FOR v_block IN
      SELECT * FROM _blocks ORDER BY cycle_position, seq
    LOOP
      v_allocated := FALSE;
      -- Procura o PRIMEIRO dia com capacidade suficiente
      FOR v_day IN
        SELECT day_date FROM _day_budget
        WHERE remaining >= v_block_duration
        ORDER BY day_date
        LIMIT 1
      LOOP
        INSERT INTO _items_to_insert (
          scheduled_date, type, disciplina_id, topico_id,
          title, estimated_duration_minutes, priority
        ) VALUES (
          v_day.day_date,
          CASE
            WHEN v_block.block_idx = 1 THEN 'estudo_inicial_p1'::schedule_item_type
            ELSE 'estudo_inicial_p2'::schedule_item_type
          END,
          v_block.disciplina_id, v_block.topico_id,
          v_block.title, v_block_duration, 5
        );
        UPDATE _day_budget
           SET remaining = remaining - v_block_duration
         WHERE day_date = v_day.day_date;
        v_allocated := TRUE;
      END LOOP;

      IF NOT v_allocated THEN
        v_overflow_minutes := v_overflow_minutes + v_block_duration;
      END IF;
    END LOOP;
  END;

  IF v_overflow_minutes > 0 THEN
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object('type', 'overflow', 'overflow_minutes', v_overflow_minutes)
    );
  END IF;

  -- ------------------------------------------------------------------------
  -- 8. Bulk insert em schedule_items
  -- ------------------------------------------------------------------------
  INSERT INTO schedule_items (
    user_id, plano_id, scheduled_date, type, status,
    disciplina_id, topico_id, title,
    estimated_duration_minutes, priority
  )
  SELECT
    v_user_id, plano_uuid, scheduled_date, type, 'pendente'::schedule_item_status,
    disciplina_id, topico_id, title,
    estimated_duration_minutes, priority
  FROM _items_to_insert
  ORDER BY scheduled_date;

  GET DIAGNOSTICS v_items_created = ROW_COUNT;

  -- ------------------------------------------------------------------------
  -- 9. Log da geração
  -- ------------------------------------------------------------------------
  INSERT INTO schedule_logs (user_id, item_id, action, metadata)
  VALUES (
    v_user_id, NULL, 'created',
    jsonb_build_object(
      'plano_id', plano_uuid,
      'items_created', v_items_created,
      'blocks_total', v_blocks_total,
      'overflow_minutes', v_overflow_minutes,
      'warnings', v_warnings
    )
  );

  -- ------------------------------------------------------------------------
  -- 10. Retorno
  -- ------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'items_created', v_items_created,
    'blocks_total', v_blocks_total,
    'overflow_minutes', v_overflow_minutes,
    'warnings', v_warnings
  );
END;
$$;

-- Permissão para chamar via RPC (authenticated users)
GRANT EXECUTE ON FUNCTION gerar_cronograma(UUID) TO authenticated;

COMMIT;
