'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useDispositivoLikes(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-likes', leiId],
    queryFn: async () => {
      if (!leiId || !user) return new Set<string>();

      const { data, error } = await (supabase as any).rpc('get_dispositivo_likes', {
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
    staleTime: 60 * 1000,
  });
}

export function useToggleDispositivoLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispositivoId,
      leiId,
    }: {
      dispositivoId: string;
      leiId: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('toggle_dispositivo_like', {
        p_dispositivo_id: dispositivoId,
        p_lei_id: leiId,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ dispositivoId, leiId }) => {
      await queryClient.cancelQueries({
        queryKey: ['dispositivo-likes', leiId],
      });

      const previous = queryClient.getQueryData<Set<string>>(['dispositivo-likes', leiId]);

      queryClient.setQueryData<Set<string>>(['dispositivo-likes', leiId], (old) => {
        const next = new Set(old ?? []);
        if (next.has(dispositivoId)) {
          next.delete(dispositivoId);
        } else {
          next.add(dispositivoId);
        }
        return next;
      });

      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['dispositivo-likes', variables.leiId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['dispositivo-likes', variables.leiId],
      });
    },
  });
}
