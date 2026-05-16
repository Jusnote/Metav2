/**
 * useWeekTasks — adapter que converte ScheduleItem (schema novo)
 * para a forma `WeekTask` que o drawer consome.
 *
 * Recebe (planoId, weekNumber) e retorna tasks já formatadas,
 * stats agregadas da semana (quando existirem) e toggleDone.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCronogramaWeek } from './useCronogramaWeek';
import type { ScheduleItem, ScheduleItemType, WeeklyStats } from '@/types/cronograma';

export interface WeekTask {
  id: string;
  n: number;
  disc: string;
  tipo: string;
  titulo: string;
  conceitoPai: string | null;
  rel: number;
  time: string;
  desemp: string;
  code: string;
  done: boolean;
}

export interface UseWeekTasksResult {
  tasks: WeekTask[];
  stats: WeeklyStats | null;
  isLoading: boolean;
  toggleDone: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${String(m).padStart(2, '0')}min`;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m`;
}

function mapTipo(type: ScheduleItemType, revisionNumber: number): string {
  if (type === 'flashcards') return 'Flashcards';
  if (type === 'revisao' || revisionNumber > 0) return 'Revisão';
  if (type === 'questoes') return 'Questões';
  if (type === 'estudo_inicial_p1') return 'Teoria';
  if (type === 'estudo_inicial_p2') return 'Prática';
  if (type === 'simulado') return 'Simulado';
  if (type === 'lei_seca') return 'Lei seca';
  return 'Estudo';
}

function shortCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function useWeekTasks(
  planoId: string | null | undefined,
  weekNumber: number | null | undefined,
): UseWeekTasksResult {
  const { items, stats, isLoading, toggleComplete, refresh } = useCronogramaWeek(
    planoId,
    weekNumber,
  );
  const [disciplinaMap, setDisciplinaMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const ids = Array.from(
      new Set(items.map((i) => i.disciplina_id).filter((id): id is string => !!id)),
    );
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('disciplinas')
        .select('id, nome')
        .in('id', ids);
      if (cancelled || !data) return;
      const next = new Map<string, string>();
      for (const d of data as Array<{ id: string; nome: string }>) {
        next.set(d.id, d.nome);
      }
      setDisciplinaMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const tasks = useMemo<WeekTask[]>(() => {
    return items.map((item: ScheduleItem, idx: number) => ({
      id: item.id,
      n: idx + 1,
      disc: item.disciplina_id ? (disciplinaMap.get(item.disciplina_id) ?? '—') : '—',
      tipo: mapTipo(item.type, item.revision_number),
      titulo: item.title,
      conceitoPai: item.subtopicos?.conceito_pai ?? null,
      rel: 3,
      time: formatDuration(item.estimated_duration_minutes),
      desemp: '—',
      code: shortCode(item.id),
      done: item.status === 'concluido',
    }));
  }, [items, disciplinaMap]);

  return { tasks, stats, isLoading, toggleDone: toggleComplete, refresh };
}
