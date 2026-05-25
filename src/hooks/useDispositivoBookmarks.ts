'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useDispositivoBookmarks(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-bookmarks', leiId],
    queryFn: async () => {
      if (!leiId || !user) return new Set<string>();

      const { data, error } = await (supabase.rpc as any)('get_dispositivo_bookmarks', {
        p_lei_id: leiId,
        p_user_id: user.id,
      });

      if (error) throw error;

      const set = new Set<string>();
      for (const row of (data ?? []) as Array<{ dispositivo_id: string }>) {
        set.add(row.dispositivo_id);
      }
      return set;
    },
    enabled: !!leiId && !!user,
    staleTime: 60 * 1000,
  });
}

export function useToggleDispositivoBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispositivoId,
      leiId,
    }: {
      dispositivoId: string;
      leiId: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)('toggle_dispositivo_bookmark', {
        p_dispositivo_id: dispositivoId,
        p_lei_id: leiId,
      });
      if (error) throw error;
      return data as boolean;
    },
    onMutate: async ({ dispositivoId, leiId }) => {
      await queryClient.cancelQueries({
        queryKey: ['dispositivo-bookmarks', leiId],
      });

      const previous = queryClient.getQueryData<Set<string>>([
        'dispositivo-bookmarks',
        leiId,
      ]);

      queryClient.setQueryData<Set<string>>(
        ['dispositivo-bookmarks', leiId],
        (old) => {
          const next = new Set(old ?? []);
          if (next.has(dispositivoId)) {
            next.delete(dispositivoId);
          } else {
            next.add(dispositivoId);
          }
          return next;
        }
      );

      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['dispositivo-bookmarks', variables.leiId],
          context.previous
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['dispositivo-bookmarks', variables.leiId],
      });
    },
  });
}
