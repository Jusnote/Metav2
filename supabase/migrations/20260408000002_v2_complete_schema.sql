-- =============================================
-- V2 COMPLETE SCHEMA
-- Novas tabelas + extensões para motor adaptativo
-- =============================================

-- Planos de estudo
CREATE TABLE IF NOT EXISTS planos_estudo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    nome            VARCHAR(200) NOT NULL,
    data_prova      TIMESTAMPTZ,
    source_type     VARCHAR(20) DEFAULT 'edital',
    study_mode      VARCHAR(20) DEFAULT 'continuo',
    target_score    DECIMAL(5,2),
    current_cycle   INTEGER DEFAULT 1,
    triage_enabled  BOOLEAN DEFAULT FALSE,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_planos_estudo_user ON planos_estudo(user_id);
ALTER TABLE planos_estudo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON planos_estudo
    FOR ALL USING (auth.uid() = user_id);

-- Vínculos plano ↔ edital/cargo
CREATE TABLE IF NOT EXISTS planos_editais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id        UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
    edital_id       INTEGER NOT NULL,
    cargo_id        INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plano_id, edital_id, cargo_id)
);
CREATE INDEX idx_planos_editais_plano ON planos_editais(plano_id);
ALTER TABLE planos_editais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan links" ON planos_editais
    FOR ALL USING (
        plano_id IN (SELECT id FROM planos_estudo WHERE user_id = auth.uid())
    );

-- Log detalhado de questões
CREATE TABLE IF NOT EXISTS questoes_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    topico_id           UUID REFERENCES topicos(id) ON DELETE SET NULL,
    questao_id          INTEGER,
    correto             BOOLEAN NOT NULL,
    tempo_resposta      INTEGER,
    dificuldade         DECIMAL(3,2),
    tipo_erro           VARCHAR(30),
    conceito_confundido VARCHAR(100),
    session_id          UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questoes_log_user ON questoes_log(user_id);
CREATE INDEX idx_questoes_log_topico ON questoes_log(topico_id);
ALTER TABLE questoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own question logs" ON questoes_log
    FOR ALL USING (auth.uid() = user_id);

-- Sessões de estudo
CREATE TABLE IF NOT EXISTS study_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    plano_id        UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    planned_minutes INTEGER,
    active_minutes  INTEGER,
    activities      JSONB,
    score_before    DECIMAL(5,2),
    score_after     DECIMAL(5,2),
    cycle           INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON study_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Snapshots de nota estimada
CREATE TABLE IF NOT EXISTS score_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    plano_id        UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
    score_current   DECIMAL(5,2),
    score_projected DECIMAL(5,2),
    pass_probability DECIMAL(3,2),
    breakdown       JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots" ON score_snapshots
    FOR ALL USING (auth.uid() = user_id);

-- FlashQuestões (infraestrutura pronta, implementação futura)
CREATE TABLE IF NOT EXISTS flash_questoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    topico_id       UUID REFERENCES topicos(id) ON DELETE SET NULL,
    questao_texto   TEXT NOT NULL,
    alternativas    JSONB NOT NULL,
    resposta_correta VARCHAR(1) NOT NULL,
    dificuldade     DECIMAL(3,2) DEFAULT 0.50,
    source          VARCHAR(20) DEFAULT 'manual',
    fsrs_stability  DECIMAL(10,2) DEFAULT 1.0,
    fsrs_difficulty DECIMAL(5,2) DEFAULT 0.3,
    next_review     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flash_questoes_user ON flash_questoes(user_id);
CREATE INDEX idx_flash_questoes_topico ON flash_questoes(topico_id);
CREATE INDEX idx_flash_questoes_review ON flash_questoes(next_review);
ALTER TABLE flash_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flash" ON flash_questoes
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- EXTENSÕES EM TABELAS EXISTENTES
-- =============================================

-- disciplinas: referências API + plano
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS api_disciplina_id INTEGER;
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL;
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual';
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS peso_edital DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS idx_disciplinas_api ON disciplinas(api_disciplina_id) WHERE api_disciplina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disciplinas_plano ON disciplinas(plano_id) WHERE plano_id IS NOT NULL;

-- topicos: referências API + modelo de aprendizado completo
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS api_topico_id INTEGER;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'manual';
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS mastery_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS learning_stage VARCHAR(20) DEFAULT 'new';
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS question_accuracy DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questions_total INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS speed_avg_seconds DECIMAL(7,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS retention_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS discrimination_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS fsrs_stability DECIMAL(10,2) DEFAULT 1.0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS fsrs_difficulty DECIMAL(5,2) DEFAULT 0.3;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS peso_edital DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS diagnostic_score DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS learning_rate DECIMAL(5,3) DEFAULT 0.15;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS marginal_gain DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS depends_on UUID[];
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS teoria_finalizada BOOLEAN DEFAULT FALSE;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questoes_acertos INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS questoes_erros INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS leis_lidas TEXT;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_topicos_api ON topicos(api_topico_id) WHERE api_topico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topicos_mastery ON topicos(mastery_score);
CREATE INDEX IF NOT EXISTS idx_topicos_stage ON topicos(learning_stage);

-- user_study_config: extensões v2
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS peak_hours TEXT[];
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS session_duration INTEGER DEFAULT 50;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS break_duration INTEGER DEFAULT 10;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS max_new_topics_per_day INTEGER DEFAULT 3;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS questions_per_day INTEGER DEFAULT 30;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS interleaving BOOLEAN DEFAULT TRUE;
ALTER TABLE user_study_config ADD COLUMN IF NOT EXISTS revision_style VARCHAR(10) DEFAULT 'hybrid';
