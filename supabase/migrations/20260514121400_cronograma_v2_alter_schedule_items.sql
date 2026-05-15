-- UP: novas colunas em schedule_items
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS is_anticipated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fsrs_due_date DATE,
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unlocked_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS ix_schedule_items_fsrs_due
  ON schedule_items(fsrs_due_date) WHERE fsrs_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_schedule_items_parent
  ON schedule_items(parent_item_id) WHERE parent_item_id IS NOT NULL;

COMMENT ON COLUMN schedule_items.is_anticipated IS 'TRUE quando user puxou da semana seguinte pra atual';
COMMENT ON COLUMN schedule_items.fsrs_due_date IS 'Data ótima FSRS pra revisões (não move em recalibração)';
COMMENT ON COLUMN schedule_items.parent_item_id IS 'Item de teoria que gerou esta revisão';
COMMENT ON COLUMN schedule_items.version IS 'Optimistic lock pra concorrência';
