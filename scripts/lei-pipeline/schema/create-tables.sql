-- scripts/lei-pipeline/schema/create-tables.sql
--
-- PostgreSQL DDL for the lei-seca pipeline.
-- Run once on the target database (Hetzner).
--
-- Usage:
--   psql "$DATABASE_URL" -f create-tables.sql

-- ── leis ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leis (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  apelido TEXT,
  ementa TEXT,
  tipo TEXT NOT NULL,
  nivel TEXT NOT NULL DEFAULT 'FEDERAL',
  estado TEXT,
  data DATE,
  status TEXT DEFAULT 'ATIVO',
  is_active BOOLEAN DEFAULT true,
  hierarquia JSONB NOT NULL,
  raw_metadata JSONB,
  doc_id INT,
  publisher JSONB,
  parent_document JSONB,
  published_date TEXT,
  updated_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(apelido,'') || ' ' || coalesce(ementa,''))
  ) STORED
);

-- ── dispositivos ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dispositivos (
  id BIGINT PRIMARY KEY,
  lei_id TEXT NOT NULL REFERENCES leis(id),
  tipo TEXT NOT NULL,
  numero TEXT,
  texto TEXT NOT NULL,
  raw_description TEXT NOT NULL,
  epigrafe TEXT,
  pena TEXT,
  anotacoes JSONB,
  links JSONB,
  revogado BOOLEAN DEFAULT false,
  posicao INT NOT NULL,
  path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(texto,'') || ' ' || coalesce(epigrafe,''))
  ) STORED
);

-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_disp_lei ON dispositivos(lei_id);
CREATE INDEX IF NOT EXISTS idx_disp_posicao ON dispositivos(lei_id, posicao);
CREATE INDEX IF NOT EXISTS idx_disp_tipo ON dispositivos(tipo);
CREATE INDEX IF NOT EXISTS idx_disp_path ON dispositivos(path);
CREATE INDEX IF NOT EXISTS idx_disp_search ON dispositivos USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_lei_search ON leis USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_lei_tipo ON leis(tipo);
CREATE INDEX IF NOT EXISTS idx_lei_nivel ON leis(nivel);

-- Unique constraint: one dispositivo per (lei, posicao)
CREATE UNIQUE INDEX IF NOT EXISTS idx_disp_unique ON dispositivos(lei_id, posicao);

-- Partial index: fast queries on non-revoked dispositivos
CREATE INDEX IF NOT EXISTS idx_disp_vigentes ON dispositivos(lei_id, posicao)
  WHERE revogado = false;
