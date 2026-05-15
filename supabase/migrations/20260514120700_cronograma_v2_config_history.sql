-- UP: plano_config_history (snapshots de config a cada mudança)
-- DOWN: DROP TABLE plano_config_history

CREATE TABLE IF NOT EXISTS plano_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plano_id, version)
);

CREATE INDEX IF NOT EXISTS ix_plano_config_history_plano_version
  ON plano_config_history(plano_id, version DESC);

COMMENT ON TABLE plano_config_history IS
  'Snapshots versionados de plano_config. Recalibração e items históricos referenciam version pra saber em qual capacidade foram planejados.';
