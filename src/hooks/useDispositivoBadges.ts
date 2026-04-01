'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useDispositivoCommentCounts(leiId: string | undefined) {
  return useQuery({
    queryKey: ['dispositivo-comment-counts', leiId],
    queryFn: async () => {
      if (!leiId) return {} as Record<string, number>;

      const { data, error } = await supabase.rpc('get_dispositivo_comment_counts', {
        p_lei_id: leiId,
      });

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.dispositivo_id] = Number(row.count);
      }
      return counts;
    },
    enabled: !!leiId,
    staleTime: 30 * 1000,
  });
}

export function useDispositivoNoteFlags(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-note-flags', leiId],
    queryFn: async () => {
      if (!leiId || !user) return new Set<string>();

      const { data, error } = await supabase.rpc('get_dispositivo_note_flags', {
        p_lei_id: leiId,
        p_user_id: user.id,
      });

      if (error) throw error;

      const set = new Set<string>();
      for (const row of data ?? []) {
        set.add(row.dispositivo_id);
      }
      return set;
    },
    enabled: !!leiId && !!user,
    staleTime: 30 * 1000,
  });
}
