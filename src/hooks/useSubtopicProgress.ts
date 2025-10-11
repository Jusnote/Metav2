import { useMemo } from 'react';

interface MaterialCounts {
  documents: number;
  flashcards: number;
  questions: number;
}

interface SubtopicProgressResult {
  percentage: number;
  totalMaterials: number;
  completedMaterials: number;
  hasAnyMaterial: boolean;
}

/**
 * Calcula o progresso de um subtópico baseado nos materiais disponíveis
 *
 * Critérios:
 * - Cada tipo de material conta como 33.33% do total
 * - Documentos: considera "completo" se houver pelo menos 1
 * - Flashcards: considera "completo" se houver pelo menos 5
 * - Questões: considera "completo" se houver pelo menos 3
 */
export const useSubtopicProgress = (
  counts: MaterialCounts,
  status?: 'not-started' | 'in-progress' | 'completed'
): SubtopicProgressResult => {
  return useMemo(() => {
    // Se o status for "completed", retorna 100%
    if (status === 'completed') {
      return {
        percentage: 100,
        totalMaterials: 3,
        completedMaterials: 3,
        hasAnyMaterial: true
      };
    }

    const { documents, flashcards, questions } = counts;

    // Critérios de completude por tipo
    const hasDocuments = documents >= 1;
    const hasFlashcards = flashcards >= 5;
    const hasQuestions = questions >= 3;

    // Contar materiais completos
    let completedCount = 0;
    if (hasDocuments) completedCount++;
    if (hasFlashcards) completedCount++;
    if (hasQuestions) completedCount++;

    // Calcular porcentagem (cada tipo vale 33.33%)
    const percentage = (completedCount / 3) * 100;

    const hasAnyMaterial = documents > 0 || flashcards > 0 || questions > 0;

    return {
      percentage: Math.round(percentage),
      totalMaterials: 3,
      completedMaterials: completedCount,
      hasAnyMaterial
    };
  }, [counts.documents, counts.flashcards, counts.questions, status]);
};
