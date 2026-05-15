-- UP: novas colunas em plano_disciplinas
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE plano_disciplinas
  ADD COLUMN IF NOT EXISTS nivel_conhecimento nivel_conhecimento_enum NOT NULL DEFAULT 'intermediario',
  ADD COLUMN IF NOT EXISTS is_ponto_fraco BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS excluded_subtopico_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS ix_plano_disciplinas_ponto_fraco
  ON plano_disciplinas(plano_id) WHERE is_ponto_fraco = TRUE;

COMMENT ON COLUMN plano_disciplinas.nivel_conhecimento IS 'Nível declarado pelo user. Ajusta multiplicadores de tempo e mix interno.';
COMMENT ON COLUMN plano_disciplinas.is_ponto_fraco IS 'Se TRUE, recebe +30% peso adicional. Máximo 3 por plano (enforced em RPC).';
COMMENT ON COLUMN plano_disciplinas.excluded_subtopico_ids IS 'Subtópicos desmarcados via drill-down opcional.';
