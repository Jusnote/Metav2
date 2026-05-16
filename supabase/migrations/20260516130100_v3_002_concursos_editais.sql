-- V3 Migration 002 — Concursos e edital
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- REESCRITO: tabelas em coaching.*

CREATE TABLE coaching.concursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banca TEXT NOT NULL,
  cargo TEXT NOT NULL,
  nivel TEXT, -- medio | superior
  data_prova DATE,
  edital_url TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'revisao', 'publicado', 'arquivado')),
  publicado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_concursos_status ON coaching.concursos(status) WHERE status = 'publicado';

CREATE TRIGGER trg_concursos_atualizado
  BEFORE UPDATE ON coaching.concursos
  FOR EACH ROW EXECUTE FUNCTION coaching.update_atualizado_em();

CREATE TABLE coaching.editais_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id UUID NOT NULL REFERENCES coaching.concursos(id) ON DELETE CASCADE,
  texto_bruto TEXT NOT NULL,
  fonte TEXT CHECK (fonte IN ('pdf', 'colado', 'url')),
  url_original TEXT,
  versao INT NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_editais_concurso ON coaching.editais_raw(concurso_id, versao DESC);
