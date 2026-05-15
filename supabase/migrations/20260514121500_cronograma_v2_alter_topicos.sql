-- UP: novas colunas em topicos
-- DOWN: ALTER TABLE ... DROP COLUMN

ALTER TABLE topicos
  ADD COLUMN IF NOT EXISTS referencias_legais JSONB,
  ADD COLUMN IF NOT EXISTS ai_decomposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nome_curto TEXT;

COMMENT ON COLUMN topicos.referencias_legais IS 'Lista de leis/decretos extraídos pela IA (ex: ["Lei 8.666/93"])';
COMMENT ON COLUMN topicos.ai_decomposed_at IS 'Timestamp da última decomposição IA';
COMMENT ON COLUMN topicos.nome_curto IS 'Nome resumido gerado pela IA (3-6 palavras)';
