-- UP: behavioral_signals com partitioning mensal + unique pra idempotência
-- DOWN: DROP TABLE behavioral_signals

CREATE TABLE IF NOT EXISTS behavioral_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
  schedule_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  value JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE IF NOT EXISTS behavioral_signals_2026_05 PARTITION OF behavioral_signals
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS behavioral_signals_2026_06 PARTITION OF behavioral_signals
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS behavioral_signals_default PARTITION OF behavioral_signals DEFAULT;

-- Unique pra idempotência (mesmo item, mesmo signal_type, mesmo dia → 1 row)
-- Aplica-se à coluna não particionada por dia, fica em cada partição
CREATE UNIQUE INDEX IF NOT EXISTS uq_behavioral_signals_idempotency
  ON behavioral_signals (plano_id, schedule_item_id, signal_type, ((occurred_at AT TIME ZONE 'UTC')::date), occurred_at);

CREATE INDEX IF NOT EXISTS ix_behavioral_signals_user_type_time
  ON behavioral_signals(user_id, signal_type, occurred_at DESC);

COMMENT ON TABLE behavioral_signals IS
  'Sinais comportamentais passivos (LGPD opt-in): coleta quando user estuda, completa, pula. Alimenta level_drift detection e engine de predição.';
