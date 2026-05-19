-- V3 Migration — Tabela de resumos por bloco (subtopico)
-- Resumo único por subtópico (UNIQUE), editado em Plate (JSONB), com fluxo rascunho/publicado.
-- RLS: admin gerencia tudo, aluno autenticado lê apenas publicados.

CREATE TABLE IF NOT EXISTS coaching.resumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopico_id UUID NOT NULL REFERENCES coaching.subtopicos(id) ON DELETE CASCADE,
  conteudo_plate JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'publicado')),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicado_em TIMESTAMPTZ,
  CONSTRAINT resumos_subtopico_unique UNIQUE (subtopico_id)
);

CREATE INDEX IF NOT EXISTS ix_resumos_subtopico ON coaching.resumos(subtopico_id);
CREATE INDEX IF NOT EXISTS ix_resumos_status_publicado
  ON coaching.resumos(status) WHERE status = 'publicado';

ALTER TABLE coaching.resumos ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
DROP POLICY IF EXISTS resumos_admin_all ON coaching.resumos;
CREATE POLICY resumos_admin_all ON coaching.resumos
  FOR ALL TO authenticated
  USING (coaching.is_admin())
  WITH CHECK (coaching.is_admin());

-- Aluno autenticado vê apenas publicados
DROP POLICY IF EXISTS resumos_aluno_read ON coaching.resumos;
CREATE POLICY resumos_aluno_read ON coaching.resumos
  FOR SELECT TO authenticated
  USING (status = 'publicado');

-- Trigger de atualizado_em
DROP TRIGGER IF EXISTS tg_resumos_atualizado_em ON coaching.resumos;
CREATE TRIGGER tg_resumos_atualizado_em
  BEFORE UPDATE ON coaching.resumos
  FOR EACH ROW EXECUTE FUNCTION coaching.update_atualizado_em();

GRANT SELECT, INSERT, UPDATE, DELETE ON coaching.resumos TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
