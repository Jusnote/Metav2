-- ============================================================================
-- CRONOGRAMA V2 — Clean Slate
-- Refatora o sistema de cronograma do zero com schema profissional.
-- Criado em: 2026-05-12
--
-- ATENÇÃO: este migration FAZ DROP das tabelas legadas:
--   - planos_estudo, planos_editais, study_goals, schedule_items
-- Faça backup antes de aplicar se houver dados que valem preservar.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP TABELAS LEGADAS (cascade remove dependências)
-- ============================================================================
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS study_goals CASCADE;
DROP TABLE IF EXISTS planos_editais CASCADE;
DROP TABLE IF EXISTS planos_estudo CASCADE;

-- Tipos enum (drop antes de recriar, caso existam)
DROP TYPE IF EXISTS schedule_item_type CASCADE;
DROP TYPE IF EXISTS schedule_item_status CASCADE;
DROP TYPE IF EXISTS plano_status CASCADE;
DROP TYPE IF EXISTS plano_mode CASCADE;

-- ============================================================================
-- 2. ENUMS
-- ============================================================================
CREATE TYPE plano_mode AS ENUM ('edital', 'continuo', 'misto');
CREATE TYPE plano_status AS ENUM ('rascunho', 'ativo', 'pausado', 'concluido', 'arquivado');
CREATE TYPE schedule_item_type AS ENUM (
  'estudo_inicial_p1',  -- estudo inicial parte 1 (teoria + flashcards intro)
  'estudo_inicial_p2',  -- parte 2 (questões + consolidação)
  'revisao',            -- revisão FSRS
  'questoes',           -- prática de questões avulsa
  'flashcards',         -- revisão de flashcards avulsa
  'simulado',           -- simulado
  'lei_seca'            -- leitura de lei seca / memorização
);
CREATE TYPE schedule_item_status AS ENUM (
  'pendente',
  'em_andamento',
  'concluido',
  'pulado',
  'cancelado',
  'reagendado'
);

-- ============================================================================
-- 3. planos_estudo (raiz da journey)
-- ============================================================================
CREATE TABLE planos_estudo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo_id INTEGER,                              -- FK externa (cargos)
  edital_id INTEGER,                             -- FK externa (editais)
  data_inicio DATE NOT NULL,
  data_prova DATE NOT NULL,
  target_score INTEGER,
  mode plano_mode NOT NULL DEFAULT 'edital',
  status plano_status NOT NULL DEFAULT 'rascunho',
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planos_dates_valid CHECK (data_prova > data_inicio)
);

-- Apenas 1 plano "ativo" por user
CREATE UNIQUE INDEX planos_one_active_per_user
  ON planos_estudo (user_id)
  WHERE status = 'ativo';

CREATE INDEX planos_user ON planos_estudo (user_id);
CREATE INDEX planos_status ON planos_estudo (status);

-- ============================================================================
-- 4. plano_config (1:1, configuração de carga horária)
-- ============================================================================
CREATE TABLE plano_config (
  plano_id UUID PRIMARY KEY REFERENCES planos_estudo(id) ON DELETE CASCADE,
  weekday_minutes INTEGER NOT NULL DEFAULT 180,    -- 3h padrão
  weekend_minutes INTEGER NOT NULL DEFAULT 240,    -- 4h padrão
  daily_exceptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- formato: { "2026-05-15": 0, "2026-05-20": 120 }
    -- 0 = pular dia, valor > 0 = override de minutos pro dia
  fsrs_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mix_ratio JSONB NOT NULL DEFAULT
    '{"teoria": 0.4, "questoes": 0.4, "revisao": 0.15, "flashcards": 0.05}'::jsonb,
  difficulty_weighting BOOLEAN NOT NULL DEFAULT TRUE,
  block_duration_minutes INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. plano_disciplinas (junção plano ↔ disciplinas com peso)
-- ============================================================================
CREATE TABLE plano_disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  peso INTEGER NOT NULL DEFAULT 5 CHECK (peso BETWEEN 1 AND 10),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plano_id, disciplina_id)
);

