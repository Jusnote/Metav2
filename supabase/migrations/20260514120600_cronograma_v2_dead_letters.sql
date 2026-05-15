-- UP: dead_letters (admin reprocessa manualmente)
-- DOWN: DROP TABLE dead_letters

CREATE TABLE IF NOT EXISTS dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  first_failed_at TIMESTAMPTZ NOT NULL,
  last_failed_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS ix_dead_letters_unresolved
  ON dead_letters(last_failed_at DESC) WHERE resolved_at IS NULL;

COMMENT ON TABLE dead_letters IS
  'Eventos não processados após 3 tentativas. Acessível só por admin via /admin/cronograma. Botão "Reprocess" reinsere em plan_events.';
