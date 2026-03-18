-- ============================================================
-- Caderno Markers (Personal Tags) - Schema Migration
-- ============================================================
-- Personal, transversal tags for study actions (#RevisarUrgente, #CaiNaProva)
-- Separated from structural metadata (lei, role) in the UI

ALTER TABLE caderno_items
  ADD COLUMN IF NOT EXISTS markers text[] DEFAULT '{}';

-- GIN index for fast @> (contains) queries
CREATE INDEX IF NOT EXISTS idx_caderno_items_markers
  ON caderno_items USING GIN (markers);
