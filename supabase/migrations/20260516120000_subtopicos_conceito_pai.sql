-- UP: adiciona conceito_pai em subtopicos (rastreabilidade de hierarquia)
-- DOWN: ALTER TABLE subtopicos DROP COLUMN conceito_pai;
ALTER TABLE subtopicos ADD COLUMN IF NOT EXISTS conceito_pai TEXT;
COMMENT ON COLUMN subtopicos.conceito_pai IS
  'Grupo conceitual pai (de edital_cache.decomposicao). Usado pra renderizar hierarquia visual no cronograma.';
