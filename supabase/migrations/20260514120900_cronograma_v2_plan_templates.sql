-- UP: plan_templates (oficial/publico/privado)
-- DOWN: DROP TABLE plan_templates

CREATE TABLE IF NOT EXISTS plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL CHECK (duracao_dias >= 14),
  config JSONB NOT NULL,
  uses_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 100)),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visibility plan_template_visibility NOT NULL DEFAULT 'privado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plan_templates_cargo_visibility
  ON plan_templates(cargo_id, visibility);
CREATE INDEX IF NOT EXISTS ix_plan_templates_popular
  ON plan_templates(cargo_id, uses_count DESC) WHERE visibility IN ('publico', 'oficial');

COMMENT ON TABLE plan_templates IS
  'Templates de plano (oficiais pela equipe + comunidade). uses_count e success_rate atualizados por cron.';
