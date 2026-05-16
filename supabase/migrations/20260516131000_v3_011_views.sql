-- V3 Migration 011 — Views úteis
-- Refs: doc 04 (schema), doc 10 (fase 1)

-- View: progresso do aluno por disciplina
CREATE VIEW v_progresso_disciplinas AS
SELECT
  a.id AS aluno_id,
  d.id AS disciplina_id,
  d.nome AS disciplina_nome,
  d.horas_totais,
  COUNT(DISTINCT t.id) AS total_topicos,
  COUNT(DISTINCT CASE WHEN at.status = 'concluida' AND at.tipo = 'teoria' THEN t.id END) AS topicos_com_teoria,
  COUNT(DISTINCT CASE WHEN fc.id IS NOT NULL THEN st.id END) AS subtopicos_em_fsrs,
  AVG(at.desempenho_pct) FILTER (WHERE at.tipo = 'questoes') AS desempenho_medio
FROM alunos a
JOIN concursos c ON c.id = a.concurso_id
JOIN disciplinas d ON d.concurso_id = c.id
JOIN blocos_tematicos b ON b.disciplina_id = d.id
JOIN topicos t ON t.bloco_id = b.id
LEFT JOIN subtopicos st ON st.topico_id = t.id
LEFT JOIN atividades at ON at.topico_id = t.id AND at.aluno_id = a.id
LEFT JOIN fsrs_cards fc ON fc.subtopico_id = st.id AND fc.aluno_id = a.id
GROUP BY a.id, d.id, d.nome, d.horas_totais;

-- View: cards FSRS em risco (R < 0.7)
CREATE VIEW v_memoria_em_risco AS
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
FROM fsrs_cards fc
JOIN subtopicos st ON st.id = fc.subtopico_id
JOIN topicos t ON t.id = st.topico_id
JOIN blocos_tematicos b ON b.id = t.bloco_id
JOIN disciplinas d ON d.id = b.disciplina_id
WHERE fc.retrievability < 0.7 OR fc.due_date <= NOW()
ORDER BY fc.due_date ASC;
