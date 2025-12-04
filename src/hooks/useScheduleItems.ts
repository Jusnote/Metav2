import { useServerFirst } from '@/hooks/useServerFirst';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useCallback } from 'react';
import { ScheduleItem, ScheduleItemInsert, ScheduleItemUpdate } from '@/types/database';
import { useFSRSScheduler } from './useFSRSScheduler';

interface UseScheduleItemsOptions {
  startDate?: Date;
  endDate?: Date;
  unitId?: string;
  topicId?: string;
  subtopicId?: string;
  studyGoalId?: string;
  completed?: boolean;
}

interface PerformanceData {
  time_score?: number;
  flashcard_score?: number;
  questions_score?: number;
  completion_score?: number;
  final_rating?: number;
  fsrs_rating?: string;
  flashcard_details?: {
    easy: number;
    good: number;
    hard: number;
    again: number;
    total: number;
    avg_rating: number;
  };
  questions_details?: {
    total: number;
    correct: number;
    accuracy: number;
  };
  combined_from_part1?: string;
}

export function useScheduleItems(options: UseScheduleItemsOptions = {}) {
  const {
    data: allItems,
    isLoading,
    create,
    update,
    remove,
  } = useServerFirst<ScheduleItem>({
    tableName: 'schedule_items',
    realtime: true,
    cacheTimeout: 5 * 60 * 1000, // 5 min cache
    enableOfflineQueue: true,
  });

  const {
    calculateNextRevision,
    getRevisionType,
    performanceToRating,
    getEstimatedDuration,
  } = useFSRSScheduler();

  // Filtrar items baseado nas opções
  const filteredItems = useMemo(() => {
    if (!allItems) return [];

    return allItems.filter((item) => {
      // Ignorar deletados
      if (item.deleted_at) return false;

      // Filtro de datas
      if (options.startDate && new Date(item.scheduled_date) < options.startDate) {
        return false;
      }
      if (options.endDate && new Date(item.scheduled_date) > options.endDate) {
        return false;
      }

      // Filtros de hierarquia
      if (options.unitId && item.unit_id !== options.unitId) return false;
      if (options.topicId && item.topic_id !== options.topicId) return false;
      if (options.subtopicId && item.subtopic_id !== options.subtopicId) return false;

      // Filtro de meta
      if (options.studyGoalId && item.study_goal_id !== options.studyGoalId)
        return false;

      // Filtro de completed
      if (options.completed !== undefined && item.completed !== options.completed)
        return false;

      return true;
    });
  }, [allItems, options]);

  // Agrupar por data
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};

    filteredItems.forEach((item) => {
      if (!grouped[item.scheduled_date]) {
        grouped[item.scheduled_date] = [];
      }
      grouped[item.scheduled_date].push(item);
    });

    // Ordenar itens dentro de cada data por prioridade
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    });

    return grouped;
  }, [filteredItems]);

  // Estatísticas
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completed = filteredItems.filter((i) => i.completed).length;
    const pending = filteredItems.filter((i) => !i.completed).length;
    const overdue = filteredItems.filter(
      (i) => !i.completed && new Date(i.scheduled_date) < today
    ).length;

    return { completed, pending, overdue, total: filteredItems.length };
  }, [filteredItems]);

  // Agendar um novo item
  const scheduleItem = useCallback(
    async (data: Omit<ScheduleItemInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      return await create(data as any);
    },
    [create]
  );

  // Completar item e processar próxima revisão automaticamente
  const completeItem = useCallback(
    async (
      itemId: string,
      performanceData: PerformanceData,
      actualDuration?: number
    ) => {
      // Buscar item atual
      const item = filteredItems.find((i) => i.id === itemId);
      if (!item) throw new Error('Item not found');

      // 1. Marcar item como completo
      await update(itemId, {
        completed: true,
        completed_at: new Date().toISOString(),
        actual_duration: actualDuration,
        performance_data: performanceData as any,
      });

      // 2. Se for initial_study_part1, criar part2 automaticamente
      if (item.revision_type === 'initial_study_part1') {
        const part2Date = new Date(item.scheduled_date);
        part2Date.setDate(part2Date.getDate() + 1);

        const part2 = await create({
          title: item.title.replace('Parte 1', 'Parte 2'),
          scheduled_date: part2Date.toISOString().split('T')[0],
          subtopic_id: item.subtopic_id,
          topic_id: item.topic_id,
          unit_id: item.unit_id,
          item_type: item.item_type,
          study_goal_id: item.study_goal_id,
          revision_type: 'initial_study_part1', // será identificado como part2 pelo parent_item_id
          revision_number: 0,
          estimated_duration: 15,
          priority: 9,
          sync_enabled: item.sync_enabled,
          document_id: item.document_id,
          parent_item_id: itemId,
        } as any);

        return { completed: true, nextItem: part2 };
      }

      // 3. Se for initial_study_part2, calcular rating e criar primeira revisão
      if (
        item.revision_type === 'initial_study_part1' &&
        item.parent_item_id
      ) {
        // Buscar dados da parte 1
        const part1 = allItems?.find((i) => i.id === item.parent_item_id);
        if (!part1) {
          console.error('Part 1 not found');
          return { completed: true };
        }

        const part1Data = part1.performance_data as PerformanceData;

        // Calcular rating final combinado
        const finalRating = calculateCombinedRating(part1Data, performanceData);
        const fsrsRating = performanceToRating(finalRating);

        // Calcular próxima revisão
        const nextRevision = calculateNextRevision(
          null, // novo card
          fsrsRating,
          new Date()
        );

        const nextRevisionType = getRevisionType(
          fsrsRating,
          'initial_study_part2'
        );

        // Criar próxima revisão
        const nextItem = await create({
          title: `${item.title.split(' - ')[0]} - Revisão 1`,
          scheduled_date: nextRevision.nextDate.toISOString().split('T')[0],
          subtopic_id: item.subtopic_id,
          topic_id: item.topic_id,
          unit_id: item.unit_id,
          item_type: item.item_type,
          study_goal_id: item.study_goal_id,
          revision_type: nextRevisionType,
          revision_number: 1,
          estimated_duration: getEstimatedDuration(nextRevisionType),
          priority: 5,
          sync_enabled: item.sync_enabled,
          document_id: item.document_id,
          parent_item_id: itemId,
          fsrs_state: JSON.stringify(nextRevision.nextCard),
        } as any);

        // Atualizar part2 com link para próxima revisão
        await update(itemId, {
          next_revision_id: nextItem?.id,
          performance_data: {
            ...performanceData,
            combined_from_part1: part1.id,
            final_rating: finalRating,
            fsrs_rating: Rating[fsrsRating],
          } as any,
        });

        return { completed: true, nextItem };
      }

      // 4. Se for revisão (flashcards/questions/reading), calcular próxima
      if (
        (item.revision_number || 0) > 0 &&
        item.fsrs_state &&
        performanceData.final_rating
      ) {
        const fsrsRating = performanceToRating(performanceData.final_rating);
        const currentCard = JSON.parse(item.fsrs_state as string);

        // Calcular próxima revisão
        const nextRevision = calculateNextRevision(
          currentCard,
          fsrsRating,
          new Date()
        );

        const nextRevisionType = getRevisionType(fsrsRating, item.revision_type || 'flashcards_only');

        // Criar próxima revisão
        const nextItem = await create({
          title: `${item.title.split(' - Revisão ')[0]} - Revisão ${(item.revision_number || 0) + 1}`,
          scheduled_date: nextRevision.nextDate.toISOString().split('T')[0],
          subtopic_id: item.subtopic_id,
          topic_id: item.topic_id,
          unit_id: item.unit_id,
          item_type: item.item_type,
          study_goal_id: item.study_goal_id,
          revision_type: nextRevisionType,
          revision_number: (item.revision_number || 0) + 1,
          estimated_duration: getEstimatedDuration(nextRevisionType),
          priority: fsrsRating === Rating.Again ? 10 : fsrsRating === Rating.Hard ? 8 : 5,
          sync_enabled: item.sync_enabled,
          document_id: item.document_id,
          parent_item_id: itemId,
          fsrs_state: JSON.stringify(nextRevision.nextCard),
          notes:
            fsrsRating === Rating.Again
              ? '⚠️ CRÍTICO - Esquecimento grave detectado'
              : fsrsRating === Rating.Hard
              ? '⚠️ Reforço necessário'
              : undefined,
        } as any);

        // Atualizar item atual com link
        await update(itemId, {
          next_revision_id: nextItem?.id,
        });

        return { completed: true, nextItem };
      }

      return { completed: true };
    },
    [
      filteredItems,
      allItems,
      update,
      create,
      calculateNextRevision,
      getRevisionType,
      performanceToRating,
      getEstimatedDuration,
    ]
  );

  // Marcar como completo (simples - sem criar revisões)
  const markComplete = useCallback(
    async (itemId: string, actualDuration?: number) => {
      return await update(itemId, {
        completed: true,
        completed_at: new Date().toISOString(),
        actual_duration: actualDuration,
      });
    },
    [update]
  );

  // Marcar como incompleto
  const markIncomplete = useCallback(
    async (itemId: string) => {
      return await update(itemId, {
        completed: false,
        completed_at: null,
        actual_duration: null,
      });
    },
    [update]
  );

  // Reagendar item
  const reschedule = useCallback(
    async (itemId: string, newDate: Date) => {
      return await update(itemId, {
        scheduled_date: newDate.toISOString().split('T')[0],
      });
    },
    [update]
  );

  // Soft delete
  const softDelete = useCallback(
    async (itemId: string) => {
      return await update(itemId, {
        deleted_at: new Date().toISOString(),
      });
    },
    [update]
  );

  return {
    items: filteredItems,
    itemsByDate,
    stats,
    isLoading,
    scheduleItem,
    completeItem,
    updateItem: update,
    removeItem: remove,
    markComplete,
    markIncomplete,
    reschedule,
    softDelete,
  };
}

// Funções auxiliares

/**
 * Calcula rating combinado de Part1 + Part2
 */
function calculateCombinedRating(
  part1Data: PerformanceData,
  part2Data: PerformanceData
): number {
  const timeScore = part1Data.time_score || 3;
  const flashcardScore = part1Data.flashcard_score || 3;
  const questionsScore = part2Data.questions_score || 3;
  const completionScore = part1Data.completion_score || 4;

  return (
    timeScore * 0.25 +
    flashcardScore * 0.3 +
    questionsScore * 0.35 +
    completionScore * 0.1
  );
}

/**
 * Enum Rating (para usar no código)
 */
enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}
