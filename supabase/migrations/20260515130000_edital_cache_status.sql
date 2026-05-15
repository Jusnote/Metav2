-- UP: adiciona status + audit em edital_cache (workflow de curadoria)
-- DOWN: ALTER TABLE edital_cache DROP COLUMN status, published_at, published_by;

ALTER TABLE edital_cache
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_edital_cache_status
  ON edital_cache(status, last_validated_at DESC);

COMMENT ON COLUMN edital_cache.status IS
  'Workflow de curadoria: draft (IA rodou, admin não revisou ainda), published (validado, disponível pro V2), archived (não usar).';
COMMENT ON COLUMN edital_cache.published_at IS
  'Quando passou pra published. NULL enquanto draft.';
COMMENT ON COLUMN edital_cache.published_by IS
  'Admin que publicou. Null se gerado por seed/auto.';
