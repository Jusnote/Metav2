-- ============================================
-- Migração: Sistema de Distribuição Baseada em Tempo
-- Data: 2025-01-17
-- Descrição: Adiciona campos para tempo estimado de conclusão
--            e sistema de prioridade de revisões
-- ============================================

-- ============================================
-- PARTE 1: TEMPO ESTIMADO DE CONCLUSÃO
-- ============================================

-- Adicionar campo de duração estimada em minutos para topics
ALTER TABLE topics
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 120;

-- Adicionar campo de duração estimada em minutos para subtopics
ALTER TABLE subtopics
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 90;

-- Comentários para documentação
COMMENT ON COLUMN topics.estimated_duration_minutes IS
'Tempo estimado total de conclusão em minutos (inclui leitura + flashcards + questões). Parte 1 = 60%, Parte 2 = 40%';

COMMENT ON COLUMN subtopics.estimated_duration_minutes IS
'Tempo estimado total de conclusão em minutos (inclui leitura + flashcards + questões). Parte 1 = 60%, Parte 2 = 40%';

-- Atualizar registros existentes com valores padrão baseados no nível de hierarquia
UPDATE topics
SET estimated_duration_minutes = 120
WHERE estimated_duration_minutes IS NULL;

UPDATE subtopics
SET estimated_duration_minutes = 90
WHERE estimated_duration_minutes IS NULL;

-- Tornar NOT NULL após atualizar valores
ALTER TABLE topics
ALTER COLUMN estimated_duration_minutes SET NOT NULL;

ALTER TABLE subtopics
ALTER COLUMN estimated_duration_minutes SET NOT NULL;

-- Adicionar check constraints para validação
ALTER TABLE topics
ADD CONSTRAINT topics_duration_positive
CHECK (estimated_duration_minutes > 0 AND estimated_duration_minutes <= 600);

ALTER TABLE subtopics
ADD CONSTRAINT subtopics_duration_positive
CHECK (estimated_duration_minutes > 0 AND estimated_duration_minutes <= 600);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_topics_duration
ON topics(estimated_duration_minutes);

CREATE INDEX IF NOT EXISTS idx_subtopics_duration
ON subtopics(estimated_duration_minutes);

-- ============================================
-- PARTE 2: SISTEMA DE PRIORIDADE DE REVISÕES
-- ============================================

-- Adicionar campos para controle de revisões dinâmicas
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS is_overbooked BOOLEAN DEFAULT FALSE;

ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS is_delayed BOOLEAN DEFAULT FALSE;

ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT 0;

ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS original_scheduled_date DATE;

ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES schedule_items(id) ON DELETE CASCADE;

ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS fsrs_card_state JSONB;

-- Adicionar campo para identificar items manuais
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- Comentários para documentação
COMMENT ON COLUMN schedule_items.is_overbooked IS
'Revisão agendada em dia com sobrecarga (>100% mas <=120% capacidade)';

COMMENT ON COLUMN schedule_items.is_delayed IS
'Revisão atrasada devido falta de espaço no dia ideal calculado pelo FSRS';

COMMENT ON COLUMN schedule_items.delay_days IS
'Quantos dias a revisão foi atrasada (0 se não atrasada)';

COMMENT ON COLUMN schedule_items.original_scheduled_date IS
'Data original calculada pelo FSRS antes de ser atrasada';

COMMENT ON COLUMN schedule_items.parent_item_id IS
'ID do schedule_item que gerou esta revisão (para rastrear hierarquia Parte 2 → Revisão 1 → Revisão 2)';

COMMENT ON COLUMN schedule_items.fsrs_card_state IS
'Estado serializado do card FSRS (difficulty, stability, due, etc) para calcular próxima revisão';

COMMENT ON COLUMN schedule_items.is_manual IS
'Item agendado manualmente pelo usuário (não gerado por meta FSRS)';

-- Adicionar check constraint para delay_days
ALTER TABLE schedule_items
ADD CONSTRAINT schedule_items_delay_days_valid
CHECK (delay_days >= 0 AND delay_days <= 30);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_schedule_items_overbooked
ON schedule_items(is_overbooked)
WHERE is_overbooked = TRUE;

CREATE INDEX IF NOT EXISTS idx_schedule_items_delayed
ON schedule_items(is_delayed)
WHERE is_delayed = TRUE;

CREATE INDEX IF NOT EXISTS idx_schedule_items_parent
ON schedule_items(parent_item_id)
WHERE parent_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_items_manual
ON schedule_items(is_manual)
WHERE is_manual = TRUE;

CREATE INDEX IF NOT EXISTS idx_schedule_items_scheduled_date
ON schedule_items(scheduled_date);

-- ============================================
-- PARTE 3: FUNÇÕES AUXILIARES
-- ============================================

