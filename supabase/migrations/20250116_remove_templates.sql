-- ============================================================================
-- REMOVE TEMPLATE SYSTEM
-- Remove goal_templates table and template_id from study_goals
-- Criado em: 2025-01-16
-- ============================================================================

-- 1. Remove FK constraint and column from study_goals
ALTER TABLE study_goals DROP CONSTRAINT IF EXISTS study_goals_template_id_fkey;
ALTER TABLE study_goals DROP COLUMN IF EXISTS template_id;

-- 2. Drop goal_templates table
DROP TABLE IF EXISTS goal_templates CASCADE;

-- 3. Verificação final
DO $$
BEGIN
  RAISE NOTICE '✅ Template system removed successfully!';
  RAISE NOTICE 'Removed: goal_templates table';
  RAISE NOTICE 'Removed: study_goals.template_id column';
END $$;
