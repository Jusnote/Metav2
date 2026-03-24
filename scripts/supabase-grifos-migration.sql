-- Grifo Core: character-level text highlighting
-- Run this migration on the Hetzner PostgreSQL (Coolify) or Supabase dashboard

CREATE TABLE IF NOT EXISTS grifos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lei_id          TEXT NOT NULL,
  dispositivo_id  TEXT NOT NULL,
  start_offset    INT NOT NULL,
  end_offset      INT NOT NULL,
  texto_grifado   TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT 'yellow'
                  CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange')),
  note            TEXT,
  tags            TEXT[] DEFAULT '{}',
  orphan          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_grifos_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER grifos_updated_at BEFORE UPDATE ON grifos
FOR EACH ROW EXECUTE FUNCTION update_grifos_updated_at();

CREATE INDEX IF NOT EXISTS idx_grifos_user_lei ON grifos(user_id, lei_id);
CREATE INDEX IF NOT EXISTS idx_grifos_dispositivo ON grifos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_grifos_tags ON grifos USING GIN(tags);

ALTER TABLE grifos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY grifos_user_only ON grifos
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
