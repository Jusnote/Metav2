-- UP: plan_decisions com particionamento mensal
-- DOWN: DROP TABLE plan_decisions

CREATE TABLE IF NOT EXISTS plan_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  week_number INTEGER,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  inputs_hash TEXT,
  output_summary JSONB NOT NULL,
  algorithm_variant TEXT NOT NULL DEFAULT 'v2_default',
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partições iniciais: corrente e próximo mês
CREATE TABLE IF NOT EXISTS plan_decisions_2026_05 PARTITION OF plan_decisions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS plan_decisions_2026_06 PARTITION OF plan_decisions
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Catch-all defensivo para evitar erros caso cron falhe
CREATE TABLE IF NOT EXISTS plan_decisions_default PARTITION OF plan_decisions DEFAULT;

CREATE INDEX IF NOT EXISTS ix_plan_decisions_plano_week
  ON plan_decisions(plano_id, week_number);
CREATE INDEX IF NOT EXISTS ix_plan_decisions_action_time
  ON plan_decisions(action, created_at DESC);

COMMENT ON TABLE plan_decisions IS
  'Audit trail do algoritmo: cada decisão importante (distribuição, recalibração, FSRS) é logada para observabilidade e UI "Por que isso aconteceu?".';
