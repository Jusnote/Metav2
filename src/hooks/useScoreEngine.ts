import { useMemo } from 'react';

export interface DisciplinaScore {
  disciplinaNome: string;
  peso: number;           // 0-1 (e.g., 0.15 = 15%)
  accuracy: number;       // 0-1 average mastery of topics
  contribuicao: number;   // peso × accuracy × 100
  ganhoPotencial: number; // peso × (1 - accuracy) × 100
}

export interface ScoreProjection {
  current: number;                  // nota atual (0-100)
  breakdown: DisciplinaScore[];     // per disciplina
  topRecommendation: string | null; // disciplina with highest ROI
}

interface TopicoData {
  disciplinaNome: string;
  peso_edital: number | null;
  mastery_score: number;
}

/**
 * Basic score engine (v1).
 * Calculates: nota = sum(peso × avg_mastery_per_disciplina)
 *
 * v2 will add: projected score, pass probability, ROI per hour, marginal gain.
 */
export function useScoreEngine(topicos: TopicoData[]): ScoreProjection {
  return useMemo(() => {
    if (!topicos.length) {
      return { current: 0, breakdown: [], topRecommendation: null };
    }

    // Group by disciplina
    const byDisciplina = new Map<string, { pesos: number[]; masteries: number[] }>();

    for (const t of topicos) {
      const key = t.disciplinaNome;
      if (!byDisciplina.has(key)) {
        byDisciplina.set(key, { pesos: [], masteries: [] });
      }
      const group = byDisciplina.get(key)!;
      if (t.peso_edital != null) group.pesos.push(t.peso_edital);
      group.masteries.push(t.mastery_score || 0);
    }

    const breakdown: DisciplinaScore[] = [];
    let totalScore = 0;

    for (const [nome, group] of byDisciplina) {
      const peso = group.pesos.length > 0
        ? group.pesos.reduce((a, b) => a + b, 0) / group.pesos.length
        : 1 / byDisciplina.size; // Equal weight if no peso defined
      const accuracy = group.masteries.reduce((a, b) => a + b, 0) / group.masteries.length / 100;
      const contribuicao = peso * accuracy * 100;
      const ganhoPotencial = peso * (1 - accuracy) * 100;

      breakdown.push({ disciplinaNome: nome, peso, accuracy, contribuicao, ganhoPotencial });
      totalScore += contribuicao;
    }

    // Sort by ganho potencial descending (highest ROI first)
    breakdown.sort((a, b) => b.ganhoPotencial - a.ganhoPotencial);

    const topRecommendation = breakdown.length > 0 && breakdown[0].ganhoPotencial > 0
      ? breakdown[0].disciplinaNome
      : null;

    return {
      current: Math.round(totalScore * 10) / 10,
      breakdown,
      topRecommendation,
    };
  }, [topicos]);
}
