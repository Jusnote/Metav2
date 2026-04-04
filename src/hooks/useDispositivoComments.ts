'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DispositivoComment } from '@/types/comments';

export function useDispositivoComments(dispositivoId: string | null, leiId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['comments', 'dispositivo', dispositivoId, leiId],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_dispositivo_comments_with_votes', {
        p_dispositivo_id: dispositivoId!,
        p_lei_id: leiId!,
        p_user_id: user.id,
      });
      if (error) throw error;
      return (data ?? []) as DispositivoComment[];
    },
    enabled: !!dispositivoId && !!leiId && !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
