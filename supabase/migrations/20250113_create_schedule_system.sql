-- ============================================================================
-- INTEGRATION PLAN - PHASE 1: DATABASE INFRASTRUCTURE
-- Sistema de Agendamento e Metas de Estudo
-- Criado em: 2025-01-13
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELAS (ORDEM CORRETA DE DEPENDÊNCIAS)
-- ============================================================================

-- 1.1 Criar goal_templates PRIMEIRO (não tem dependências)
CREATE TABLE IF NOT EXISTS goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  intensity TEXT DEFAULT 'moderate',
  is_system BOOLEAN DEFAULT FALSE, -- templates do sistema vs usuário
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL se for template do sistema

  -- Configurações de distribuição
  distribution_config JSONB, -- { reviewsPerWeek: 5, sessionsPerDay: 2, restDays: [0, 6] }

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT goal_templates_intensity_values CHECK (intensity IN ('light', 'moderate', 'intensive')),
  CONSTRAINT duration_positive CHECK (duration_days > 0),
  CONSTRAINT system_template_no_user CHECK (
    (is_system = TRUE AND user_id IS NULL) OR
    (is_system = FALSE AND user_id IS NOT NULL)
  )
);

-- 1.2 Criar study_goals SEGUNDO (depende de goal_templates)
CREATE TABLE IF NOT EXISTS study_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Escopo (NULL = meta global)
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Dados da meta
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,

  -- Configurações
  enable_fsrs BOOLEAN DEFAULT TRUE,
  intensity TEXT DEFAULT 'moderate', -- 'light', 'moderate', 'intensive'

  -- Progresso
  progress_percentage INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Templates
  template_id UUID REFERENCES goal_templates(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT progress_range CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  CONSTRAINT study_goals_intensity_values CHECK (intensity IN ('light', 'moderate', 'intensive')),
  CONSTRAINT date_order CHECK (target_date >= start_date)
);

-- 1.3 Criar schedule_items TERCEIRO (depende de study_goals)
CREATE TABLE IF NOT EXISTS schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Referências hierárquicas (NULL se for item externo)
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  subtopic_id UUID REFERENCES subtopics(id) ON DELETE SET NULL,

  -- Dados básicos
  title TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Sincronização
  sync_enabled BOOLEAN DEFAULT TRUE,

  -- Tipo de item
  item_type TEXT DEFAULT 'normal', -- 'normal', 'goal', 'external'
  study_goal_id UUID REFERENCES study_goals(id) ON DELETE SET NULL,

  -- Performance tracking
  estimated_duration INTEGER, -- minutos estimados
  actual_duration INTEGER, -- tempo real gasto
  priority INTEGER DEFAULT 5, -- 1-10
  notes TEXT,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT priority_range CHECK (priority >= 1 AND priority <= 10),
  CONSTRAINT item_type_values CHECK (item_type IN ('normal', 'goal', 'external'))
);

-- 1.4 Criar sync_history POR ÚLTIMO (depende de schedule_items)
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schedule_item_id UUID REFERENCES schedule_items(id) ON DELETE CASCADE,

  changed_field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,

  sync_source TEXT, -- 'cronograma', 'documents', 'auto'
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT sync_source_values CHECK (sync_source IN ('cronograma', 'documents', 'auto'))
);

-- ============================================================================
-- 2. CRIAR INDEXES PARA PERFORMANCE
-- ============================================================================

