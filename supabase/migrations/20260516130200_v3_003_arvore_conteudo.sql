-- V3 Migration 003 — Árvore de conteúdo: disciplinas, blocos, tópicos, subtópicos
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- REESCRITO: tabelas em coaching.* (resolve colisão com public.disciplinas/topicos V2)

CREATE TABLE coaching.disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id UUID NOT NULL REFERENCES coaching.concursos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_totais NUMERIC(5,1) NOT NULL,
  nivel TEXT CHECK (nivel IN ('basico', 'intermediario', 'avancado')),
  cor TEXT DEFAULT 'azul', -- chave para mapeamento no front
  ordem INT NOT NULL,
  observacoes_globais JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concurso_id, ordem)
);

CREATE INDEX idx_disciplinas_concurso ON coaching.disciplinas(concurso_id, ordem);

CREATE TRIGGER trg_disciplinas_atualizado
  BEFORE UPDATE ON coaching.disciplinas
  FOR EACH ROW EXECUTE FUNCTION coaching.update_atualizado_em();

CREATE TABLE coaching.blocos_tematicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disciplina_id UUID NOT NULL REFERENCES coaching.disciplinas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_bloco NUMERIC(5,1),
  ordem INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(disciplina_id, ordem)
);

CREATE INDEX idx_blocos_disciplina ON coaching.blocos_tematicos(disciplina_id, ordem);

CREATE TABLE coaching.topicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id UUID NOT NULL REFERENCES coaching.blocos_tematicos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN (
    'doutrina', 'doutrina_pratica', 'pratica', 'pratica_intensiva',
    'lei_seca', 'lei_seca_mais_doutrina', 'jurisprudencia', 'misto'
  )),
  peso_incidencia INT NOT NULL CHECK (peso_incidencia BETWEEN 1 AND 5),
  horas_sugeridas NUMERIC(4,1) NOT NULL,
  tipo_revisao TEXT,
  observacao TEXT,
  pre_requisito_topico_id UUID REFERENCES coaching.topicos(id),
  ordem INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bloco_id, ordem)
);

CREATE INDEX idx_topicos_bloco ON coaching.topicos(bloco_id, ordem);
CREATE INDEX idx_topicos_peso ON coaching.topicos(peso_incidencia DESC);

CREATE TRIGGER trg_topicos_atualizado
  BEFORE UPDATE ON coaching.topicos
  FOR EACH ROW EXECUTE FUNCTION coaching.update_atualizado_em();

CREATE TABLE coaching.subtopicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES coaching.topicos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_sugeridas NUMERIC(4,1),
  ordem INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topico_id, ordem)
);

CREATE INDEX idx_subtopicos_topico ON coaching.subtopicos(topico_id, ordem);
