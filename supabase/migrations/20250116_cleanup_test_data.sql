-- ============================================================================
-- CLEANUP TEST DATA
-- Remove todos os schedule_items e study_goals de teste
-- Criado em: 2025-01-16
-- ============================================================================

-- 1. Deletar todos os schedule_items
DELETE FROM schedule_items WHERE user_id IS NOT NULL;

-- 2. Deletar todas as study_goals
DELETE FROM study_goals WHERE user_id IS NOT NULL;

-- 3. Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup concluído!';
  RAISE NOTICE 'Schedule items removidos';
  RAISE NOTICE 'Study goals removidos';
END $$;
