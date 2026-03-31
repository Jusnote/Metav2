'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ModerationUser, UserRole } from '@/types/moderation';

export function useModerationUsers() {
  return useQuery({
    queryKey: ['moderation-users'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_moderation_users');
      if (error) throw error;
      return (data ?? []) as ModerationUser[];
    },
    staleTime: 60 * 1000,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: current } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const previousRole = current?.role ?? 'user';

      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: newRole, granted_by: user.id }, { onConflict: 'user_id' });
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: 'role_change',
        details: { role_from: previousRole, role_to: newRole },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  const toggleShadowban = useMutation({
    mutationFn: async ({ userId, shadowban }: { userId: string; shadowban: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_moderation')
        .upsert(
          { user_id: userId, is_shadowbanned: shadowban, banned_by: shadowban ? user.id : null },
          { onConflict: 'user_id' },
        );
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: shadowban ? 'shadowban' : 'unshadowban',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_moderation')
        .upsert(
          {
            user_id: userId,
            timeout_reason: reason,
            timeout_until: '9999-12-31T23:59:59Z',
            banned_by: user.id,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: 'ban',
        details: { reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  const unbanUser = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_moderation')
        .update({
          timeout_reason: null,
          timeout_until: null,
          banned_by: null,
          is_shadowbanned: false,
        })
        .eq('user_id', userId);
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: 'unban',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  return {
    changeRole: changeRole.mutateAsync,
    toggleShadowban: toggleShadowban.mutateAsync,
    banUser: banUser.mutateAsync,
    unbanUser: unbanUser.mutateAsync,
    isChangingRole: changeRole.isPending,
    isBanning: banUser.isPending,
  };
}
