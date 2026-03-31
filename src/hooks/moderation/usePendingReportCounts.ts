'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/moderation/useUserRole';

export function usePendingReportCounts(commentIds: string[]) {
  const { isModerator } = useUserRole();

  return useQuery({
    queryKey: ['pending-report-counts', ...commentIds.sort()],
    queryFn: async () => {
      if (commentIds.length === 0) return new Map<string, number>();

      const { data, error } = await (supabase as any).rpc('get_pending_report_counts', {
        p_comment_ids: commentIds,
      });
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of (data ?? [])) {
        counts.set(row.comment_id, row.pending_count);
      }
      return counts;
    },
    enabled: isModerator && commentIds.length > 0,
    staleTime: 60 * 1000,
  });
}
