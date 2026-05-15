-- Testes dos 3 helpers como queries (cada SELECT é um caso)
SELECT 'aplicar_nivel_multiplicador iniciante' AS test,
       aplicar_nivel_multiplicador('iniciante', 100)::TEXT AS actual,
       '150' AS expected;
SELECT 'aplicar_nivel_multiplicador intermediario',
       aplicar_nivel_multiplicador('intermediario', 100)::TEXT, '100';
SELECT 'aplicar_nivel_multiplicador avancado',
       aplicar_nivel_multiplicador('avancado', 100)::TEXT, '70';

SELECT 'aplicar_ponto_fraco_boost TRUE',
       aplicar_ponto_fraco_boost(100, TRUE)::TEXT, '130';
SELECT 'aplicar_ponto_fraco_boost FALSE',
       aplicar_ponto_fraco_boost(100, FALSE)::TEXT, '100';

SELECT 'calcular_total_semanas exata',
       calcular_total_semanas('2026-05-15', '2026-06-26')::TEXT, '6';
SELECT 'calcular_total_semanas 1 dia extra (ceil)',
       calcular_total_semanas('2026-05-15', '2026-06-27')::TEXT, '7';
SELECT 'calcular_total_semanas data invertida',
       calcular_total_semanas('2026-06-26', '2026-05-15')::TEXT, '0';

-- capacidade_dia: 2026-09-07 (Independência, feriado nacional → 0)
SELECT 'capacidade_dia feriado nacional',
       capacidade_dia('2026-09-07', 180, 240, '{}'::JSONB)::TEXT, '0';

-- 2026-05-18 (segunda, sem exceção, sem feriado) → weekday 180
SELECT 'capacidade_dia weekday normal',
       capacidade_dia('2026-05-18', 180, 240, '{}'::JSONB)::TEXT, '180';

-- 2026-05-17 (domingo) → weekend 240
SELECT 'capacidade_dia weekend',
       capacidade_dia('2026-05-17', 180, 240, '{}'::JSONB)::TEXT, '240';

-- Daily exception sobrescreve weekend
SELECT 'capacidade_dia daily_exception',
       capacidade_dia('2026-05-17', 180, 240, '{"2026-05-17": 60}'::JSONB)::TEXT, '60';

-- Daily exception não bate o feriado (feriado vence)
SELECT 'capacidade_dia feriado > exception',
       capacidade_dia('2026-09-07', 180, 240, '{"2026-09-07": 999}'::JSONB)::TEXT, '0';
