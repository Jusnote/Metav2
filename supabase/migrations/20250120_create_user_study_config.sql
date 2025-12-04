-- ============================================================================
-- CREATE USER STUDY CONFIG TABLE
-- Configurações personalizadas de estudo por usuário
-- Criado em: 2025-01-20
-- ============================================================================

-- Criar tabela de configurações
CREATE TABLE IF NOT EXISTS user_study_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- ============================================================================
  -- SEÇÃO 1: ESSENCIAL (Disponibilidade)
  -- ============================================================================
  weekday_hours DECIMAL DEFAULT 3.0, -- Horas/dia Seg-Sex
  weekend_hours DECIMAL DEFAULT 5.0, -- Horas/dia Sáb-Dom
  study_saturday BOOLEAN DEFAULT TRUE,
  study_sunday BOOLEAN DEFAULT TRUE,
  preferred_session_duration INTEGER DEFAULT 90, -- minutos (curtas=45, médias=90, longas=120)

  -- ============================================================================
  -- SEÇÃO 2: HORÁRIOS PREFERENCIAIS (Opcional)
  -- ============================================================================
  preferred_times TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['morning', 'afternoon', 'night', 'dawn']
  avoid_times TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- ============================================================================
  -- SEÇÃO 3: PREFERÊNCIAS DE ESTUDO (Opcional)
  -- ============================================================================
  fsrs_aggressiveness TEXT DEFAULT 'balanced', -- 'aggressive', 'balanced', 'spaced'

  -- ============================================================================
  -- SEÇÃO 4: METAS E CONTEXTO (Opcional)
  -- ============================================================================
  has_exam BOOLEAN DEFAULT FALSE,
  exam_date DATE,
  study_goal_type TEXT DEFAULT 'continuous', -- 'exam', 'continuous', 'review'

  -- ============================================================================
  -- METADADOS (Sistema aprende automaticamente)
  -- ============================================================================
  metadata JSONB DEFAULT jsonb_build_object(
    'speedMultiplier', 1.0,
    'productiveHours', jsonb_build_object(),
    'completionRate', jsonb_build_object(),
    'lastLearningUpdate', null,
    'setupCompleted', false,
    'completedSections', jsonb_build_array()
  ),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT weekday_hours_range CHECK (weekday_hours >= 0 AND weekday_hours <= 24),
  CONSTRAINT weekend_hours_range CHECK (weekend_hours >= 0 AND weekend_hours <= 24),
  CONSTRAINT session_duration_valid CHECK (preferred_session_duration >= 15 AND preferred_session_duration <= 240),
  CONSTRAINT fsrs_aggressiveness_values CHECK (fsrs_aggressiveness IN ('aggressive', 'balanced', 'spaced')),
  CONSTRAINT study_goal_type_values CHECK (study_goal_type IN ('exam', 'continuous', 'review'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_study_config_user
  ON user_study_config(user_id);

CREATE INDEX IF NOT EXISTS idx_user_study_config_exam_date
  ON user_study_config(exam_date)
  WHERE has_exam = TRUE AND exam_date IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_study_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own study config" ON user_study_config;
DROP POLICY IF EXISTS "Users can insert own study config" ON user_study_config;
DROP POLICY IF EXISTS "Users can update own study config" ON user_study_config;

-- Policies
CREATE POLICY "Users can view own study config"
  ON user_study_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study config"
  ON user_study_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study config"
  ON user_study_config FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_user_study_config_updated_at ON user_study_config;

CREATE TRIGGER update_user_study_config_updated_at
  BEFORE UPDATE ON user_study_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Get or Create User Config (Helper)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_user_study_config(p_user_id UUID)
RETURNS user_study_config AS $$
DECLARE
  v_config user_study_config;
BEGIN
  -- Tentar buscar config existente
  SELECT * INTO v_config
  FROM user_study_config
  WHERE user_id = p_user_id;

  -- Se não existir, criar com defaults
  IF NOT FOUND THEN
    INSERT INTO user_study_config (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_config;
  END IF;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICAÇÕES FINAIS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_study_config'
  ) THEN
    RAISE NOTICE '✅ Tabela user_study_config criada com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Tabela user_study_config não foi criada';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETA!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🎉 User Study Config - COMPLETO!';
  RAISE NOTICE 'Próximo passo: Criar hook useStudyConfig()';
END $$;
