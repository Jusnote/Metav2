-- V3 Migration — Extras de resumos: TL;DR, takeaways e revisões FSRS
-- Adiciona campos para o callout "O que vai aprender" e bullets "Decora isso",
-- além de uma tabela para registrar revisões dos alunos com rating estilo FSRS.

-- Campos pra TL;DR e Key Takeaways (fora do Plate doc)
ALTER TABLE coaching.resumos
  ADD COLUMN IF NOT EXISTS tldr TEXT,
  ADD COLUMN IF NOT EXISTS takeaways JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Tabela de revisões FSRS (rating do aluno ao concluir bloco)
CREATE TABLE IF NOT EXISTS coaching.resumo_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resumo_id UUID NOT NULL REFERENCES coaching.resumos(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('again','hard','good','easy')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_resumo_revisoes_aluno
  ON coaching.resumo_revisoes(aluno_id, resumo_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_resumo_revisoes_resumo
  ON coaching.resumo_revisoes(resumo_id);

ALTER TABLE coaching.resumo_revisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resumo_revisoes_aluno_own ON coaching.resumo_revisoes;
CREATE POLICY resumo_revisoes_aluno_own ON coaching.resumo_revisoes
  FOR ALL TO authenticated
  USING (aluno_id = auth.uid())
  WITH CHECK (aluno_id = auth.uid());

DROP POLICY IF EXISTS resumo_revisoes_admin_read ON coaching.resumo_revisoes;
CREATE POLICY resumo_revisoes_admin_read ON coaching.resumo_revisoes
  FOR SELECT TO authenticated
  USING (coaching.is_admin());

GRANT ALL ON coaching.resumo_revisoes TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON coaching.resumo_revisoes TO authenticated;

NOTIFY pgrst, 'reload schema';
