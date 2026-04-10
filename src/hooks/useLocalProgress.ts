import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

/**
 * Single topic: query local progress by origin_topico_ref
 */
export function useLocalProgress(originTopicoRef: number | null) {
  const [progress, setProgress] = useState<LocalProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!originTopicoRef) { setProgress(null); return; }
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const { data } = await supabase
      .from('topicos')
      .select('id, origin_topico_ref, mastery_score, learning_stage, question_accuracy, questions_total, questoes_acertos, questoes_erros, tempo_investido, teoria_finalizada, leis_lidas, last_access, completed_at')
      .eq('user_id', user.id)
      .eq('origin_topico_ref', originTopicoRef)
      .maybeSingle();

    setProgress((data as LocalProgress | null) ?? null);
    setIsLoading(false);
  }, [originTopicoRef]);

  useEffect(() => { refetch(); }, [refetch]);

  return { progress, isLoading, refetch };
}

/**
 * Batch: query local progress for multiple topics at once (for the topic list)
 */
export function useLocalProgressBatch(originRefs: number[]) {
  const [progressMap, setProgressMap] = useState<Map<number, LocalProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (originRefs.length === 0) { setProgressMap(new Map()); return; }
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const { data } = await supabase
      .from('topicos')
      .select('id, origin_topico_ref, mastery_score, learning_stage, question_accuracy, questions_total, questoes_acertos, questoes_erros, tempo_investido, teoria_finalizada, leis_lidas, last_access, completed_at')
      .eq('user_id', user.id)
      .in('origin_topico_ref', originRefs);

    const map = new Map<number, LocalProgress>();
    if (data) {
      for (const row of data) {
        const ref = (row as any).origin_topico_ref;
        if (ref) map.set(ref, row as unknown as LocalProgress);
      }
    }
    setProgressMap(map);
    setIsLoading(false);
  }, [originRefs.join(',')]);

  useEffect(() => { refetch(); }, [refetch]);

  return { progressMap, isLoading, refetch };
}
