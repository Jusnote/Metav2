-- V3 Migration 006 — Semanas e atividades
-- Refs: doc 04 (schema), doc 10 (fase 1)

CREATE TABLE semanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  numero INT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'bloqueada'
    CHECK (status IN ('bloqueada', 'atual', 'concluida')),
  qualidade_pct NUMERIC(5,2),
  horas_planejadas NUMERIC(5,1),
  horas_estudadas NUMERIC(5,1) DEFAULT 0,
  concluida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, numero)
);

CREATE INDEX idx_semanas_aluno_status ON semanas(aluno_id, status);
CREATE INDEX idx_semanas_atual ON semanas(aluno_id) WHERE status = 'atual';

CREATE TABLE atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  topico_id UUID REFERENCES topicos(id),
  subtopico_id UUID REFERENCES subtopicos(id),
  conteudo_id UUID REFERENCES conteudos(id),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'teoria', 'questoes', 'lei_seca', 'resumo',
    'mapa_mental', 'revisao_fsrs', 'simulado'
  )),
  titulo TEXT NOT NULL,
  duracao_estimada_min INT NOT NULL,
  duracao_real_min INT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'pulada')),
  desempenho_pct NUMERIC(5,2),
  peso_incidencia INT,
  origem TEXT NOT NULL DEFAULT 'planejada'
    CHECK (origem IN ('planejada', 'fsrs_due', 'reforco_manual')),
  ordem_sugerida INT,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_atividades_aluno_semana ON atividades(aluno_id, semana_id);
CREATE INDEX idx_atividades_pendentes ON atividades(aluno_id, status) WHERE status = 'pendente';
CREATE INDEX idx_atividades_fsrs_due ON atividades(aluno_id, origem) WHERE origem = 'fsrs_due';
CREATE INDEX idx_atividades_topico ON atividades(topico_id, status);
