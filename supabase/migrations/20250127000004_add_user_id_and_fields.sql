-- Adicionar user_id e outros campos necessários às tabelas

-- Adicionar colunas à tabela units
ALTER TABLE units ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;

-- Adicionar colunas à tabela topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS total_aulas INTEGER DEFAULT 0;

-- Adicionar colunas à tabela subtopics
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not-started';
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS total_aulas INTEGER DEFAULT 0;
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS tempo TEXT DEFAULT '0min';
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS resumos_vinculados INTEGER DEFAULT 0;
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS flashcards_vinculados INTEGER DEFAULT 0;
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS questoes_vinculadas INTEGER DEFAULT 0;

-- Criar índices para user_id
CREATE INDEX IF NOT EXISTS idx_units_user_id ON units(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_user_id ON subtopics(user_id);

-- Atualizar políticas RLS para usar user_id
DROP POLICY IF EXISTS "Users can manage their own units" ON units;
DROP POLICY IF EXISTS "Users can manage their own topics" ON topics;
DROP POLICY IF EXISTS "Users can manage their own subtopics" ON subtopics;

-- Criar novas políticas RLS baseadas em user_id
CREATE POLICY "Users can manage their own units" ON units
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own topics" ON topics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subtopics" ON subtopics
  FOR ALL USING (auth.uid() = user_id);

-- Adicionar constraint para garantir que status seja válido
ALTER TABLE subtopics ADD CONSTRAINT check_status 
  CHECK (status IN ('not-started', 'in-progress', 'completed'));