-- Função para calcular capacidade diária baseada em intensidade
CREATE OR REPLACE FUNCTION get_daily_capacity(intensity_level TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE intensity_level
    WHEN 'light' THEN 60      -- 1h/dia
    WHEN 'moderate' THEN 120  -- 2h/dia
    WHEN 'intense' THEN 240   -- 4h/dia
    ELSE 120                  -- default: moderate
  END;
END;
$$;

COMMENT ON FUNCTION get_daily_capacity IS
'Retorna capacidade diária em minutos baseada no nível de intensidade';

-- Função para calcular hard limit (120% da capacidade)
CREATE OR REPLACE FUNCTION get_hard_limit_capacity(intensity_level TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE intensity_level
    WHEN 'light' THEN 72      -- 60 * 1.2
    WHEN 'moderate' THEN 144  -- 120 * 1.2
    WHEN 'intense' THEN 276   -- 240 * 1.15 (menos margem pois já é intenso)
    ELSE 144                  -- default: moderate
  END;
END;
$$;

COMMENT ON FUNCTION get_hard_limit_capacity IS
'Retorna capacidade máxima (hard limit) em minutos com margem de segurança para revisões';

-- ============================================
-- PARTE 4: TRIGGERS E VALIDAÇÕES
-- ============================================

-- Trigger para validar consistência de delay
CREATE OR REPLACE FUNCTION validate_schedule_item_delay()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se is_delayed = TRUE, deve ter delay_days > 0 e original_scheduled_date
  IF NEW.is_delayed = TRUE THEN
    IF NEW.delay_days IS NULL OR NEW.delay_days <= 0 THEN
      RAISE EXCEPTION 'Item atrasado deve ter delay_days > 0';
    END IF;

    IF NEW.original_scheduled_date IS NULL THEN
      RAISE EXCEPTION 'Item atrasado deve ter original_scheduled_date';
    END IF;
  END IF;

  -- Se is_delayed = FALSE, não deve ter delay_days ou original_scheduled_date
  IF NEW.is_delayed = FALSE THEN
    IF NEW.delay_days > 0 THEN
      NEW.delay_days := 0;
    END IF;

    NEW.original_scheduled_date := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_schedule_item_delay
BEFORE INSERT OR UPDATE ON schedule_items
FOR EACH ROW
EXECUTE FUNCTION validate_schedule_item_delay();

COMMENT ON TRIGGER trigger_validate_schedule_item_delay ON schedule_items IS
'Valida consistência entre is_delayed, delay_days e original_scheduled_date';

-- ============================================
-- PARTE 5: VIEWS ÚTEIS
-- ============================================

-- View para ver items overbooked por dia
CREATE OR REPLACE VIEW schedule_items_overbooked_by_date AS
SELECT
  scheduled_date,
  COUNT(*) as overbooked_count,
  SUM(estimated_duration) as total_minutes,
  ARRAY_AGG(title) as titles
FROM schedule_items
WHERE is_overbooked = TRUE
  AND completed = FALSE
GROUP BY scheduled_date
ORDER BY scheduled_date;

COMMENT ON VIEW schedule_items_overbooked_by_date IS
'Lista dias com items overbooked agrupados por data';

-- View para ver items atrasados
CREATE OR REPLACE VIEW schedule_items_delayed AS
SELECT
  id,
  title,
  original_scheduled_date,
  scheduled_date,
  delay_days,
  estimated_duration,
  revision_type
FROM schedule_items
WHERE is_delayed = TRUE
  AND completed = FALSE
ORDER BY scheduled_date;

COMMENT ON VIEW schedule_items_delayed IS
'Lista todas as revisões atrasadas (não completadas)';

-- View para ver hierarquia de revisões (Parte 2 → Revisão 1 → Revisão 2)
CREATE OR REPLACE VIEW schedule_items_revision_hierarchy AS
WITH RECURSIVE revision_tree AS (
  -- Base: Items Parte 2 (sem parent)
  SELECT
    id,
    title,
    revision_type,
    scheduled_date,
    parent_item_id,
    1 as depth,
    ARRAY[id] as path
  FROM schedule_items
  WHERE revision_type = 'initial_study_part2'

  UNION ALL

  -- Recursivo: Revisões filhas
  SELECT
    si.id,
    si.title,
    si.revision_type,
    si.scheduled_date,
    si.parent_item_id,
    rt.depth + 1,
    rt.path || si.id
  FROM schedule_items si
  INNER JOIN revision_tree rt ON si.parent_item_id = rt.id
)
SELECT * FROM revision_tree
ORDER BY path;

COMMENT ON VIEW schedule_items_revision_hierarchy IS
'Mostra hierarquia completa de revisões (Parte 2 → Revisão 1 → Revisão 2 → ...)';

-- ============================================
-- PARTE 6: DADOS DE TESTE (OPCIONAL)
-- ============================================

-- Inserir alguns valores de exemplo para testes (comentado por padrão)
-- Descomente as linhas abaixo se quiser dados de teste

/*
-- Atualizar alguns topics existentes com durações variadas
UPDATE topics
SET estimated_duration_minutes = 180
WHERE title ILIKE '%constitucional%'
LIMIT 1;

UPDATE topics
SET estimated_duration_minutes = 90
WHERE title ILIKE '%penal%'
LIMIT 1;

-- Atualizar alguns subtopics existentes
UPDATE subtopics
SET estimated_duration_minutes = 120
WHERE title ILIKE '%princípios%'
LIMIT 1;

UPDATE subtopics
SET estimated_duration_minutes = 60
WHERE title ILIKE '%organização%'
LIMIT 1;
*/

-- ============================================
-- CONCLUSÃO
-- ============================================

-- Verificar se tudo foi criado corretamente
DO $$
DECLARE
  topics_count INTEGER;
  subtopics_count INTEGER;
  schedule_items_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO topics_count FROM topics WHERE estimated_duration_minutes IS NOT NULL;
  SELECT COUNT(*) INTO subtopics_count FROM subtopics WHERE estimated_duration_minutes IS NOT NULL;
  SELECT COUNT(*) INTO schedule_items_count FROM schedule_items;

  RAISE NOTICE '✅ Migração concluída com sucesso!';
  RAISE NOTICE '📊 Topics com duração: %', topics_count;
  RAISE NOTICE '📊 Subtopics com duração: %', subtopics_count;
  RAISE NOTICE '📊 Schedule items existentes: %', schedule_items_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Próximos passos:';
  RAISE NOTICE '1. Atualizar tipos TypeScript (database.ts)';
  RAISE NOTICE '2. Criar componente TimeEstimateInput';
  RAISE NOTICE '3. Atualizar TopicForm e SubtopicForm';
END $$;
