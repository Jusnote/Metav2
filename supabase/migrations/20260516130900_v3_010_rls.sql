-- V3 Migration 010 — Row Level Security e função is_admin()
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- REESCRITO: função e policies em coaching.*

-- Helper para checar se é admin (em coaching, com search_path seguro)
CREATE OR REPLACE FUNCTION coaching.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM coaching.alunos
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = coaching, public, auth;

-- ALUNOS
ALTER TABLE coaching.alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_ve_proprio" ON coaching.alunos
  FOR SELECT USING (auth.uid() = id OR coaching.is_admin());

CREATE POLICY "aluno_edita_proprio" ON coaching.alunos
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "admin_edita_tudo" ON coaching.alunos
  FOR ALL USING (coaching.is_admin());

-- CONCURSOS — leitura pública para publicados
ALTER TABLE coaching.concursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concursos_publicados_visiveis" ON coaching.concursos
  FOR SELECT USING (status = 'publicado' OR coaching.is_admin());
CREATE POLICY "admin_gerencia_concursos" ON coaching.concursos
  FOR ALL USING (coaching.is_admin());

-- EDITAIS_RAW — só admin lê/escreve
ALTER TABLE coaching.editais_raw ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_gerencia_editais_raw" ON coaching.editais_raw
  FOR ALL USING (coaching.is_admin());

-- DISCIPLINAS — visíveis para alunos de concursos publicados
ALTER TABLE coaching.disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplinas_visiveis" ON coaching.disciplinas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM coaching.concursos WHERE id = concurso_id AND status = 'publicado')
    OR coaching.is_admin()
  );
CREATE POLICY "admin_gerencia_disciplinas" ON coaching.disciplinas
  FOR ALL USING (coaching.is_admin());

-- BLOCOS TEMÁTICOS — mesmo padrão de disciplinas
ALTER TABLE coaching.blocos_tematicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocos_visiveis" ON coaching.blocos_tematicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coaching.disciplinas d
      JOIN coaching.concursos c ON c.id = d.concurso_id
      WHERE d.id = disciplina_id AND c.status = 'publicado'
    ) OR coaching.is_admin()
  );
CREATE POLICY "admin_gerencia_blocos" ON coaching.blocos_tematicos
  FOR ALL USING (coaching.is_admin());

-- TOPICOS — mesmo padrão
ALTER TABLE coaching.topicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topicos_visiveis" ON coaching.topicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coaching.blocos_tematicos b
      JOIN coaching.disciplinas d ON d.id = b.disciplina_id
      JOIN coaching.concursos c ON c.id = d.concurso_id
      WHERE b.id = bloco_id AND c.status = 'publicado'
    ) OR coaching.is_admin()
  );
CREATE POLICY "admin_gerencia_topicos" ON coaching.topicos
  FOR ALL USING (coaching.is_admin());

-- SUBTOPICOS — mesmo padrão
ALTER TABLE coaching.subtopicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtopicos_visiveis" ON coaching.subtopicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coaching.topicos t
      JOIN coaching.blocos_tematicos b ON b.id = t.bloco_id
      JOIN coaching.disciplinas d ON d.id = b.disciplina_id
      JOIN coaching.concursos c ON c.id = d.concurso_id
      WHERE t.id = topico_id AND c.status = 'publicado'
    ) OR coaching.is_admin()
  );
CREATE POLICY "admin_gerencia_subtopicos" ON coaching.subtopicos
  FOR ALL USING (coaching.is_admin());

-- CONTEUDOS — só aluno do concurso vê
ALTER TABLE coaching.conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conteudos_para_alunos_do_concurso" ON coaching.conteudos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coaching.topicos t
      JOIN coaching.blocos_tematicos b ON b.id = t.bloco_id
      JOIN coaching.disciplinas d ON d.id = b.disciplina_id
      JOIN coaching.alunos a ON a.concurso_id = d.concurso_id
      WHERE t.id = coaching.conteudos.topico_id AND a.id = auth.uid()
    ) OR coaching.is_admin()
  );
CREATE POLICY "admin_gerencia_conteudos" ON coaching.conteudos
  FOR ALL USING (coaching.is_admin());

-- QUESTOES — mesmo padrão que conteudos
ALTER TABLE coaching.questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questoes_para_alunos_do_concurso" ON coaching.questoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coaching.topicos t
      JOIN coaching.blocos_tematicos b ON b.id = t.bloco_id
      JOIN coaching.disciplinas d ON d.id = b.disciplina_id
      JOIN coaching.alunos a ON a.concurso_id = d.concurso_id
      WHERE t.id = coaching.questoes.topico_id AND a.id = auth.uid()
    ) OR coaching.is_admin()
  );
CREATE POLICY "admin_gerencia_questoes" ON coaching.questoes
  FOR ALL USING (coaching.is_admin());

-- SEMANAS e ATIVIDADES — só do próprio aluno
ALTER TABLE coaching.semanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_semanas" ON coaching.semanas
  FOR ALL USING (auth.uid() = aluno_id OR coaching.is_admin());

ALTER TABLE coaching.atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_atividades" ON coaching.atividades
  FOR ALL USING (auth.uid() = aluno_id OR coaching.is_admin());

-- FSRS — só do próprio aluno
ALTER TABLE coaching.fsrs_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprios_cards" ON coaching.fsrs_cards
  FOR ALL USING (auth.uid() = aluno_id OR coaching.is_admin());

ALTER TABLE coaching.fsrs_reviews_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprios_reviews" ON coaching.fsrs_reviews_log
  FOR ALL USING (auth.uid() = aluno_id OR coaching.is_admin());

ALTER TABLE coaching.tentativas_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_tentativas" ON coaching.tentativas_questoes
  FOR ALL USING (auth.uid() = aluno_id OR coaching.is_admin());

-- EVENTOS — admin vê tudo, aluno só os próprios
ALTER TABLE coaching.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_proprios_ou_admin" ON coaching.eventos
  FOR SELECT USING (auth.uid() = aluno_id OR coaching.is_admin());
CREATE POLICY "qualquer_um_insere_eventos" ON coaching.eventos
  FOR INSERT WITH CHECK (true);
