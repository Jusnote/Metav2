import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ScheduleItem, ScheduleItemStatus, WeeklyStats } from '@/types/cronograma';

export interface UseCronogramaWeekResult {
  items: ScheduleItem[];
  stats: WeeklyStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleComplete: (itemId: string) => Promise<void>;
  setStatus: (itemId: string, status: ScheduleItemStatus) => Promise<void>;
}

/**
 * Carrega items + stats da semana N de um plano.
 * Filtra por (plano_id, week_number). Lista vazia se ainda não há geração.
 */
export function useCronogramaWeek(
  planoId: string | null | undefined,
  weekNumber: number | null | undefined,
): UseCronogramaWeekResult {
  const enabled = !!planoId && typeof weekNumber === 'number' && weekNumber > 0;
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setStats(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [{ data: itemRows, error: itemsErr }, { data: statsRow }] = await Promise.all([
        supabase
          .from('schedule_items')
          .select('*, subtopicos:subtopico_id(conceito_pai)')
          .eq('plano_id', planoId!)
          .eq('week_number', weekNumber!)
          .order('scheduled_date', { ascending: true })
          .order('priority', { ascending: false }),
        supabase
          .from('weekly_stats')
          .select('*')
          .eq('plano_id', planoId!)
          .eq('week_number', weekNumber!)
          .maybeSingle(),
      ]);

      if (itemsErr) throw itemsErr;
      setItems((itemRows as unknown as ScheduleItem[]) ?? []);
      setStats((statsRow as unknown as WeeklyStats) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, planoId, weekNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = useCallback(
    async (itemId: string, status: ScheduleItemStatus) => {
      const completedAt =
        status === 'concluido' ? new Date().toISOString() : null;
      const { error: updErr } = await supabase
        .from('schedule_items')
        .update({ status, completed_at: completedAt })
        .eq('id', itemId);
      if (updErr) throw updErr;
      // Log da ação (best-effort)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('schedule_logs').insert({
          user_id: user.id,
          item_id: itemId,
          action:
            status === 'concluido'
              ? 'completed'
              : status === 'pulado'
                ? 'skipped'
                : status === 'cancelado'
                  ? 'cancelled'
                  : 'reset',
          metadata: { new_status: status },
        });
      }
      await load();
    },
    [load],
  );

  const toggleComplete = useCallback(
    async (itemId: string) => {
      const target = items.find((i) => i.id === itemId);
      if (!target) return;
      const next: ScheduleItemStatus =
        target.status === 'concluido' ? 'pendente' : 'concluido';
      await setStatus(itemId, next);
    },
    [items, setStatus],
  );

  const result = useMemo(
    () => ({ items, stats, isLoading, error, refresh: load, toggleComplete, setStatus }),
    [items, stats, isLoading, error, load, toggleComplete, setStatus],
  );

  return result;
}
