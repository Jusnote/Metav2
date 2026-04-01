'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DispositivoReaction {
  dispositivoId: string;
  topEmoji: string;
  totalCount: number;
  breakdown: Record<string, number>;
  userEmoji: string | null;
}

export function useDispositivoReactions(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-reactions', leiId],
    queryFn: async () => {
      if (!leiId) return new Map<string, DispositivoReaction>();

      const { data, error } = await (supabase as any).rpc('get_dispositivo_reactions', {
        p_lei_id: leiId,
        p_user_id: user?.id ?? null,
      });

      if (error) throw error;

      const map = new Map<string, DispositivoReaction>();
      for (const row of data ?? []) {
        map.set(row.dispositivo_id, {
          dispositivoId: row.dispositivo_id,
          topEmoji: row.top_emoji,
          totalCount: Number(row.total_count),
          breakdown: row.breakdown ?? {},
          userEmoji: row.user_emoji ?? null,
        });
      }
      return map;
    },
    enabled: !!leiId,
    staleTime: 60 * 1000,
  });
}

export function useToggleDispositivoReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispositivoId,
      leiId,
      emoji,
    }: {
      dispositivoId: string;
      leiId: string;
      emoji: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('toggle_dispositivo_reaction', {
        p_dispositivo_id: dispositivoId,
        p_lei_id: leiId,
        p_emoji: emoji,
      });
      if (error) throw error;
      return data as string;
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['dispositivo-reactions', variables.leiId],
      });
    },
  });
}
