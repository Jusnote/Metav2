'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DispositivoNote } from '@/types/comments';

export function useDispositivoNote(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['dispositivo-note', dispositivoId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any).from('dispositivo_notes')
        .select('*')
        .eq('dispositivo_id', dispositivoId!)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as DispositivoNote | null;
    },
    enabled: !!dispositivoId && !!user,
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (params: { content_json: Record<string, unknown>; content_text: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase as any).from('dispositivo_notes')
        .upsert({
          user_id: user.id,
          dispositivo_id: dispositivoId!,
          lei_id: leiId!,
          content_json: params.content_json,
          content_text: params.content_text,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,dispositivo_id' })
        .select()
        .single();
      if (error) throw error;
      return data as DispositivoNote;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey: ['dispositivo-note-flags', leiId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase as any).from('dispositivo_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('dispositivo_id', dispositivoId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      queryClient.invalidateQueries({ queryKey: ['dispositivo-note-flags', leiId] });
    },
  });

  return {
    note: query.data ?? null,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
