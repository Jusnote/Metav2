import { useMemo } from 'react';
import type { Unit, Topic } from './useUnitsManager';

interface HierarchyProgress {
  percentage: number;
  completed: number;
  total: number;
}

/**
 * Calcula o progresso de uma unidade baseado nos tópicos e subtópicos
 */
export const useUnitProgress = (unit: Unit): HierarchyProgress => {
  return useMemo(() => {
    let totalItems = 0;
    let completedItems = 0;

    unit.topics.forEach((topic) => {
      if (topic.subtopics && topic.subtopics.length > 0) {
        // Tópico com subtópicos: conta os subtópicos
        topic.subtopics.forEach((subtopic) => {
          totalItems++;
          if (subtopic.status === 'completed') {
            completedItems++;
          }
        });
      } else {
        // Tópico sem subtópicos: conta o próprio tópico
        totalItems++;
        if ((topic as any).status === 'completed') {
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
  }, [unit]);
};

/**
 * Calcula o progresso de um tópico baseado nos subtópicos
 */
export const useTopicProgress = (topic: Topic): HierarchyProgress => {
  return useMemo(() => {
    const subtopics = topic.subtopics || [];
    const total = subtopics.length;

    if (total === 0) {
      // Tópico sem subtópicos: verificar o próprio status
      const isCompleted = (topic as any).status === 'completed';
      return {
        percentage: isCompleted ? 100 : 0,
        completed: isCompleted ? 1 : 0,
        total: 1
      };
    }

    const completed = subtopics.filter((s) => s.status === 'completed').length;
    const percentage = Math.round((completed / total) * 100);

    return {
      percentage,
      completed,
      total
    };
  }, [topic, topic.subtopics]);
};
