-- ============================================================================
-- INSERIR TEMPLATES DO SISTEMA (caso não tenham sido criados ainda)
-- ============================================================================

INSERT INTO goal_templates (name, description, duration_days, intensity, is_system, distribution_config)
SELECT * FROM (VALUES
  (
    'Preparação Rápida (1 Semana)',
    'Meta intensiva para revisão rápida antes de provas',
    7,
    'intensive',
    TRUE,
    '{"reviewsPerWeek": 7, "sessionsPerDay": 3, "restDays": []}'::jsonb
  ),
  (
    'Estudo Equilibrado (2 Semanas)',
    'Meta moderada com espaçamento inteligente',
    14,
    'moderate',
    TRUE,
    '{"reviewsPerWeek": 5, "sessionsPerDay": 2, "restDays": [0, 6]}'::jsonb
  ),
  (
    'Aprendizado Profundo (30 Dias)',
    'Meta de longo prazo com FSRS otimizado',
    30,
    'light',
    TRUE,
    '{"reviewsPerWeek": 4, "sessionsPerDay": 1, "restDays": [0]}'::jsonb
  ),
  (
    'Preparação para Concurso (90 Dias)',
    'Meta de preparação intensiva de longo prazo',
    90,
    'moderate',
    TRUE,
    '{"reviewsPerWeek": 6, "sessionsPerDay": 2, "restDays": [0]}'::jsonb
  )
) AS templates(name, description, duration_days, intensity, is_system, distribution_config)
WHERE NOT EXISTS (
  SELECT 1 FROM goal_templates WHERE is_system = TRUE
);

-- Verificar templates inseridos
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count
  FROM goal_templates
  WHERE is_system = TRUE;

  RAISE NOTICE 'Templates do sistema encontrados: %', template_count;

  IF template_count >= 4 THEN
    RAISE NOTICE '✅ Templates do sistema criados com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Apenas % templates foram inseridos', template_count;
  END IF;
END $$;
