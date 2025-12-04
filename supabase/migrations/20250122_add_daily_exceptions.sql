-- ============================================================================
-- ADD DAILY EXCEPTIONS TO USER STUDY CONFIG
-- Permite usuário customizar disponibilidade de dias específicos
-- Criado em: 2025-01-22
-- ============================================================================

-- Adicionar campo para exceções diárias
ALTER TABLE user_study_config
ADD COLUMN IF NOT EXISTS daily_exceptions JSONB DEFAULT '{}'::JSONB;

-- Comentário explicativo
COMMENT ON COLUMN user_study_config.daily_exceptions IS
'Exceções de disponibilidade para dias específicos.
Formato: { "2025-01-23": { "hours": 6, "reason": "Folga" }, ... }';

-- ============================================================================
-- INDEX para busca eficiente
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_study_config_daily_exceptions
  ON user_study_config USING GIN (daily_exceptions);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_study_config'
    AND column_name = 'daily_exceptions'
  ) THEN
    RAISE NOTICE '✅ Campo daily_exceptions adicionado com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Campo daily_exceptions não foi adicionado';
  END IF;
END $$;
