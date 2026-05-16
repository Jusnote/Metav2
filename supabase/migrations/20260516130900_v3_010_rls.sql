-- V3 Migration 010 — Row Level Security e função is_admin()
-- Refs: doc 04 (schema), doc 10 (fase 1)

-- Helper para checar se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM alunos
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ALUNOS
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_ve_proprio" ON alunos
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "aluno_edita_proprio" ON alunos
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "admin_edita_tudo" ON alunos
  FOR ALL USING (is_admin());

-- CONCURSOS — leitura pública para publicados
ALTER TABLE concursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concursos_publicados_visiveis" ON concursos
  FOR SELECT USING (status = 'publicado' OR is_admin());
CREATE POLICY "admin_gerencia_concursos" ON concursos
  FOR ALL USING (is_admin());

-- DISCIPLINAS — visíveis para alunos de concursos publicados
ALTER TABLE disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplinas_visiveis" ON disciplinas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM concursos WHERE id = concurso_id AND status = 'publicado')
    OR is_admin()
  );
CREATE POLICY "admin_gerencia_disciplinas" ON disciplinas
  FOR ALL USING (is_admin());

-- BLOCOS TEMÁTICOS — mesmo padrão de disciplinas
ALTER TABLE blocos_tematicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocos_visiveis" ON blocos_tematicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM disciplinas d
      JOIN concursos c ON c.id = d.concurso_id
      WHERE d.id = disciplina_id AND c.status = 'publicado'
    ) OR is_admin()
  );
CREATE POLICY "admin_gerencia_blocos" ON blocos_tematicos
  FOR ALL USING (is_admin());

-- TOPICOS — mesmo padrão
ALTER TABLE topicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topicos_visiveis" ON topicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blocos_tematicos b
      JOIN disciplinas d ON d.id = b.disciplina_id
      JOIN concursos c ON c.id = d.concurso_id
      WHERE b.id = bloco_id AND c.status = 'publicado'
    ) OR is_admin()
  );
CREATE POLICY "admin_gerencia_topicos" ON topicos
  FOR ALL USING (is_admin());

-- SUBTOPICOS — mesmo padrão
ALTER TABLE subtopicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtopicos_visiveis" ON subtopicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM topicos t
      JOIN blocos_tematicos b ON b.id = t.bloco_id
      JOIN disciplinas d ON d.id = b.disciplina_id
      JOIN concursos c ON c.id = d.concurso_id
      WHERE t.id = topico_id AND c.status = 'publicado'
    ) OR is_admin()
  );
CREATE POLICY "admin_gerencia_subtopicos" ON subtopicos
  FOR ALL USING (is_admin());

-- CONTEUDOS — só aluno do concurso vê
ALTER TABLE conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conteudos_para_alunos_do_concurso" ON conteudos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM topicos t
      JOIN blocos_tematicos b ON b.id = t.bloco_id
      JOIN disciplinas d ON d.id = b.disciplina_id
      JOIN alunos a ON a.concurso_id = d.concurso_id
      WHERE t.id = conteudos.topico_id AND a.id = auth.uid()
    ) OR is_admin()
  );
CREATE POLICY "admin_gerencia_conteudos" ON conteudos
  FOR ALL USING (is_admin());

-- QUESTOES — mesmo padrão que conteudos
ALTER TABLE questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questoes_para_alunos_do_concurso" ON questoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM topicos t
      JOIN blocos_tematicos b ON b.id = t.bloco_id
      JOIN disciplinas d ON d.id = b.disciplina_id
      JOIN alunos a ON a.concurso_id = d.concurso_id
      WHERE t.id = questoes.topico_id AND a.id = auth.uid()
    ) OR is_admin()
  );
CREATE POLICY "admin_gerencia_questoes" ON questoes
  FOR ALL USING (is_admin());

-- SEMANAS e ATIVIDADES — só do próprio aluno
ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_semanas" ON semanas
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_atividades" ON atividades
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

-- FSRS — só do próprio aluno
ALTER TABLE fsrs_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprios_cards" ON fsrs_cards
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

ALTER TABLE fsrs_reviews_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprios_reviews" ON fsrs_reviews_log
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

ALTER TABLE tentativas_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_tentativas" ON tentativas_questoes
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

-- EVENTOS — admin vê tudo, aluno só os próprios
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_proprios_ou_admin" ON eventos
  FOR SELECT USING (auth.uid() = aluno_id OR is_admin());
CREATE POLICY "qualquer_um_insere_eventos" ON eventos
  FOR INSERT WITH CHECK (true);
