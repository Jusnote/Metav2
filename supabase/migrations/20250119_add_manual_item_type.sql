-- ============================================================================
-- ADD MANUAL ITEM TYPE
-- Adicionar 'manual' como tipo válido de schedule_item
-- Criado em: 2025-01-19
-- ============================================================================

-- Drop e recriar a constraint para incluir 'manual'
ALTER TABLE schedule_items
DROP CONSTRAINT IF EXISTS item_type_values;

ALTER TABLE schedule_items
ADD CONSTRAINT item_type_values CHECK (
  item_type IN ('normal', 'goal', 'external', 'manual')
);

-- Verificação
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'schedule_items'
    AND constraint_name = 'item_type_values'
  ) THEN
    RAISE NOTICE '✅ Constraint item_type_values atualizada com sucesso!';
    RAISE NOTICE '   Valores permitidos: normal, goal, external, manual';
  ELSE
    RAISE WARNING '⚠️ Constraint item_type_values não foi atualizada';
  END IF;
END $$;
