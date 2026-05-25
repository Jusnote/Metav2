import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  PlanoEstudo,
  PlanoConfig,
  PlanoDisciplina,
} from '@/types/cronograma';

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface CronogramaActivoData {
  plano: PlanoEstudo | null;
  config: PlanoConfig | null;
  disciplinas: PlanoDisciplina[];
  isLoading: boolean;
  hasActivePlan: boolean;
  // Convenience derivations (used pela timeline/drawer)
  totalWeeks: number;
  currentWeek: number;
  currentWeekProgress: number;
  startDate: Date | null;
  endDate: Date | null;
  refresh: () => Promise<void>;
}

const FALLBACK_TOTAL_WEEKS = 12;

export function useCronogramaActivo(): CronogramaActivoData {
  const [plano, setPlano] = useState<PlanoEstudo | null>(null);
  const [config, setConfig] = useState<PlanoConfig | null>(null);
  const [disciplinas, setDisciplinas] = useState<PlanoDisciplina[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPlano(null);
        setConfig(null);
        setDisciplinas([]);
        return;
      }

      const { data: planoRow } = await supabase
        .from('planos_estudo')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle();

      if (!planoRow) {
        setPlano(null);
        setConfig(null);
        setDisciplinas([]);
        return;
      }

      setPlano(planoRow as unknown as PlanoEstudo);

      const [{ data: configRow }, { data: discRows }] = await Promise.all([
        supabase
          .from('plano_config')
          .select('*')
          .eq('plano_id', planoRow.id)
          .maybeSingle(),
        supabase
          .from('plano_disciplinas')
          .select('*')
          .eq('plano_id', planoRow.id)
          .order('ordem', { ascending: true }),
      ]);

      setConfig((configRow as unknown as PlanoConfig) ?? null);
      setDisciplinas((discRows as unknown as PlanoDisciplina[]) ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const derived = useMemo(() => {
    if (!plano) {
      return {
        totalWeeks: FALLBACK_TOTAL_WEEKS,
        currentWeek: 1,
        currentWeekProgress: 0,
        startDate: null as Date | null,
        endDate: null as Date | null,
      };
    }
    const startDate = new Date(plano.data_inicio);
    const endDate = new Date(plano.data_prova);
    const now = new Date();
    const totalWeeks = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_WEEK),
    );
    const elapsedMs = now.getTime() - startDate.getTime();
    const elapsedWeeks = Math.floor(elapsedMs / MS_PER_WEEK);
    const currentWeek = Math.min(totalWeeks, Math.max(1, elapsedWeeks + 1));
    const currentWeekStartMs = startDate.getTime() + elapsedWeeks * MS_PER_WEEK;
    const currentWeekProgress = Math.min(
      1,
      Math.max(0, (now.getTime() - currentWeekStartMs) / MS_PER_WEEK),
    );
    return {
      totalWeeks,
      currentWeek,
      currentWeekProgress,
      startDate,
      endDate,
    };
  }, [plano]);

  return {
    plano,
    config,
    disciplinas,
    isLoading,
    hasActivePlan: !!plano,
    ...derived,
    refresh: load,
  };
}
