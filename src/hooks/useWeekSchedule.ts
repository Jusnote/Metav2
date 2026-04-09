import { useMemo } from 'react';

export interface WeekActivity {
  id: string;
  title: string;
  disciplina: string;
  type: 'estudo' | 'revisao' | 'questoes' | 'lei-seca';
  durationMinutes: number;
  completed: boolean;
  suggested: boolean;
  deadlineLabel?: string;  // e.g., "até quarta"
  pointsValue: number;
  context?: string;  // e.g., "CF Art. 5°", "15 questões"
}

export interface WeekStats {
  total: number;
  completed: number;
  byType: {
    estudo: { done: number; total: number };
    revisao: { done: number; total: number };
    questoes: { done: number; total: number };
    'lei-seca': { done: number; total: number };
  };
  totalMinutes: number;
  completedMinutes: number;
  totalPoints: number;
  earnedPoints: number;
}

const MOCK_ACTIVITIES: Omit<WeekActivity, 'id' | 'completed' | 'suggested'>[] = [
  { title: 'Homicídio — Parte 1', disciplina: 'Dir. Penal', type: 'estudo', durationMinutes: 40, pointsValue: 0.8, context: 'CP Art. 121' },
  { title: 'Homicídio — Parte 2', disciplina: 'Dir. Penal', type: 'estudo', durationMinutes: 25, pointsValue: 0.6 },
  { title: 'Homicídio — Revisão 1', disciplina: 'Dir. Penal', type: 'revisao', durationMinutes: 15, pointsValue: 0.4 },
  { title: 'Dir. Fundamentais — Parte 1', disciplina: 'Dir. Constitucional', type: 'estudo', durationMinutes: 35, pointsValue: 1.0, context: 'CF Art. 5°' },
  { title: 'Dir. Fundamentais — Parte 2', disciplina: 'Dir. Constitucional', type: 'estudo', durationMinutes: 30, pointsValue: 1.1, context: 'CF Art. 5°' },
  { title: 'Dir. Fundamentais — Revisão 2', disciplina: 'Dir. Constitucional', type: 'revisao', durationMinutes: 15, pointsValue: 0.4, context: 'CF Art. 5°', deadlineLabel: 'até amanhã' },
  { title: 'CF Art. 5° — Lei Seca', disciplina: 'Dir. Constitucional', type: 'lei-seca', durationMinutes: 20, pointsValue: 0.3 },
  { title: 'Questões Mistas — Const. + Penal', disciplina: 'Misto', type: 'questoes', durationMinutes: 20, pointsValue: 0.3, context: '15 questões' },
  { title: 'Furto e Roubo — Parte 1', disciplina: 'Dir. Penal', type: 'estudo', durationMinutes: 40, pointsValue: 1.2, context: 'CP Art. 155-157' },
  { title: 'Questões Mistas — Penal + Constitucional', disciplina: 'Misto', type: 'questoes', durationMinutes: 20, pointsValue: 0.3, context: '15 questões' },
  { title: 'Atos Administrativos — Questões', disciplina: 'Dir. Administrativo', type: 'questoes', durationMinutes: 30, pointsValue: 0.5, context: '15 questões' },
  { title: 'Crimes contra a Fé Pública — Parte 1', disciplina: 'Dir. Penal', type: 'estudo', durationMinutes: 45, pointsValue: 0.9, context: 'Art. 289-311 CP' },
  { title: 'Licitações — Revisão 1', disciplina: 'Dir. Administrativo', type: 'revisao', durationMinutes: 15, pointsValue: 0.3, context: 'Lei 14.133/21' },
  { title: 'Poder Judiciário — Lei Seca', disciplina: 'Dir. Constitucional', type: 'lei-seca', durationMinutes: 25, pointsValue: 0.2, context: 'CF Art. 92-126' },
  { title: 'Lesão Corporal — Revisão 2', disciplina: 'Dir. Penal', type: 'revisao', durationMinutes: 15, pointsValue: 0.4, context: 'CP Art. 129', deadlineLabel: 'até sexta' },
  { title: 'Questões Mistas — Admin. + Penal', disciplina: 'Misto', type: 'questoes', durationMinutes: 20, pointsValue: 0.3, context: '10 questões' },
  { title: 'Dir. Fundamentais — Revisão 3', disciplina: 'Dir. Constitucional', type: 'revisao', durationMinutes: 15, pointsValue: 0.4 },
  { title: 'CF Art. 37 — Lei Seca', disciplina: 'Dir. Administrativo', type: 'lei-seca', durationMinutes: 20, pointsValue: 0.2, context: 'Princípios da AP' },
];

/**
 * Hook for weekly schedule data.
 * v1: deterministic mock data based on week offset.
 * TODO: Replace with real schedule_items Supabase query.
 */
export function useWeekSchedule(weekMonday: Date) {
  const activities: WeekActivity[] = useMemo(() => {
    // Use week offset from a reference date to determine how many are "completed"
    const refDate = new Date(2026, 3, 7); // April 7, 2026
    const diffDays = Math.floor((weekMonday.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor(diffDays / 7);

    // For the reference week (index 0): first 7 completed, rest pending
    // For future weeks: fewer completed. For past weeks: more completed.
    const completedCount = Math.max(0, Math.min(MOCK_ACTIVITIES.length, 7 - weekIndex * 2));

    // Suggest 3 items for "today" from the pending ones
    const suggestStart = completedCount;
    const suggestEnd = Math.min(suggestStart + 3, MOCK_ACTIVITIES.length);

    return MOCK_ACTIVITIES.map((a, i) => ({
      ...a,
      id: `week-${weekIndex}-${i}`,
      completed: i < completedCount,
      suggested: i >= suggestStart && i < suggestEnd,
    }));
  }, [weekMonday]);

  const stats: WeekStats = useMemo(() => {
    const byType = {
      estudo: { done: 0, total: 0 },
      revisao: { done: 0, total: 0 },
      questoes: { done: 0, total: 0 },
      'lei-seca': { done: 0, total: 0 },
    };

    let completedMinutes = 0;
    let totalMinutes = 0;
    let earnedPoints = 0;
    let totalPoints = 0;

    for (const a of activities) {
      byType[a.type].total++;
      if (a.completed) byType[a.type].done++;
      totalMinutes += a.durationMinutes;
      totalPoints += a.pointsValue;
      if (a.completed) {
        completedMinutes += a.durationMinutes;
        earnedPoints += a.pointsValue;
      }
    }

    return {
      total: activities.length,
      completed: activities.filter(a => a.completed).length,
      byType,
      totalMinutes,
      completedMinutes,
      totalPoints: Math.round(totalPoints * 10) / 10,
      earnedPoints: Math.round(earnedPoints * 10) / 10,
    };
  }, [activities]);

  return { activities, stats };
}