CREATE INDEX plano_disciplinas_plano ON plano_disciplinas (plano_id);

-- ============================================================================
-- 6. schedule_items (cada atividade individual)
-- ============================================================================
CREATE TABLE schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,                                -- opcional, horário preferido
  week_number INTEGER NOT NULL,                       -- computed via trigger
  type schedule_item_type NOT NULL,
  status schedule_item_status NOT NULL DEFAULT 'pendente',
  disciplina_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL,
  topico_id UUID REFERENCES topicos(id) ON DELETE SET NULL,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 50,
  actual_duration_minutes INTEGER,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 0 AND 10),
  parent_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  fsrs_state JSONB,                                   -- estado do FSRS (stability, difficulty, etc.)
  revision_number INTEGER NOT NULL DEFAULT 0,
  performance JSONB,                                  -- ratings + métricas pós-conclusão
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX schedule_items_user_date ON schedule_items (user_id, scheduled_date);
CREATE INDEX schedule_items_plano_week ON schedule_items (plano_id, week_number);
CREATE INDEX schedule_items_status_pending
  ON schedule_items (user_id, scheduled_date)
  WHERE status IN ('pendente', 'em_andamento');
CREATE INDEX schedule_items_parent ON schedule_items (parent_item_id) WHERE parent_item_id IS NOT NULL;

-- Trigger: compute week_number automaticamente
CREATE OR REPLACE FUNCTION compute_schedule_item_week_number()
RETURNS TRIGGER AS $$
DECLARE
  plano_start DATE;
BEGIN
  SELECT data_inicio INTO plano_start FROM planos_estudo WHERE id = NEW.plano_id;
  IF plano_start IS NOT NULL THEN
    NEW.week_number := FLOOR((NEW.scheduled_date - plano_start) / 7.0)::INTEGER + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_week_number
  BEFORE INSERT OR UPDATE OF scheduled_date, plano_id ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION compute_schedule_item_week_number();

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_planos_updated_at
  BEFORE UPDATE ON planos_estudo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plano_config_updated_at
  BEFORE UPDATE ON plano_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_schedule_items_updated_at
  BEFORE UPDATE ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. weekly_stats (agregados materializados, atualizados por trigger)
-- ============================================================================
CREATE TABLE weekly_stats (
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  items_total INTEGER NOT NULL DEFAULT 0,
  items_completed INTEGER NOT NULL DEFAULT 0,
  items_overdue INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0,
  minutes_estimated INTEGER NOT NULL DEFAULT 0,
  minutes_actual INTEGER NOT NULL DEFAULT 0,
  questoes_total INTEGER NOT NULL DEFAULT 0,
  questoes_correct INTEGER NOT NULL DEFAULT 0,
  desempenho_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN questoes_total > 0
         THEN (questoes_correct::NUMERIC / questoes_total) * 100
         ELSE 0 END
  ) STORED,
  completion_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN items_total > 0
         THEN (items_completed::NUMERIC / items_total) * 100
         ELSE 0 END
  ) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plano_id, week_number)
);

-- ============================================================================
-- 8. schedule_logs (audit trail / analytics)
-- ============================================================================
CREATE TABLE schedule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'completed', 'rescheduled', 'skipped', 'reset', 'cancelled', 'started'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX schedule_logs_user_time ON schedule_logs (user_id, created_at DESC);
CREATE INDEX schedule_logs_item ON schedule_logs (item_id);

-- ============================================================================
-- 9. achievements_catalog (definições estáticas das medalhas)
-- ============================================================================
CREATE TABLE achievements_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cronograma', 'questoes', 'revisoes', 'flashcards', 'misc'
  )),
  trigger_type TEXT NOT NULL,
    -- ex: 'questoes_count', 'streak_weeks', 'revisao_accuracy_90', 'revisao_accuracy_100'
  trigger_threshold INTEGER NOT NULL,
  icon_name TEXT NOT NULL,                            -- nome do ícone Lucide
  ordem INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX achievements_catalog_active ON achievements_catalog (active, ordem);

