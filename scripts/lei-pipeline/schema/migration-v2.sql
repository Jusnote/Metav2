-- Pipeline v2 Migration
-- Run: psql "$DATABASE_URL" -f migration-v2.sql

BEGIN;

-- 1. Parent-child relationships
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES dispositivos(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS artigo_id BIGINT REFERENCES dispositivos(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS depth INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_disp_parent ON dispositivos(parent_id);
CREATE INDEX IF NOT EXISTS idx_disp_artigo ON dispositivos(artigo_id);

-- 2. doc_id INT → BIGINT
ALTER TABLE leis ALTER COLUMN doc_id TYPE BIGINT;

-- 3. pt_unaccent search config
CREATE EXTENSION IF NOT EXISTS unaccent;
DO $$ BEGIN
  CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);
EXCEPTION WHEN unique_violation THEN NULL; END $$;
ALTER TEXT SEARCH CONFIGURATION pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;

-- 4. search_vector upgrade
ALTER TABLE leis DROP COLUMN IF EXISTS search_vector;
ALTER TABLE leis ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('pt_unaccent', coalesce(titulo,'') || ' ' || coalesce(apelido,'') || ' ' || coalesce(ementa,''))
) STORED;

ALTER TABLE dispositivos DROP COLUMN IF EXISTS search_vector;
ALTER TABLE dispositivos ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('pt_unaccent', coalesce(texto,'') || ' ' || coalesce(epigrafe,''))
) STORED;

DROP INDEX IF EXISTS idx_disp_search;
DROP INDEX IF EXISTS idx_lei_search;
CREATE INDEX idx_disp_search ON dispositivos USING GIN(search_vector);
CREATE INDEX idx_lei_search ON leis USING GIN(search_vector);

-- 5. ON DELETE CASCADE
ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS dispositivos_lei_id_fkey;
ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_lei_id_fkey
  FOREIGN KEY (lei_id) REFERENCES leis(id) ON DELETE CASCADE;

-- 6. Composite index
DROP INDEX IF EXISTS idx_disp_tipo;
CREATE INDEX IF NOT EXISTS idx_disp_lei_tipo ON dispositivos(lei_id, tipo);

COMMIT;
