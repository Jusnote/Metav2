import { useMemo } from 'react';
import type { Disciplina, Topico } from './useDisciplinasManager';

interface HierarchyProgress {
  percentage: number;
  completed: number;
  total: number;
}

/**
 * Calcula o progresso de uma disciplina baseado nos topicos e subtopicos
 */
export const useDisciplinaProgress = (disciplina: Disciplina): HierarchyProgress => {
  return useMemo(() => {
    let totalItems = 0;
    let completedItems = 0;

    disciplina.topicos.forEach((topico) => {
      if (topico.subtopicos && topico.subtopicos.length > 0) {
        // Topico com subtopicos: conta os subtopicos
        topico.subtopicos.forEach((subtopico) => {
          totalItems++;
          if (subtopico.status === 'completed') {
            completedItems++;
          }
        });
      } else {
        // Topico sem subtopicos: conta o proprio topico
        totalItems++;
        if ((topico as any).status === 'completed') {
          completedItems++;
        }
      }
    });

    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return {
      percentage,
      completed: completedItems,
      total: totalItems
    };
  }, [disciplina]);
};

/**
 * Calcula o progresso de um topico baseado nos subtopicos
 */
export const useTopicoProgress = (topico: Topico): HierarchyProgress => {
  return useMemo(() => {
    const subtopicos = topico.subtopicos || [];
    const total = subtopicos.length;

    if (total === 0) {
      // Topico sem subtopicos: verificar o proprio status
      const isCompleted = (topico as any).status === 'completed';
      return {
        percentage: isCompleted ? 100 : 0,
        completed: isCompleted ? 1 : 0,
        total: 1
      };
    }

    const completed = subtopicos.filter((s) => s.status === 'completed').length;
    const percentage = Math.round((completed / total) * 100);

    return {
      percentage,
      completed,
      total
    };
  }, [topico, topico.subtopicos]);
};
