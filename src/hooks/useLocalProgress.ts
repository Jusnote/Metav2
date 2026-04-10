import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

export interface LocalProgress {
  id: string;
  origin_topico_ref: number;
  mastery_score: number;
  learning_stage: string;
  question_accuracy: number;
  questions_total: number;
  questoes_acertos: number;
  questoes_erros: number;
  tempo_investido: number;
  teoria_finalizada: boolean;
  leis_lidas: string | null;
  last_access: string | null;
  completed_at: string | null;
}

const PROGRESS_SELECT = 'id, origin_topico_ref, mastery_score, learning_stage, question_accuracy, questions_total, questoes_acertos, questoes_erros, tempo_investido, teoria_finalizada, leis_lidas, last_access, completed_at';

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Single topic: query local progress by origin_topico_ref
 * Uses React Query — cache key: ['local-progress', originTopicoRef]
 */
export function useLocalProgress(originTopicoRef: number | null) {
  const queryClient = useQueryClient();

  const { data: progress = null, isLoading } = useQuery({
    queryKey: ['local-progress', originTopicoRef],
    queryFn: async (): Promise<LocalProgress | null> => {
      if (!originTopicoRef) return null;
      const userId = await getUserId();
      if (!userId) return null;

      const { data } = await supabase
        .from('topicos')
        .select(PROGRESS_SELECT)
        .eq('user_id', userId)
        .eq('origin_topico_ref', originTopicoRef)
        .maybeSingle();

      return (data as LocalProgress | null) ?? null;
    },
    enabled: !!originTopicoRef,
    staleTime: 30 * 1000, // 30s — fresh enough for progress data
    gcTime: 5 * 60 * 1000, // 5min
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['local-progress'] });
  }, [queryClient]);

  return { progress, isLoading, refetch };
}

/**
 * Batch: query local progress for multiple topics at once (for the topic list)
 * Uses React Query — cache key: ['local-progress-batch', sortedRefs]
 */
export function useLocalProgressBatch(originRefs: number[]) {
  const sortedKey = [...originRefs].sort().join(',');

  const { data: progressMap = new Map<number, LocalProgress>(), isLoading } = useQuery({
    queryKey: ['local-progress-batch', sortedKey],
    queryFn: async (): Promise<Map<number, LocalProgress>> => {
      if (originRefs.length === 0) return new Map();
      const userId = await getUserId();
      if (!userId) return new Map();

      const { data } = await supabase
        .from('topicos')
        .select(PROGRESS_SELECT)
        .eq('user_id', userId)
        .in('origin_topico_ref', originRefs);

      const map = new Map<number, LocalProgress>();
      if (data) {
        for (const row of data) {
          const ref = (row as any).origin_topico_ref;
          if (ref) map.set(ref, row as unknown as LocalProgress);
        }
      }
      return map;
    },
    enabled: originRefs.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return { progressMap, isLoading };
}

/**
 * Call this after writing progress data to invalidate all progress queries.
 * Both useLocalProgress and useLocalProgressBatch will refetch automatically.
 */
export function useInvalidateProgress() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['local-progress'] });
    queryClient.invalidateQueries({ queryKey: ['local-progress-batch'] });
  }, [queryClient]);
}
