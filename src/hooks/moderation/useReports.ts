'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportWithContext, ModerationStats } from '@/types/moderation';

export function useReports(statusFilter?: string) {
  return useQuery({
    queryKey: ['moderation-reports', statusFilter],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_reports_with_context', {
        p_status: statusFilter ?? null,
      });
      if (error) throw error;
      return (data ?? []) as ReportWithContext[];
    },
    staleTime: 30 * 1000,
  });
}

export function useReportCount() {
  const { data } = useQuery({
    queryKey: ['moderation-report-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('question_comment_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });
  return data ?? 0;
}

export function useReportMutations() {
  const queryClient = useQueryClient();

  const resolveReport = useMutation({
    mutationFn: async ({
      reportId,
      resolution,
    }: {
      reportId: string;
      resolution: 'resolve' | 'dismiss';
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: reportError } = await supabase
        .from('question_comment_reports')
        .update({
          status: resolution === 'resolve' ? 'resolved' : 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', reportId);
      if (reportError) throw reportError;

      const { error: logError } = await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'comment',
        target_id: reportId,
        action: resolution === 'resolve' ? 'report_resolve' : 'report_dismiss',
      });
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-report-count'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
    },
  });

  return {
    resolveReport: resolveReport.mutateAsync,
    isResolving: resolveReport.isPending,
  };
}

export function useModerationStats(days: number = 7) {
  return useQuery({
    queryKey: ['moderation-stats', days],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_moderation_stats', {
        p_days: days,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as ModerationStats;
    },
    staleTime: 60 * 1000,
  });
}
