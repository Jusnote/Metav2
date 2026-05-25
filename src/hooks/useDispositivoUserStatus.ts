'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type DispositivoStatus = 'estudado' | 'revisar' | 'decorar';

export function useDispositivoUserStatus(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-user-status', leiId],
    queryFn: async () => {
      if (!leiId || !user) return new Map<string, DispositivoStatus>();

      const { data, error } = await (supabase.rpc as any)('get_dispositivo_user_status', {
        p_lei_id: leiId,
        p_user_id: user.id,
      });

      if (error) throw error;

      const map = new Map<string, DispositivoStatus>();
      for (const row of (data ?? []) as Array<{ dispositivo_id: string; status: string }>) {
        map.set(row.dispositivo_id, row.status as DispositivoStatus);
      }
      return map;
    },
    enabled: !!leiId && !!user,
    staleTime: 60 * 1000,
  });
}

export function useToggleDispositivoUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispositivoId,
      leiId,
      status,
    }: {
      dispositivoId: string;
      leiId: string;
      status: DispositivoStatus | null;
    }) => {
      const { data, error } = await (supabase.rpc as any)('toggle_dispositivo_user_status', {
        p_dispositivo_id: dispositivoId,
        p_lei_id: leiId,
        p_status: status,
      });
      if (error) throw error;
      return data as DispositivoStatus | null;
    },
    onMutate: async ({ dispositivoId, leiId, status }) => {
      await queryClient.cancelQueries({
        queryKey: ['dispositivo-user-status', leiId],
      });

      const previous = queryClient.getQueryData<Map<string, DispositivoStatus>>([
        'dispositivo-user-status',
        leiId,
      ]);

      queryClient.setQueryData<Map<string, DispositivoStatus>>(
        ['dispositivo-user-status', leiId],
        (old) => {
          const next = new Map(old ?? new Map());
          const current = next.get(dispositivoId);

          if (status === null || current === status) {
            next.delete(dispositivoId);
          } else {
            next.set(dispositivoId, status);
          }
          return next;
        }
      );

      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['dispositivo-user-status', variables.leiId],
          context.previous
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['dispositivo-user-status', variables.leiId],
      });
    },
  });
}
