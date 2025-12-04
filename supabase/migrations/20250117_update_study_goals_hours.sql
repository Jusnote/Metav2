-- Migration: Substituir intensity por hours_per_day e study_weekends
-- Data: 2025-01-17
-- Descrição: Tornar o sistema de metas mais flexível, permitindo definir horas exatas por dia

-- 1. Adicionar novas colunas
ALTER TABLE study_goals
  ADD COLUMN IF NOT EXISTS hours_per_day DECIMAL(3,1) DEFAULT 2.0 CHECK (hours_per_day >= 0.5 AND hours_per_day <= 12),
  ADD COLUMN IF NOT EXISTS study_weekends BOOLEAN DEFAULT false;

-- 2. Migrar dados existentes de intensity para hours_per_day
UPDATE study_goals
SET hours_per_day = CASE
  WHEN intensity = 'light' THEN 1.0
  WHEN intensity = 'moderate' THEN 2.0
  WHEN intensity = 'intensive' THEN 4.0
  ELSE 2.0
END
WHERE hours_per_day IS NULL OR hours_per_day = 2.0;

-- 3. Migrar dados existentes de intensity para study_weekends
UPDATE study_goals
SET study_weekends = CASE
  WHEN intensity = 'intensive' THEN true
  ELSE false
END
WHERE study_weekends IS NULL OR study_weekends = false;

-- 4. Remover coluna intensity (após migração)
ALTER TABLE study_goals
  DROP COLUMN IF EXISTS intensity;

-- 5. Adicionar comentários
COMMENT ON COLUMN study_goals.hours_per_day IS 'Quantidade de horas de estudo por dia (0.5 a 12)';
COMMENT ON COLUMN study_goals.study_weekends IS 'Se deve estudar nos fins de semana (sábado e domingo)';
