'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ModerationLogEntry } from '@/types/moderation';

export function useModerationLog(targetType?: string, targetId?: string) {
  return useQuery({
    queryKey: ['moderation-log', targetType, targetId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_moderation_log', {
        p_target_type: targetType ?? null,
        p_target_id: targetId ?? null,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as ModerationLogEntry[];
    },
    staleTime: 30 * 1000,
  });
}