-- schedule_items indexes
CREATE INDEX IF NOT EXISTS idx_schedule_items_user_date
  ON schedule_items(user_id, scheduled_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_items_user_completed
  ON schedule_items(user_id, completed)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_items_goal
  ON schedule_items(study_goal_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_items_hierarchy
  ON schedule_items(user_id, unit_id, topic_id, subtopic_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_items_completed_at
  ON schedule_items(completed_at DESC)
  WHERE completed = TRUE AND deleted_at IS NULL;

-- study_goals indexes
CREATE INDEX IF NOT EXISTS idx_study_goals_user_dates
  ON study_goals(user_id, start_date, target_date);

CREATE INDEX IF NOT EXISTS idx_study_goals_unit
  ON study_goals(unit_id)
  WHERE unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_study_goals_active
  ON study_goals(user_id, completed)
  WHERE completed = FALSE;

-- goal_templates indexes
CREATE INDEX IF NOT EXISTS idx_goal_templates_system
  ON goal_templates(is_system);

CREATE INDEX IF NOT EXISTS idx_goal_templates_user
  ON goal_templates(user_id)
  WHERE user_id IS NOT NULL;

-- sync_history indexes (para debugging)
CREATE INDEX IF NOT EXISTS idx_sync_history_item
  ON sync_history(schedule_item_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_history_user
  ON sync_history(user_id, synced_at DESC);

-- ============================================================================
-- 3. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3.1 RLS POLICIES: schedule_items
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own schedule items" ON schedule_items;
DROP POLICY IF EXISTS "Users can insert own schedule items" ON schedule_items;
DROP POLICY IF EXISTS "Users can update own schedule items" ON schedule_items;
DROP POLICY IF EXISTS "Users can soft delete own schedule items" ON schedule_items;

-- Policies
CREATE POLICY "Users can view own schedule items"
  ON schedule_items FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own schedule items"
  ON schedule_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule items"
  ON schedule_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can soft delete own schedule items"
  ON schedule_items FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3.2 RLS POLICIES: study_goals
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own study goals" ON study_goals;
DROP POLICY IF EXISTS "Users can insert own study goals" ON study_goals;
DROP POLICY IF EXISTS "Users can update own study goals" ON study_goals;
DROP POLICY IF EXISTS "Users can delete own study goals" ON study_goals;

CREATE POLICY "Users can view own study goals"
  ON study_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study goals"
  ON study_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study goals"
  ON study_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study goals"
  ON study_goals FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3.3 RLS POLICIES: goal_templates
-- ============================================================================

DROP POLICY IF EXISTS "Users can view system templates and own templates" ON goal_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON goal_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON goal_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON goal_templates;

CREATE POLICY "Users can view system templates and own templates"
  ON goal_templates FOR SELECT
  USING (is_system = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON goal_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can update own templates"
  ON goal_templates FOR UPDATE
  USING (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can delete own templates"
  ON goal_templates FOR DELETE
  USING (auth.uid() = user_id AND is_system = FALSE);

-- ============================================================================
-- 3.4 RLS POLICIES: sync_history
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own sync history" ON sync_history;
DROP POLICY IF EXISTS "System can insert sync history" ON sync_history;

CREATE POLICY "Users can view own sync history"
  ON sync_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync history"
  ON sync_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. CRIAR FUNCTIONS E TRIGGERS
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para schedule_items
DROP TRIGGER IF EXISTS update_schedule_items_updated_at ON schedule_items;
CREATE TRIGGER update_schedule_items_updated_at
  BEFORE UPDATE ON schedule_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers para study_goals
DROP TRIGGER IF EXISTS update_study_goals_updated_at ON study_goals;
CREATE TRIGGER update_study_goals_updated_at
  BEFORE UPDATE ON study_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. SEED DATA (TEMPLATES DO SISTEMA)
-- ============================================================================

-- Inserir templates apenas se não existirem
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

-- ============================================================================
-- 6. HABILITAR REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Nota: Execute este comando apenas se a publication supabase_realtime já existir
-- Se der erro, ignore (significa que já está configurado)

DO $$
BEGIN
  -- Tentar adicionar tabelas ao realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_items;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'schedule_items já está no realtime ou publication não existe';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE study_goals;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'study_goals já está no realtime ou publication não existe';
  END;
END $$;

-- ============================================================================
-- 7. VERIFICAÇÕES FINAIS
-- ============================================================================

-- Contar tabelas criadas
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('schedule_items', 'study_goals', 'goal_templates', 'sync_history');

  RAISE NOTICE 'Tabelas criadas: %', table_count;

  IF table_count = 4 THEN
    RAISE NOTICE '✅ Todas as 4 tabelas foram criadas com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Apenas % de 4 tabelas foram criadas', table_count;
  END IF;
END $$;

-- Contar templates inseridos
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count
  FROM goal_templates
  WHERE is_system = TRUE;

  RAISE NOTICE 'Templates do sistema: %', template_count;

  IF template_count = 4 THEN
    RAISE NOTICE '✅ Todos os 4 templates foram inseridos com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Apenas % de 4 templates foram inseridos', template_count;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETA!
-- ============================================================================

-- Mensagem final de sucesso
DO $$
BEGIN
  RAISE NOTICE '🎉 Phase 1: Database Infrastructure - COMPLETA!';
  RAISE NOTICE 'Para testar, execute: SELECT * FROM goal_templates WHERE is_system = TRUE;';
END $$;
