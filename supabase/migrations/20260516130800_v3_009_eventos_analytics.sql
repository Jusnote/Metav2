-- V3 Migration 009 — Eventos e analytics
-- Refs: doc 04 (schema), doc 10 (fase 1)

-- Para registrar eventos de produto (não dados sensíveis)
CREATE TABLE eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES alunos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- onboarding_iniciado, atividade_concluida, etc
  payload JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eventos_aluno_tipo ON eventos(aluno_id, tipo, criado_em DESC);
CREATE INDEX idx_eventos_tipo ON eventos(tipo, criado_em DESC);
