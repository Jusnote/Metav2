-- V3 Migration 008 — Tentativas de questões
-- Refs: doc 04 (schema), doc 10 (fase 1)

CREATE TABLE tentativas_questoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  questao_id UUID NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  atividade_id UUID REFERENCES atividades(id) ON DELETE SET NULL,
  resposta TEXT NOT NULL,
  acertou BOOLEAN NOT NULL,
  tempo_segundos INT NOT NULL,
  comentario_lido BOOLEAN DEFAULT false,
  respondida_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tentativas_aluno ON tentativas_questoes(aluno_id, respondida_em DESC);
CREATE INDEX idx_tentativas_questao ON tentativas_questoes(questao_id, aluno_id);
CREATE INDEX idx_tentativas_atividade ON tentativas_questoes(atividade_id) WHERE atividade_id IS NOT NULL;
