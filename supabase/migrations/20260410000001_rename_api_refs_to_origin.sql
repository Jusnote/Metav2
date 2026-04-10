-- Rename reference columns for stability and neutrality
ALTER TABLE disciplinas RENAME COLUMN api_disciplina_id TO origin_disciplina_ref;
ALTER TABLE topicos RENAME COLUMN api_topico_id TO origin_topico_ref;

-- Update indexes
DROP INDEX IF EXISTS idx_disciplinas_api;
CREATE INDEX idx_disciplinas_origin ON disciplinas(origin_disciplina_ref) WHERE origin_disciplina_ref IS NOT NULL;

DROP INDEX IF EXISTS idx_topicos_api;
CREATE INDEX idx_topicos_origin ON topicos(origin_topico_ref) WHERE origin_topico_ref IS NOT NULL;
