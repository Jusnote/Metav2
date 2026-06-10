import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Highlight, MarkKind, MarkTypeId } from '@/components/questoes/highlights/types';

// `question_highlights` ainda não foi regenerado em database.ts — cast local até lá.
const sb = supabase as any;

type Row = {
  id: string; question_id: number; target: string; kind: MarkKind; color: string;
  type: MarkTypeId | null; quote: string; prefix: string; suffix: string;
  note: string | null; created_at: string; updated_at: string;
};

function toHighlight(r: Row): Highlight {
  return {
    id: r.id, questionId: r.question_id, target: r.target, kind: r.kind, color: r.color,
    type: r.type, quote: r.quote, prefix: r.prefix, suffix: r.suffix, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export interface CreateHighlightInput {
  questionId: number; target: string; kind: MarkKind; color: string;
  type: MarkTypeId | null; quote: string; prefix: string; suffix: string; note: string | null;
}

export function useQuestionHighlights(questionId: number | null) {
  const qc = useQueryClient();
  const queryKey = ['question-highlights', questionId];

  /** Caderno (badge da barra + lista geral) reflete criações/remoções na hora. */
  const invalidateCaderno = () => {
    qc.invalidateQueries({ queryKey: ['highlights-count'] });
    qc.invalidateQueries({ queryKey: ['highlights-all'] });
  };

  const query = useQuery({
    queryKey,
    enabled: !!questionId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Highlight[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb
        .from('question_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', questionId!);
      if (error) throw error;
      return (data as Row[]).map(toHighlight);
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateHighlightInput): Promise<Highlight> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await sb.from('question_highlights').insert({
        user_id: user.id, question_id: input.questionId, target: input.target,
        kind: input.kind, color: input.color, type: input.type, quote: input.quote,
        prefix: input.prefix, suffix: input.suffix, note: input.note,
      }).select().single();
      if (error) throw error;
      return toHighlight(data as Row);
    },
    onSuccess: (h) => { qc.setQueryData<Highlight[]>(queryKey, (prev = []) => [...prev, h]); invalidateCaderno(); },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Highlight> & { id: string }): Promise<Highlight> => {
      const { id, ...rest } = patch;
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (rest.kind !== undefined) dbPatch.kind = rest.kind;
      if (rest.color !== undefined) dbPatch.color = rest.color;
      if (rest.type !== undefined) dbPatch.type = rest.type;
      if (rest.note !== undefined) dbPatch.note = rest.note;
      const { data, error } = await sb.from('question_highlights')
        .update(dbPatch).eq('id', id).select().single();
      if (error) throw error;
      return toHighlight(data as Row);
    },
    onSuccess: (h) => { qc.setQueryData<Highlight[]>(queryKey, (prev = []) =>
      prev.map(x => x.id === h.id ? h : x)); invalidateCaderno(); },
  });

  const remove = useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { error } = await sb.from('question_highlights').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => { qc.setQueryData<Highlight[]>(queryKey, (prev = []) =>
      prev.filter(x => x.id !== id)); invalidateCaderno(); },
  });

  return {
    highlights: query.data ?? [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
  };
}
