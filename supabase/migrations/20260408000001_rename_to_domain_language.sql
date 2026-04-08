-- =============================================
-- Rename tables: units/topics/subtopics → disciplinas/topicos/subtopicos
-- =============================================

-- Rename tables
ALTER TABLE units RENAME TO disciplinas;
ALTER TABLE topics RENAME TO topicos;
ALTER TABLE subtopics RENAME TO subtopicos;

-- Rename columns: disciplinas (was units)
ALTER TABLE disciplinas RENAME COLUMN title TO nome;

-- Rename columns: topicos (was topics)
ALTER TABLE topicos RENAME COLUMN title TO nome;
ALTER TABLE topicos RENAME COLUMN unit_id TO disciplina_id;

-- Rename columns: subtopicos (was subtopics)
ALTER TABLE subtopicos RENAME COLUMN title TO nome;
ALTER TABLE subtopicos RENAME COLUMN topic_id TO topico_id;

-- Rename FKs in documents
ALTER TABLE documents RENAME COLUMN subtopic_id TO subtopico_id;
ALTER TABLE documents RENAME COLUMN topic_id TO topico_id;

-- Rename FKs in notes
ALTER TABLE notes RENAME COLUMN subtopic_id TO subtopico_id;
ALTER TABLE notes RENAME COLUMN topic_id TO topico_id;

-- Rename FKs in schedule_items
ALTER TABLE schedule_items RENAME COLUMN unit_id TO disciplina_id;
ALTER TABLE schedule_items RENAME COLUMN topic_id TO topico_id;
ALTER TABLE schedule_items RENAME COLUMN subtopic_id TO subtopico_id;

-- Rename FKs in study_goals
ALTER TABLE study_goals RENAME COLUMN unit_id TO disciplina_id;

-- Recreate indexes with new names
DROP INDEX IF EXISTS idx_topics_user_id;
CREATE INDEX idx_topicos_user_id ON topicos(user_id);

DROP INDEX IF EXISTS idx_topics_duration;
CREATE INDEX idx_topicos_duration ON topicos(estimated_duration_minutes);

DROP INDEX IF EXISTS idx_topics_last_access;
CREATE INDEX idx_topicos_last_access ON topicos(last_access);

DROP INDEX IF EXISTS idx_subtopics_user_id;
CREATE INDEX idx_subtopicos_user_id ON subtopicos(user_id);

DROP INDEX IF EXISTS idx_subtopics_duration;
CREATE INDEX idx_subtopicos_duration ON subtopicos(estimated_duration_minutes);

DROP INDEX IF EXISTS idx_subtopics_last_access;
CREATE INDEX idx_subtopicos_last_access ON subtopicos(last_access);

DROP INDEX IF EXISTS idx_units_user_id;
CREATE INDEX idx_disciplinas_user_id ON disciplinas(user_id);
