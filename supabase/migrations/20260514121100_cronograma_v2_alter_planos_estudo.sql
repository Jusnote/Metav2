-- UP: novas colunas em planos_estudo
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE planos_estudo
  ADD COLUMN IF NOT EXISTS cargo_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS algorithm_variant TEXT NOT NULL DEFAULT 'v2_default',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_planos_estudo_user_active_not_deleted
  ON planos_estudo(user_id, status) WHERE deleted_at IS NULL;

COMMENT ON COLUMN planos_estudo.cargo_snapshot IS 'Snapshot do cargo no momento da criação (nome, edital_id, qtd_disciplinas)';
COMMENT ON COLUMN planos_estudo.template_id IS 'Template usado como ponto de partida, se aplicável';
COMMENT ON COLUMN planos_estudo.algorithm_variant IS 'Variante do algoritmo usada (pra A/B testing futuro)';
COMMENT ON COLUMN planos_estudo.deleted_at IS 'Soft delete; rows com valor não vazio não aparecem em queries do user';
