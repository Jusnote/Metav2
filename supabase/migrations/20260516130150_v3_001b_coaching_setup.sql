-- V3 Migration 001b — Cleanup do estado parcial em public + setup completo em coaching
-- Executa após 001 e 002 (já registrados no remote com conteúdo antigo/public)
-- Refs: doc 04 (schema), doc 10 (fase 1)

-- ============================================================
-- PARTE 1: Limpar artefatos V3 que foram criados em public
-- ============================================================

-- Tabelas que migration 002 (versão antiga) criou em public
DROP TABLE IF EXISTS public.editais_raw CASCADE;
DROP TABLE IF EXISTS public.concursos CASCADE;

-- Enums que migration 001 (versão antiga) possa ter criado em public
DROP TYPE IF EXISTS public.status_concurso CASCADE;
DROP TYPE IF EXISTS public.role_aluno CASCADE;
DROP TYPE IF EXISTS public.horario_pico CASCADE;
DROP TYPE IF EXISTS public.status_semana CASCADE;
DROP TYPE IF EXISTS public.tipo_atividade CASCADE;
DROP TYPE IF EXISTS public.status_atividade CASCADE;
DROP TYPE IF EXISTS public.origem_atividade CASCADE;
DROP TYPE IF EXISTS public.estado_fsrs CASCADE;
DROP TYPE IF EXISTS public.natureza_atividade CASCADE;
DROP TYPE IF EXISTS public.tipo_conteudo CASCADE;
DROP TYPE IF EXISTS public.tipo_questao CASCADE;

-- Função trigger que migration 001 (versão antiga) criou em public
DROP FUNCTION IF EXISTS public.update_atualizado_em() CASCADE;

-- ============================================================
-- PARTE 2: Schema coaching e infraestrutura base (conteúdo de 001 correto)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS coaching;
GRANT USAGE ON SCHEMA coaching TO authenticated, service_role, anon;
GRANT ALL ON SCHEMA coaching TO postgres, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE OR REPLACE FUNCTION coaching.update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PARTE 3: Tabelas de concursos e editais (conteúdo de 002 correto)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.concursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banca TEXT NOT NULL,
  cargo TEXT NOT NULL,
  nivel TEXT,
  data_prova DATE,
  edital_url TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'revisao', 'publicado', 'arquivado')),
  publicado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concursos_status
  ON coaching.concursos(status) WHERE status = 'publicado';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_concursos_atualizado'
      AND tgrelid = 'coaching.concursos'::regclass
  ) THEN
    CREATE TRIGGER trg_concursos_atualizado
      BEFORE UPDATE ON coaching.concursos
      FOR EACH ROW EXECUTE FUNCTION coaching.update_atualizado_em();
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS coaching.editais_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id UUID NOT NULL REFERENCES coaching.concursos(id) ON DELETE CASCADE,
  texto_bruto TEXT NOT NULL,
  fonte TEXT CHECK (fonte IN ('pdf', 'colado', 'url')),
  url_original TEXT,
  versao INT NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editais_concurso
  ON coaching.editais_raw(concurso_id, versao DESC);
