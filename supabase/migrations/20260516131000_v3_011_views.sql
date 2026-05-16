-- V3 Migration 011 — Views úteis
-- Refs: doc 04 (schema), doc 10 (fase 1)
-- REESCRITO: views em coaching.*

-- View: progresso do aluno por disciplina
CREATE VIEW coaching.v_progresso_disciplinas AS
SELECT
  a.id AS aluno_id,
  d.id AS disciplina_id,
  d.nome AS disciplina_nome,
  d.horas_totais,
  COUNT(DISTINCT t.id) AS total_topicos,
  COUNT(DISTINCT CASE WHEN at.status = 'concluida' AND at.tipo = 'teoria' THEN t.id END) AS topicos_com_teoria,
  COUNT(DISTINCT CASE WHEN fc.id IS NOT NULL THEN st.id END) AS subtopicos_em_fsrs,
  AVG(at.desempenho_pct) FILTER (WHERE at.tipo = 'questoes') AS desempenho_medio
FROM coaching.alunos a
JOIN coaching.concursos c ON c.id = a.concurso_id
JOIN coaching.disciplinas d ON d.concurso_id = c.id
JOIN coaching.blocos_tematicos b ON b.disciplina_id = d.id
JOIN coaching.topicos t ON t.bloco_id = b.id
LEFT JOIN coaching.subtopicos st ON st.topico_id = t.id
LEFT JOIN coaching.atividades at ON at.topico_id = t.id AND at.aluno_id = a.id
LEFT JOIN coaching.fsrs_cards fc ON fc.subtopico_id = st.id AND fc.aluno_id = a.id
GROUP BY a.id, d.id, d.nome, d.horas_totais;

-- View: cards FSRS em risco (R < 0.7)
CREATE VIEW coaching.v_memoria_em_risco AS
SELECT
  fc.aluno_id,
  fc.subtopico_id,
  st.nome AS subtopico_nome,
  t.nome AS topico_nome,
  d.nome AS disciplina_nome,
  fc.retrievability,
  fc.due_date,
  fc.last_review,
  fc.lapse_count
FROM coaching.fsrs_cards fc
JOIN coaching.subtopicos st ON st.id = fc.subtopico_id
JOIN coaching.topicos t ON t.id = st.topico_id
JOIN coaching.blocos_tematicos b ON b.id = t.bloco_id
JOIN coaching.disciplinas d ON d.id = b.disciplina_id
WHERE fc.retrievability < 0.7 OR fc.due_date <= NOW()
ORDER BY fc.due_date ASC;
