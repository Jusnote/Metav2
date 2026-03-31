// src/hooks/moderation/useUserRole.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types/moderation';
import { hasRole } from '@/types/moderation';

export function useUserRole() {
  const query = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'user' as UserRole;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.role ?? 'user') as UserRole;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchOnWindowFocus: false,
  });

  return {
    role: query.data ?? 'user' as UserRole,
    isLoading: query.isLoading,
    isModerator: hasRole(query.data ?? 'user', 'moderator'),
    isAdmin: hasRole(query.data ?? 'user', 'admin'),
    isTeacher: hasRole(query.data ?? 'user', 'teacher'),
    hasRole: (required: UserRole) => hasRole(query.data ?? 'user', required),
  };
}
