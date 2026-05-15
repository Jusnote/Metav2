-- UP: edital_cache (compartilhado, lookup por cargo+edital)
-- DOWN: DROP TABLE edital_cache

CREATE TABLE IF NOT EXISTS edital_cache (
  cargo_id INTEGER NOT NULL,
  edital_id INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  decomposicao JSONB NOT NULL,
  ai_model TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cargo_id, edital_id)
);

CREATE INDEX IF NOT EXISTS ix_edital_cache_last_validated
  ON edital_cache(last_validated_at);

COMMENT ON TABLE edital_cache IS
  'Cache compartilhado da decomposição IA por edital. Invalidação por mudança de payload_hash. Reduz custo de IA: 1 user paga, todos do mesmo cargo aproveitam.';
