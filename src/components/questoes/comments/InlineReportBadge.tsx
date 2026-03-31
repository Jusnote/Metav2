'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/moderation/useUserRole';

interface InlineReportBadgeProps {
  commentId: string;
}

export function InlineReportBadge({ commentId }: InlineReportBadgeProps) {
  const { isModerator } = useUserRole();

  const { data: reports } = useQuery({
    queryKey: ['inline-report-count', commentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('question_comment_reports')
        .select('id')
        .eq('comment_id', commentId)
        .eq('status', 'pending');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isModerator,
    staleTime: 60 * 1000,
  });

  if (!isModerator || !reports || reports.length === 0) return null;

  return (
    <span
      className="flex items-center gap-1 text-[11px] tabular-nums text-violet-600"
      title={`${reports.length} report(s) pendente(s)`}
    >
      <span className="h-[6px] w-[6px] rounded-full bg-violet-600" />
      {reports.length}
    </span>
  );
}
