import { useCallback } from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useScheduleItems } from './useScheduleItems';
import { format } from 'date-fns';

export interface ConflictInfo {
  hasConflict: boolean;
  availableHours: number;
  scheduledHours: number;
  remainingHours: number;
  newItemHours: number;
  totalAfterSchedule: number;
  overloadHours: number; // Quanto vai ultrapassar
  suggestedAvailability: number; // Sugestão de nova disponibilidade
}

export interface ConflictDetectionResult {
  checkConflict: (date: Date, durationMinutes: number, excludeItemId?: string) => ConflictInfo;
  wouldCauseConflict: (date: Date, durationMinutes: number, excludeItemId?: string) => boolean;
}

/**
 * Hook para detectar conflitos de agendamento
 * Verifica se agendar um item causaria sobrecarga no dia
 */
export function useConflictDetection(): ConflictDetectionResult {
  const { getDailyHours } = useStudyConfig();
  const { items } = useScheduleItems();

  /**
   * Verifica se agendar um item no dia causaria conflito
   * @param date Data do agendamento
   * @param durationMinutes Duração do item em minutos
   * @param excludeItemId ID do item a excluir do cálculo (útil para reagendamento)
   */
  const checkConflict = useCallback(
    (date: Date, durationMinutes: number, excludeItemId?: string): ConflictInfo => {
      // 1. Obter horas disponíveis do dia
      const availableHours = getDailyHours(date);

      // 2. Calcular horas já agendadas no dia (excluindo item sendo reagendado)
      const dateKey = format(date, 'yyyy-MM-dd');
      const scheduledMinutes = items
        .filter((item) => {
          if (item.id === excludeItemId) return false; // Excluir item sendo reagendado
          return item.scheduled_date === dateKey;
        })
        .reduce((sum, item) => sum + (item.estimated_duration || 0), 0);

      const scheduledHours = scheduledMinutes / 60;

      // 3. Calcular impacto do novo item
      const newItemHours = durationMinutes / 60;
      const totalAfterSchedule = scheduledHours + newItemHours;
      const remainingHours = availableHours - scheduledHours;
      const overloadHours = Math.max(0, totalAfterSchedule - availableHours);

      // 4. Sugerir nova disponibilidade (arredondar para cima para próxima hora)
      const suggestedAvailability = Math.ceil(totalAfterSchedule);

      // 5. Verificar se há conflito
      const hasConflict = totalAfterSchedule > availableHours;

      return {
        hasConflict,
        availableHours,
        scheduledHours,
        remainingHours,
        newItemHours,
        totalAfterSchedule,
        overloadHours,
        suggestedAvailability,
      };
    },
    [getDailyHours, items]
  );

  /**
   * Versão simplificada que retorna apenas boolean
   */
  const wouldCauseConflict = useCallback(
    (date: Date, durationMinutes: number, excludeItemId?: string): boolean => {
      return checkConflict(date, durationMinutes, excludeItemId).hasConflict;
    },
    [checkConflict]
  );

  return {
    checkConflict,
    wouldCauseConflict,
  };
}
