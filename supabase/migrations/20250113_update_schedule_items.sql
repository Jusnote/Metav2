-- ============================================================================
-- UPDATE: Schedule Items - Adicionar campos para novo fluxo FSRS
-- Atualização: 2025-01-13
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR NOVOS CAMPOS
-- ============================================================================

-- Adicionar revision_type (tipo de revisão)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS revision_type TEXT DEFAULT 'initial_study_part1';

-- Adicionar constraint para revision_type
ALTER TABLE schedule_items
DROP CONSTRAINT IF EXISTS revision_type_values;

ALTER TABLE schedule_items
ADD CONSTRAINT revision_type_values CHECK (
  revision_type IN (
    'initial_study_part1',   -- leitura + flashcards
    'initial_study_part2',   -- questões (dia seguinte)
    'flashcards_only',       -- só flashcards
    'questions_only',        -- só questões
    'reading_and_flashcards', -- reler + flashcards (Hard)
    'reading_and_questions'   -- reler + questões (Again)
  )
);

-- Adicionar revision_number (número da revisão)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0;

-- Adicionar performance_data (métricas detalhadas)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS performance_data JSONB;

-- Adicionar fsrs_state (estado do card FSRS)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS fsrs_state JSONB;

-- Adicionar document_id (link para documento)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Adicionar parent_item_id (link para item pai - parte 1)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL;

-- Adicionar next_revision_id (link para próxima revisão)
ALTER TABLE schedule_items
ADD COLUMN IF NOT EXISTS next_revision_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. CRIAR ÍNDICES PARA NOVOS CAMPOS
-- ============================================================================

-- Índice para buscar por revision_type
CREATE INDEX IF NOT EXISTS idx_schedule_items_revision_type
  ON schedule_items(revision_type)
  WHERE deleted_at IS NULL;

-- Índice para buscar por document_id
CREATE INDEX IF NOT EXISTS idx_schedule_items_document
  ON schedule_items(document_id)
  WHERE document_id IS NOT NULL;

-- Índice para buscar revisões por parent_item_id
CREATE INDEX IF NOT EXISTS idx_schedule_items_parent
  ON schedule_items(parent_item_id)
  WHERE parent_item_id IS NOT NULL;

-- Índice composto para buscar part2 de um part1
CREATE INDEX IF NOT EXISTS idx_schedule_items_parent_revision
  ON schedule_items(parent_item_id, revision_type)
  WHERE parent_item_id IS NOT NULL;

-- ============================================================================
-- 3. VERIFICAÇÕES FINAIS
-- ============================================================================

-- Verificar se colunas foram criadas
DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'schedule_items'
    AND column_name IN ('revision_type', 'revision_number', 'performance_data', 'fsrs_state', 'document_id', 'parent_item_id', 'next_revision_id');

  RAISE NOTICE 'Colunas adicionadas: %/7', column_count;

  IF column_count = 7 THEN
    RAISE NOTICE '✅ Todas as 7 colunas foram criadas com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Apenas % de 7 colunas foram criadas', column_count;
  END IF;
END $$;

-- Verificar constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'schedule_items'
    AND constraint_name = 'revision_type_values'
  ) THEN
    RAISE NOTICE '✅ Constraint revision_type_values criada com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Constraint revision_type_values não foi criada';
  END IF;
END $$;

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '🎉 Schedule Items atualizado para suportar novo fluxo FSRS!';
  RAISE NOTICE 'Próximo passo: Implementar hooks (Phase 2)';
END $$;
