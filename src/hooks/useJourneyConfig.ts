/**
 * useJourneyConfig — DEPRECATED. Mantido como adapter sobre useCronogramaActivo
 * para não quebrar imports antigos. Novos consumidores devem usar
 * useCronogramaActivo diretamente.
 */
import { useCronogramaActivo } from './useCronogramaActivo';

export interface JourneyConfig {
  totalWeeks: number;
  currentWeek: number;
  currentWeekProgress: number;
  startDate: Date | null;
  endDate: Date | null;
  hasActivePlan: boolean;
  isReady: boolean;
}

export function useJourneyConfig(): JourneyConfig {
  const {
    totalWeeks,
    currentWeek,
    currentWeekProgress,
    startDate,
    endDate,
    hasActivePlan,
    isLoading,
  } = useCronogramaActivo();

  return {
    totalWeeks,
    currentWeek,
    currentWeekProgress,
    startDate,
    endDate,
    hasActivePlan,
    isReady: !isLoading,
  };
}
