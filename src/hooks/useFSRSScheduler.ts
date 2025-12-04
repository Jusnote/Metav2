import { useCallback, useMemo } from 'react';
import { FSRS, Rating, Card, RecordLog, createEmptyCard } from 'ts-fsrs';
import { distributeItems, type StudyItem } from '@/lib/schedule-distribution';
import { getFSRSParameters } from '@/lib/fsrs-config';
import { useStudyConfig } from '@/hooks/useStudyConfig';

/**
 * Hook para calcular agendamento de revisões usando algoritmo FSRS
 * (Free Spaced Repetition Scheduler)
 *
 * Utiliza configuração global (user_study_config.fsrs_aggressiveness) para
 * determinar parâmetros de retenção e intervalos.
 */

interface FSRSScheduleParams {
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
}

interface ScheduleItemData {
  study_goal_id: string;
  topic_id?: string;
  subtopic_id?: string;
  title: string;
  scheduled_date: string;
  item_type: 'goal';
  sync_enabled: boolean;
  priority: number;
  estimated_duration: number;
  revision_type: 'initial_study_part1' | 'flashcards_only' | 'questions_only';
  revision_number: number;
  fsrs_state?: any;
  document_id?: string;
}

export function useFSRSScheduler() {
  // Ler configuração global do usuário
  const { config } = useStudyConfig();

  // Criar instância FSRS com parâmetros otimizados baseado em aggressiveness
  const fsrs = useMemo(() => {
    const aggressiveness = config?.fsrs_aggressiveness || 'balanced';
    const params = getFSRSParameters(aggressiveness);
    return new FSRS(params);
  }, [config?.fsrs_aggressiveness]);

  /**
   * Gera schedule completo para uma meta usando FSRS + Distribuição Inteligente
   */
  const generateSchedule = useCallback(
    async (params: FSRSScheduleParams): Promise<ScheduleItemData[]> => {
      const { goalId, startDate, targetDate, items, hoursPerDay, studyWeekends } = params;

      // Preparar items para distribuição inteligente
      const studyItems: StudyItem[] = items.map((item, index) => ({
        id: item.subtopicId || item.topicId || `item-${index}`,
        title: item.title,
        estimatedMinutes: item.estimatedMinutes,
        topicId: item.topicId,
        subtopicId: item.subtopicId,
      }));

      // Usar algoritmo inteligente de distribuição baseado em tempo
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
          `Não foi possível criar o schedule: ${distribution.warnings.join(', ')}. ` +
          `Por favor, ajuste o período, horas/dia ou reduza os itens selecionados.`
        );
      }

      // Converter para formato do schedule_items
      const scheduleItems: ScheduleItemData[] = distribution.scheduleItems.map((scheduleItem) => {
        // Determinar priority baseado no tipo de sessão
        let priority = 5;
        if (scheduleItem.sessionType === 'part1') priority = 7;
        if (scheduleItem.sessionType === 'part2') priority = 9;

        // Determinar revision_type
        let revisionType: 'initial_study_part1' | 'flashcards_only' | 'questions_only' = 'initial_study_part1';
        if (scheduleItem.sessionType === 'part2') revisionType = 'initial_study_part1'; // Será atualizado ao vincular
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

      // REVISÕES FSRS DINÂMICAS
      // NÃO criar revisões automaticamente!
      // As revisões serão criadas DINAMICAMENTE quando o usuário completar:
      // - Parte 2: cria Revisão 1 (baseado em rating combinado Part1+Part2)
      // - Revisão N: cria Revisão N+1 (baseado em rating da revisão atual)
      // Isso garante que o FSRS adapte baseado na performance REAL do usuário

      return scheduleItems;
    },
    []
  );

  /**
   * Calcula próxima revisão baseado em performance
   */
  const calculateNextRevision = useCallback(
    (
      currentCard: Card | null,
      rating: Rating,
      currentDate: Date
    ): {
      nextDate: Date;
      nextCard: Card;
      interval: number;
    } => {
      // Se não tem card anterior, criar novo
      const card = currentCard || createEmptyCard();

      // Calcular próxima revisão
      const scheduling = fsrs.repeat(card!, currentDate);
      const scheduleItem = scheduling[rating as keyof typeof scheduling];
      const nextCard = typeof scheduleItem === 'function' ? card : (scheduleItem as any).card;
      const nextDate = nextCard.due;

      // Calcular intervalo em dias
      const interval = Math.ceil(
        (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        nextDate,
        nextCard,
        interval,
      };
    },
    []
  );

  /**
   * Determina tipo de revisão baseado no rating
   */
  const getRevisionType = useCallback(
    (
      rating: Rating,
      lastRevisionType?: string
    ):
      | 'flashcards_only'
      | 'questions_only'
      | 'reading_and_flashcards'
      | 'reading_and_questions' => {
      // Rating EASY (>= 3.5) - sempre flashcards (mais leve)
      if (rating === Rating.Easy) {
        return 'flashcards_only';
      }

      // Rating GOOD (2.5-3.5) - alternar entre tipos
      if (rating === Rating.Good) {
        // Se é inicial ou última foi part2, começar com flashcards
        if (
          !lastRevisionType ||
          lastRevisionType.includes('initial_study') ||
          lastRevisionType === 'questions_only'
        ) {
          return 'flashcards_only';
        }
        return 'questions_only';
      }

      // Rating HARD (1.5-2.5) - esqueceu conceitos → reler + flashcards
      if (rating === Rating.Hard) {
        return 'reading_and_flashcards';
      }

      // Rating AGAIN (<1.5) - não entendeu → reler + questões
      return 'reading_and_questions';
    },
    []
  );

  /**
   * Converte performance numérica em Rating FSRS
   */
  const performanceToRating = useCallback((finalRating: number): Rating => {
    if (finalRating >= 3.5) return Rating.Easy;
    if (finalRating >= 2.5) return Rating.Good;
    if (finalRating >= 1.5) return Rating.Hard;
    return Rating.Again;
  }, []);

  /**
   * Calcula duração estimada baseado no tipo de revisão
   */
  const getEstimatedDuration = useCallback(
    (
      revisionType:
        | 'flashcards_only'
        | 'questions_only'
        | 'reading_and_flashcards'
        | 'reading_and_questions'
    ): number => {
      const durations = {
        flashcards_only: 10,
        questions_only: 15,
        reading_and_flashcards: 40,
        reading_and_questions: 45,
      };
      return durations[revisionType];
    },
    []
  );

  return {
    generateSchedule,
    calculateNextRevision,
    getRevisionType,
    performanceToRating,
    getEstimatedDuration,
  };
}
