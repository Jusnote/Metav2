-- UP: helpers puros do algoritmo V2 + valor 'redacao' no schedule_item_type
-- DOWN: DROP FUNCTION cada helper (não reverter o enum value — PG não suporta)

-- 0. Adiciona 'redacao' ao enum schedule_item_type (idempotente)
-- Necessário pra Task 7 que aloca blocos de redação.
DO $$ BEGIN
  ALTER TYPE schedule_item_type ADD VALUE IF NOT EXISTS 'redacao';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Multiplicador de duração por nível de conhecimento
CREATE OR REPLACE FUNCTION aplicar_nivel_multiplicador(
  p_nivel nivel_conhecimento_enum,
  p_base_minutos INTEGER
) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_nivel
    WHEN 'iniciante'      THEN CEIL(p_base_minutos * 1.5)::INTEGER
    WHEN 'intermediario'  THEN p_base_minutos
    WHEN 'avancado'       THEN CEIL(p_base_minutos * 0.7)::INTEGER
  END;
$$;

COMMENT ON FUNCTION aplicar_nivel_multiplicador IS
  'Ajusta duração base por nível declarado pelo user. Iniciante 1.5x, intermediário 1.0x, avançado 0.7x. IMMUTABLE.';

-- Boost de ponto fraco (+30%)
CREATE OR REPLACE FUNCTION aplicar_ponto_fraco_boost(
  p_minutos INTEGER,
  p_is_ponto_fraco BOOLEAN
) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_is_ponto_fraco
    THEN CEIL(p_minutos * 1.3)::INTEGER
    ELSE p_minutos
  END;
$$;

COMMENT ON FUNCTION aplicar_ponto_fraco_boost IS
  '+30% de tempo em disciplinas marcadas como ponto fraco. IMMUTABLE.';

-- Cálculo de total de semanas entre duas datas (inclusivo data_inicio)
CREATE OR REPLACE FUNCTION calcular_total_semanas(
  p_data_inicio DATE,
  p_data_prova DATE
) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(
    CEIL((p_data_prova - p_data_inicio)::NUMERIC / 7)::INTEGER,
    0
  );
$$;

COMMENT ON FUNCTION calcular_total_semanas IS
  'Número de semanas entre data_inicio e data_prova (arredonda pra cima). Retorna 0 se data_prova ≤ data_inicio.';

-- Capacidade de minutos num dia específico
CREATE OR REPLACE FUNCTION capacidade_dia(
  p_data DATE,
  p_weekday_minutes INTEGER,
  p_weekend_minutes INTEGER,
  p_daily_exceptions JSONB DEFAULT '{}'::JSONB
) RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_iso_dow INTEGER;  -- 1..7 (segunda..domingo)
  v_exception TEXT;
  v_is_feriado BOOLEAN;
BEGIN
  -- Feriado nacional → 0 minutos
  SELECT EXISTS(SELECT 1 FROM feriados_nacionais WHERE data = p_data AND tipo = 'nacional')
  INTO v_is_feriado;
  IF v_is_feriado THEN RETURN 0; END IF;

  -- Exceção declarada na config (ex: {"2026-07-04": 0, "2026-12-24": 60})
  v_exception := p_daily_exceptions->>(p_data::TEXT);
  IF v_exception IS NOT NULL THEN
    RETURN v_exception::INTEGER;
  END IF;

  -- Base: weekday (Mon-Fri) ou weekend (Sat-Sun)
  v_iso_dow := EXTRACT(ISODOW FROM p_data);
  IF v_iso_dow <= 5 THEN
    RETURN p_weekday_minutes;
  ELSE
    RETURN p_weekend_minutes;
  END IF;
END $$;

COMMENT ON FUNCTION capacidade_dia IS
  'Minutos disponíveis num dia. Feriado nacional zera; daily_exceptions sobrescreve; fallback weekday/weekend.';
