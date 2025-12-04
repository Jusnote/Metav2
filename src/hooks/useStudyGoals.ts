import { useServerFirst } from '@/hooks/useServerFirst';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useCallback } from 'react';
import { StudyGoal, StudyGoalInsert } from '@/types/database';
import { useFSRSScheduler } from './useFSRSScheduler';
import { distributeItems, type StudyItem } from '@/lib/schedule-distribution';

interface CreateGoalWithScheduleParams {
  goalData: Omit<
    StudyGoalInsert,
    'id' | 'user_id' | 'progress_percentage' | 'completed' | 'created_at' | 'updated_at'
  >;
  items: Array<{
    topicId?: string;
    subtopicId?: string;
    title: string;
    estimatedMinutes: number;
    documentId?: string;
  }>;
}

export function useStudyGoals() {
  const {
    data: goals,
    isLoading: goalsLoading,
    create: createGoal,
    update: updateGoal,
    remove: removeGoal,
  } = useServerFirst<StudyGoal>({
    tableName: 'study_goals',
    realtime: true,
    cacheTimeout: 5 * 60 * 1000,
  });


  const { generateSchedule } = useFSRSScheduler();

  /**
   * Criar meta e gerar schedule_items automaticamente
   */
  const createGoalWithSchedule = useCallback(
    async ({ goalData, items }: CreateGoalWithScheduleParams) => {
      try {
        // 0. Obter user_id do usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // 1. Buscar configuração global do usuário
        const { data: userConfig, error: configError } = await supabase
          .from('user_study_config')
          .select('weekday_hours, weekend_hours, daily_exceptions, fsrs_aggressiveness')
          .eq('user_id', user.id)
          .single();

        if (configError || !userConfig) {
          throw new Error('User study config not found. Please configure your study settings first.');
        }

        // 2. Criar a meta
        const goal = await createGoal(goalData as any);
        if (!goal) throw new Error('Failed to create goal');

        // 3. Converter strings de data para Date sem problema de timezone
        const parseLocalDate = (dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day); // month é 0-indexed
        };

        // 4. Calcular média de horas por dia baseado na config global
        const startDate = parseLocalDate(goalData.start_date);
        const endDate = parseLocalDate(goalData.target_date);
        const hoursPerDay = calculateAverageHoursPerDay(
          startDate,
          endDate,
          goalData.study_weekends || false,
          userConfig.weekday_hours || 3,
          userConfig.weekend_hours || 5,
          (userConfig.daily_exceptions as any) || {}
        );

        let scheduleItems;

        if (goalData.enable_fsrs) {
          // Usar FSRS para calcular revisões otimizadas
          scheduleItems = await generateSchedule({
            goalId: goal.id,
            startDate,
            targetDate: endDate,
            items,
            hoursPerDay,
            studyWeekends: goalData.study_weekends || false,
          });
        } else {
          // Usar distribuição simples (sem FSRS)
          scheduleItems = await generateSimpleSchedule({
            goalId: goal.id,
            startDate,
            targetDate: endDate,
            items,
            hoursPerDay,
            studyWeekends: goalData.study_weekends || false,
          });
        }

        // 3. Adicionar user_id a todos os itens
        const itemsWithUserId = scheduleItems.map(item => ({
          ...item,
          user_id: user.id,
        }));

        // 4. Inserir todos os schedule_items no banco
        const { error } = await supabase
          .from('schedule_items')
          .insert(itemsWithUserId);

        if (error) {
          console.error('Failed to create schedule items:', error);
          throw error;
        }

        return { goal, scheduleItems: itemsWithUserId };
      } catch (error) {
        console.error('Error creating goal with schedule:', error);
        throw error;
      }
    },
    [createGoal, generateSchedule]
  );

  /**
   * Atualizar progresso da meta baseado nos schedule_items
   */
  const updateGoalProgress = useCallback(
    async (goalId: string) => {
      try {
        const { data: items, error } = await supabase
          .from('schedule_items')
          .select('completed')
          .eq('study_goal_id', goalId)
          .is('deleted_at', null);

        if (error || !items) {
          console.error('Failed to fetch schedule items:', error);
          return;
        }

        const total = items.length;
        const completed = items.filter((i) => i.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        await updateGoal(goalId, {
          progress_percentage: percentage,
          completed: percentage === 100,
          completed_at: percentage === 100 ? new Date().toISOString() : null,
        });

        return { total, completed, percentage };
      } catch (error) {
        console.error('Error updating goal progress:', error);
      }
    },
    [updateGoal]
  );

  /**
   * Buscar metas ativas (não completadas)
   */
  const activeGoals = useMemo(() => {
    return goals?.filter((g) => !g.completed) || [];
  }, [goals]);

  /**
   * Buscar metas completadas
   */
  const completedGoals = useMemo(() => {
    return goals?.filter((g) => g.completed) || [];
  }, [goals]);

  /**
   * Verificar se há metas ativas que fazem overlap com o período fornecido
   */
  const checkGoalOverlap = useCallback((startDate: Date, endDate: Date, excludeGoalId?: string) => {
    if (!goals) return null;

    const start = startDate.getTime();
    const end = endDate.getTime();

    const overlappingGoals = goals.filter((goal) => {
      // Ignorar meta sendo editada
      if (excludeGoalId && goal.id === excludeGoalId) return false;

      // Ignorar metas completadas
      if (goal.completed) return false;

      // Converter datas da meta para timestamp
      const goalStart = new Date(goal.start_date).getTime();
      const goalEnd = new Date(goal.target_date).getTime();

      // Verificar overlap: (StartA <= EndB) AND (EndA >= StartB)
      return start <= goalEnd && end >= goalStart;
    });

    return overlappingGoals.length > 0 ? overlappingGoals : null;
  }, [goals]);

  /**
   * Converter itens manuais para vincular a uma meta
   */
  const convertManualItemsToGoal = useCallback(
    async (itemIds: string[], goalId: string) => {
      try {
        const { error } = await supabase
          .from('schedule_items')
          .update({
            study_goal_id: goalId,
            item_type: 'goal',
          })
          .in('id', itemIds);

        if (error) {
          console.error('Failed to convert manual items:', error);
          throw error;
        }

        return true;
      } catch (error) {
        console.error('Error converting manual items to goal:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Deletar itens manuais (soft delete)
   */
  const deleteManualItems = useCallback(
    async (itemIds: string[]) => {
      try {
        const { error } = await supabase
          .from('schedule_items')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', itemIds);

        if (error) {
          console.error('Failed to delete manual items:', error);
          throw error;
        }

        return true;
      } catch (error) {
        console.error('Error deleting manual items:', error);
        throw error;
      }
    },
    []
  );

  return {
    goals: goals || [],
    activeGoals,
    completedGoals,
    isLoading: goalsLoading,
    createGoal,
    createGoalWithSchedule,
    updateGoal,
    removeGoal,
    updateGoalProgress,
    checkGoalOverlap,
    convertManualItemsToGoal,
    deleteManualItems,
  };
}

/**
 * Calcula média de horas disponíveis por dia baseado na config global
 */
function calculateAverageHoursPerDay(
  startDate: Date,
  endDate: Date,
  studyWeekends: boolean,
  weekdayHours: number,
  weekendHours: number,
  dailyExceptions: Record<string, { hours: number; reason?: string }>
): number {
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  let totalHours = 0;
  let validDays = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Pular fins de semana se não estuda
    if (isWeekend && !studyWeekends) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const dateKey = formatDate(current);
    const exception = dailyExceptions[dateKey];

    // Usar exceção se existir, senão usar padrão
    const dailyHours = exception ? exception.hours : (isWeekend ? weekendHours : weekdayHours);

    totalHours += dailyHours;
    validDays++;

    current.setDate(current.getDate() + 1);
  }

  return validDays > 0 ? totalHours / validDays : 3; // Fallback: 3h/dia
}

/**
 * Função auxiliar: Distribuição inteligente baseada em tempo (não-FSRS)
 */
async function generateSimpleSchedule(params: {
  goalId: string;
  startDate: Date;
  targetDate: Date;
  items: Array<{
    topicId?: string;
    subtopicId?: string;
    title: string;
    estimatedMinutes: number;
    documentId?: string;
  }>;
  hoursPerDay: number;
  studyWeekends: boolean;
}) {
  const { goalId, startDate, targetDate, items, hoursPerDay, studyWeekends } = params;

  // Preparar items para o algoritmo de distribuição
  const studyItems: StudyItem[] = items.map((item, index) => ({
    id: item.subtopicId || item.topicId || `item-${index}`,
    title: item.title,
    estimatedMinutes: item.estimatedMinutes,
    topicId: item.topicId,
    subtopicId: item.subtopicId,
  }));

  // Usar algoritmo inteligente de distribuição
  const distribution = await distributeItems({
    items: studyItems,
    startDate,
    endDate: targetDate,
    hoursPerDay,
    studyWeekends,
    forceScheduling: false, // Criação real: NÃO forçar agendamento
  });

  // Validar se a distribuição foi bem-sucedida
  if (distribution.scenario === 'impossible' || distribution.scheduleItems.length === 0) {
    throw new Error(
      `Não foi possível criar a meta: ${distribution.warnings.join(', ')}. ` +
      `Por favor, ajuste o período, horas/dia ou reduza os itens selecionados.`
    );
  }

  // Converter para formato do schedule_items
  const scheduleItems = distribution.scheduleItems.map((scheduleItem) => {
    // Determinar priority baseado no tipo de sessão
    let priority = 5;
    if (scheduleItem.sessionType === 'part1') priority = 7;
    if (scheduleItem.sessionType === 'part2') priority = 9;

    // Determinar revision_type
    let revisionType = 'initial_study_part1';
    if (scheduleItem.sessionType === 'part2') revisionType = 'initial_study_part2';
    if (scheduleItem.sessionType === 'revision') revisionType = 'flashcards_only';

    // Encontrar documentId do item original
    const originalItem = items.find(
      (item) =>
        item.subtopicId === scheduleItem.subtopicId ||
        item.topicId === scheduleItem.topicId
    );

    return {
      study_goal_id: goalId,
      topic_id: scheduleItem.topicId,
      subtopic_id: scheduleItem.subtopicId,
      title: scheduleItem.title,
      scheduled_date: scheduleItem.date,
      item_type: 'goal' as const,
      sync_enabled: true,
      priority,
      estimated_duration: scheduleItem.durationMinutes,
      revision_type: revisionType,
      revision_number: scheduleItem.revisionNumber,
      document_id: originalItem?.documentId,
    };
  });

  return scheduleItems;
}
