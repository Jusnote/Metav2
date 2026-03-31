'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportWithContext, ModerationStats } from '@/types/moderation';

export function useReports(statusFilter?: string, page: number = 0, pageSize: number = 20) {
  return useQuery({
    queryKey: ['moderation-reports', statusFilter, page, pageSize],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_reports_paginated', {
        p_status: statusFilter ?? null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw error;
      const rows = (data ?? []) as (ReportWithContext & { total_count: number })[];
      const totalCount = rows[0]?.total_count ?? 0;
      return { reports: rows as ReportWithContext[], totalCount };
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
    onMutate: async ({ reportId, resolution }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['moderation-reports'] });

      // Snapshot previous value
      const previousReports = queryClient.getQueriesData({ queryKey: ['moderation-reports'] });

      // Optimistically update all report queries
      queryClient.setQueriesData(
        { queryKey: ['moderation-reports'] },
        (old: any) => {
          if (!old) return old;
          // Handle paginated format { reports, totalCount }
          if (old.reports) {
            return {
              ...old,
              reports: old.reports.map((r: any) =>
                r.id === reportId ? { ...r, status: resolution === 'resolve' ? 'resolved' : 'dismissed' } : r
              ),
            };
          }
          // Handle array format
          if (Array.isArray(old)) {
            return old.map((r: any) =>
              r.id === reportId ? { ...r, status: resolution === 'resolve' ? 'resolved' : 'dismissed' } : r
            );
          }
          return old;
        },
      );

      return { previousReports };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousReports) {
        for (const [queryKey, data] of context.previousReports) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-report-count'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-analytics'] });
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
