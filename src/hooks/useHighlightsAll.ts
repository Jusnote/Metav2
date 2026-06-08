import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Highlight, MarkTypeId } from '@/components/questoes/highlights/types';

const sb = supabase as any;

function toHighlight(r: any): Highlight {
  return {
    id: r.id, questionId: r.question_id, target: r.target, kind: r.kind, color: r.color,
    type: r.type, quote: r.quote, prefix: r.prefix, suffix: r.suffix, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function useHighlightsAll(opts: { type?: MarkTypeId | 'all'; search?: string } = {}) {
  const { type = 'all', search = '' } = opts;
  return useQuery({
    queryKey: ['highlights-all', type, search],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Highlight[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = sb.from('question_highlights').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false });
      if (type !== 'all') q = q.eq('type', type);
      if (search.trim()) q = q.or(`quote.ilike.%${search}%,note.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]).map(toHighlight);
    },
  });
}

export function useHighlightsCount() {
  return useQuery({
    queryKey: ['highlights-count'],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await sb.from('question_highlights')
        .select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
