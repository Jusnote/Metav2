-- V3 Migration 007 — FSRS: cards e log de revisões
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- REESCRITO: tabelas em coaching.*

CREATE TABLE coaching.fsrs_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES coaching.alunos(id) ON DELETE CASCADE,
  subtopico_id UUID NOT NULL REFERENCES coaching.subtopicos(id) ON DELETE CASCADE,
  difficulty NUMERIC(8,4) NOT NULL,
  stability NUMERIC(8,4) NOT NULL,
  retrievability NUMERIC(8,4),
  state TEXT NOT NULL CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  due_date TIMESTAMPTZ NOT NULL,
  last_review TIMESTAMPTZ,
  review_count INT NOT NULL DEFAULT 0,
  lapse_count INT NOT NULL DEFAULT 0,
  scheduled_days INT NOT NULL DEFAULT 0,
  elapsed_days INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, subtopico_id)
);

CREATE INDEX idx_fsrs_due ON coaching.fsrs_cards(aluno_id, due_date);
CREATE INDEX idx_fsrs_state ON coaching.fsrs_cards(aluno_id, state);
CREATE INDEX idx_fsrs_retrievability ON coaching.fsrs_cards(aluno_id, retrievability) WHERE retrievability IS NOT NULL;

CREATE TRIGGER trg_fsrs_cards_atualizado
  BEFORE UPDATE ON coaching.fsrs_cards
  FOR EACH ROW EXECUTE FUNCTION coaching.update_atualizado_em();

CREATE TABLE coaching.fsrs_reviews_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES coaching.fsrs_cards(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES coaching.alunos(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 4),
  acertos INT NOT NULL,
  total_questoes INT NOT NULL,
  taxa_acerto NUMERIC(5,2) NOT NULL,
  duracao_segundos INT,
  difficulty_antes NUMERIC(8,4) NOT NULL,
  stability_antes NUMERIC(8,4) NOT NULL,
  difficulty_depois NUMERIC(8,4) NOT NULL,
  stability_depois NUMERIC(8,4) NOT NULL,
  due_anterior TIMESTAMPTZ,
  due_proxima TIMESTAMPTZ NOT NULL,
  revisado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_card ON coaching.fsrs_reviews_log(card_id, revisado_em DESC);
CREATE INDEX idx_reviews_aluno ON coaching.fsrs_reviews_log(aluno_id, revisado_em DESC);
