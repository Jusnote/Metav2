-- V3 Migration 005 — Alunos
-- Refs: doc 04 (schema), doc 10 (fase 1)

CREATE TABLE alunos (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  concurso_id UUID REFERENCES concursos(id),
  data_inicio DATE DEFAULT CURRENT_DATE,
  horas_por_dia JSONB NOT NULL DEFAULT
    '{"seg":2,"ter":2,"qua":2,"qui":2,"sex":2,"sab":4,"dom":2}'::jsonb,
  horario_pico TEXT DEFAULT 'manha' CHECK (horario_pico IN ('manha', 'tarde', 'noite')),
  role TEXT NOT NULL DEFAULT 'aluno' CHECK (role IN ('aluno', 'admin')),
  onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  deletado_em TIMESTAMPTZ
);

CREATE INDEX idx_alunos_concurso ON alunos(concurso_id) WHERE deletado_em IS NULL;
CREATE INDEX idx_alunos_role ON alunos(role);

CREATE TRIGGER trg_alunos_atualizado
  BEFORE UPDATE ON alunos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
