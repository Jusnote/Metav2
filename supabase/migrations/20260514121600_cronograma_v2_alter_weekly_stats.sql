-- UP: novas colunas em weekly_stats
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE weekly_stats
  ADD COLUMN IF NOT EXISTS unlocked_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overflow BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN weekly_stats.unlocked_early IS 'TRUE quando semana foi destravada antecipadamente';
COMMENT ON COLUMN weekly_stats.overflow IS 'TRUE quando capacidade insuficiente forçou overflow';
