-- V3 Migration 004 — Conteúdos e questões
-- Refs: doc 04 (schema), doc 10 (fase 1)

CREATE TABLE conteudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES topicos(id) ON DELETE CASCADE,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'teoria', 'lei_seca', 'resumo', 'mapa_mental', 'jurisprudencia'
  )),
  titulo TEXT NOT NULL,
  corpo_json JSONB NOT NULL, -- saída do Tiptap
  duracao_estimada_min INT NOT NULL DEFAULT 30,
  ordem INT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conteudos_topico ON conteudos(topico_id, ativo) WHERE ativo = true;
CREATE INDEX idx_conteudos_subtopico ON conteudos(subtopico_id) WHERE subtopico_id IS NOT NULL;

CREATE TRIGGER trg_conteudos_atualizado
  BEFORE UPDATE ON conteudos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TABLE questoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES topicos(id) ON DELETE CASCADE,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE SET NULL,
  enunciado TEXT NOT NULL,
  alternativas JSONB, -- [{"letra":"A","texto":"..."}]
  gabarito TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('certo_errado', 'multipla_escolha')),
  banca TEXT,
  ano INT,
  comentario_json JSONB, -- saída do Tiptap com a análise do mentor
  dificuldade_estimada INT CHECK (dificuldade_estimada BETWEEN 1 AND 5),
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questoes_topico ON questoes(topico_id, ativa) WHERE ativa = true;
CREATE INDEX idx_questoes_subtopico ON questoes(subtopico_id) WHERE subtopico_id IS NOT NULL;
CREATE INDEX idx_questoes_banca_ano ON questoes(banca, ano);

CREATE TRIGGER trg_questoes_atualizado
  BEFORE UPDATE ON questoes
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
