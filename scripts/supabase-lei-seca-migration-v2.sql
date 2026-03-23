-- Lei Pipeline v2: New columns for annotation separation, quality scoring, source tracking.
-- All changes are additive (ADD COLUMN IF NOT EXISTS) — safe for existing data.

-- Clean text without annotations (for study display)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS texto_limpo TEXT;

-- Structured array of extracted legislative annotations
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS anotacoes_legislativas JSONB DEFAULT '[]';

-- Raw text exactly as received from source (audit trail)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS texto_original_fonte TEXT;

-- Source identifier
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'planalto';

-- Source URL
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS fonte_url TEXT;

-- Quality confidence score (0-100)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS qualidade_score SMALLINT;

-- Validation flags for pending review
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]';

-- Reference links to other devices/laws (for future cross-linking)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS reference_links JSONB DEFAULT '[]';

-- Source tracking from GraphQL API (internal, not exposed)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS source_id BIGINT;
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS source_index INT;

-- Raw data storage on leis table
ALTER TABLE leis ADD COLUMN IF NOT EXISTS raw_tabelas JSONB DEFAULT '[]';
ALTER TABLE leis ADD COLUMN IF NOT EXISTS raw_metadata JSONB DEFAULT '{}';
