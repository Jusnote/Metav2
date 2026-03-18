-- ============================================================
-- SCHEMA LEI SECA - Supabase
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. EXTENSÕES NECESSÁRIAS (no schema extensions)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Função wrapper IMMUTABLE para unaccent (necessário para índices)
CREATE OR REPLACE FUNCTION public.immutable_unaccent(TEXT)
RETURNS TEXT AS $$
  SELECT extensions.unaccent($1)
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- 2. TABELA: LEIS
-- ============================================================
CREATE TABLE IF NOT EXISTS leis (
  id TEXT PRIMARY KEY,
  numero TEXT,
  nome TEXT,
  sigla TEXT,
  ementa TEXT,
  data_publicacao DATE,
  hierarquia JSONB,
  total_artigos INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: ARTIGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS artigos (
  id TEXT PRIMARY KEY,
  lei_id TEXT REFERENCES leis(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  slug TEXT,
  plate_content JSONB,
  texto_plano TEXT,
  search_text TEXT,
  vigente BOOLEAN DEFAULT TRUE,
  contexto TEXT,
  path JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ordem_numerica INT GENERATED ALWAYS AS (
    COALESCE((regexp_match(numero, '^(\d+)'))[1]::INT, 0)
  ) STORED
);

-- 4. ÍNDICES
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS artigos_slug_idx ON artigos(slug);
CREATE INDEX IF NOT EXISTS artigos_lei_id_idx ON artigos(lei_id);
CREATE INDEX IF NOT EXISTS artigos_path_idx ON artigos USING GIN(path);
CREATE INDEX IF NOT EXISTS artigos_search_idx ON artigos
  USING GIN (to_tsvector('portuguese', COALESCE(search_text, '')));
CREATE INDEX IF NOT EXISTS artigos_texto_plano_fts_idx ON artigos
  USING GIN (to_tsvector('portuguese', public.immutable_unaccent(COALESCE(texto_plano, ''))));
CREATE INDEX IF NOT EXISTS artigos_search_text_trgm_idx ON artigos
  USING GIN (COALESCE(search_text, '') extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS artigos_ordem_idx ON artigos(lei_id, ordem_numerica);

-- 5. RLS (Row Level Security)
-- ============================================================
ALTER TABLE leis ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leis são públicas" ON leis FOR SELECT USING (true);
CREATE POLICY "Artigos são públicos" ON artigos FOR SELECT USING (true);
CREATE POLICY "Admin modifica leis" ON leis FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin modifica artigos" ON artigos FOR ALL USING (auth.role() = 'service_role');

-- 6. FUNÇÃO DE BUSCA
-- ============================================================
CREATE OR REPLACE FUNCTION search_artigos(
  search_query TEXT,
  lei_filter TEXT DEFAULT NULL,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  lei_id TEXT,
  numero TEXT,
  texto_plano TEXT,
  contexto TEXT,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.lei_id,
    a.numero,
    a.texto_plano,
    a.contexto,
    ts_rank(
      to_tsvector('portuguese', public.immutable_unaccent(COALESCE(a.texto_plano, ''))),
      plainto_tsquery('portuguese', public.immutable_unaccent(search_query))
    ) AS rank
  FROM artigos a
  WHERE
    (lei_filter IS NULL OR a.lei_id = lei_filter)
    AND to_tsvector('portuguese', public.immutable_unaccent(COALESCE(a.texto_plano, '')))
        @@ plainto_tsquery('portuguese', public.immutable_unaccent(search_query))
  ORDER BY rank DESC
  LIMIT limit_count;
END;
$$;