-- ============================================================================
-- 10. user_achievements (estado por usuário)
-- ============================================================================
CREATE TABLE user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements_catalog(id) ON DELETE CASCADE,
  progress NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  current_value INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX user_achievements_user ON user_achievements (user_id);
CREATE INDEX user_achievements_unlocked
  ON user_achievements (user_id, unlocked_at)
  WHERE unlocked_at IS NOT NULL;

-- ============================================================================
-- 11. SEED: catálogo de medalhas (14 medalhas iniciais)
-- ============================================================================
INSERT INTO achievements_catalog
  (slug, title, description, category, trigger_type, trigger_threshold, icon_name, ordem)
VALUES
  ('primeiros-passos',    'Primeiros passos',    'Complete 5 questões',                'questoes',   'questoes_count',         5,    'Star',       1),
  ('foco-inicial',        'Foco inicial',        'Complete 10 questões',               'questoes',   'questoes_count',         10,   'Target',     2),
  ('sequencia-iniciante', 'Sequência iniciante', 'Estude 3 semanas seguidas',          'cronograma', 'streak_weeks',           3,    'Flame',      3),
  ('estudioso',           'Estudioso',           'Complete 25 questões',               'questoes',   'questoes_count',         25,   'BookOpen',   4),
  ('mente-ativa',         'Mente ativa',         'Complete 50 questões',               'questoes',   'questoes_count',         50,   'Brain',      5),
  ('ritmo-constante',     'Ritmo constante',     'Estude 5 semanas seguidas',          'cronograma', 'streak_weeks',           5,    'Zap',        6),
  ('disciplina',          'Disciplina',          'Estude 10 semanas seguidas',         'cronograma', 'streak_weeks',           10,   'Medal',      7),
  ('dedicado',            'Dedicado',            'Complete 100 questões',              'questoes',   'questoes_count',         100,  'Heart',      8),
  ('foco-maximo',         'Foco máximo',         'Complete 200 questões',              'questoes',   'questoes_count',         200,  'Crosshair',  9),
  ('sequencia-avancada',  'Sequência avançada',  'Estude 15 semanas seguidas',         'cronograma', 'streak_weeks',           15,   'TrendingUp', 10),
  ('mestre-dos-estudos',  'Mestre dos estudos',  'Complete 500 questões',              'questoes',   'questoes_count',         500,  'Trophy',     11),
  ('lenda-do-saber',      'Lenda do saber',      'Complete 1000 questões',             'questoes',   'questoes_count',         1000, 'Crown',      12),
  ('imbativel',           'Imbatível',           'Acertar 90% ou mais em 50 revisões', 'revisoes',   'revisao_accuracy_90',    50,   'Rocket',     13),
  ('perfeccionista',      'Perfeccionista',      'Acertar 100% em 10 revisões',        'revisoes',   'revisao_accuracy_100',   10,   'Gem',        14);

-- ============================================================================
-- 12. RLS — Row Level Security
-- ============================================================================
ALTER TABLE planos_estudo ENABLE ROW LEVEL SECURITY;
CREATE POLICY planos_user_own ON planos_estudo
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE plano_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY plano_config_user_own ON plano_config
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM planos_estudo
    WHERE id = plano_config.plano_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM planos_estudo
    WHERE id = plano_config.plano_id AND user_id = auth.uid()
  ));

ALTER TABLE plano_disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY plano_disciplinas_user_own ON plano_disciplinas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM planos_estudo
    WHERE id = plano_disciplinas.plano_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM planos_estudo
    WHERE id = plano_disciplinas.plano_id AND user_id = auth.uid()
  ));

ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_items_user_own ON schedule_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE weekly_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_stats_user_own ON weekly_stats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM planos_estudo
    WHERE id = weekly_stats.plano_id AND user_id = auth.uid()
  ));

ALTER TABLE schedule_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_logs_user_own ON schedule_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE achievements_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievements_catalog_public_read ON achievements_catalog
  FOR SELECT TO authenticated USING (active = TRUE);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_achievements_user_own ON user_achievements
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
