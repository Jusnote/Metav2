-- UP: plano_predictions_history (append-only) + view plano_predictions (última row por plano)
-- DOWN: DROP VIEW plano_predictions; DROP TABLE plano_predictions_history

CREATE TABLE IF NOT EXISTS plano_predictions_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  coverage_pct NUMERIC(5,2) NOT NULL CHECK (coverage_pct >= 0 AND coverage_pct <= 100),
  slack_weeks NUMERIC(4,1),
  pace_index NUMERIC(4,2),
  weakest_disciplinas JSONB,
  recommendations JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_predictions_plano_time
  ON plano_predictions_history(plano_id, computed_at DESC);

CREATE OR REPLACE VIEW plano_predictions AS
SELECT DISTINCT ON (plano_id) *
FROM plano_predictions_history
ORDER BY plano_id, computed_at DESC;

COMMENT ON TABLE plano_predictions_history IS
  'Histórico append-only de predições do engine. View plano_predictions retorna última de cada plano.';
