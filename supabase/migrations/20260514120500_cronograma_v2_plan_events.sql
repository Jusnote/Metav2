-- UP: plan_events event bus particionado
-- DOWN: DROP TABLE plan_events

CREATE SEQUENCE IF NOT EXISTS plan_events_seq;

CREATE TABLE IF NOT EXISTS plan_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_estudo(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  sequence_number BIGINT NOT NULL DEFAULT nextval('plan_events_seq'),
  payload JSONB NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  dead_letter BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id, fired_at)
) PARTITION BY RANGE (fired_at);

CREATE TABLE IF NOT EXISTS plan_events_2026_05 PARTITION OF plan_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS plan_events_2026_06 PARTITION OF plan_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS plan_events_default PARTITION OF plan_events DEFAULT;

CREATE INDEX IF NOT EXISTS ix_plan_events_plano_fired
  ON plan_events(plano_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS ix_plan_events_unprocessed
  ON plan_events(fired_at) WHERE processed_at IS NULL AND dead_letter = FALSE;
CREATE INDEX IF NOT EXISTS ix_plan_events_sequence
  ON plan_events(sequence_number);

COMMENT ON TABLE plan_events IS
  'Event bus append-only. Eventos publicados por triggers/jobs, consumidos por handlers (PL/pgSQL e TS via Realtime). Ordering garantido por sequence_number.';
