'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LawReportRow {
  id: string;
  dispositivo_id: string;
  lei_id: string;
  dispositivo_tipo: string;
  dispositivo_texto: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Joined fields
  reporter_email?: string | null;
  reporter_name?: string | null;
}

export function useLawReports(
  statusFilter?: string,
  reasonFilter?: string,
  page: number = 0,
  pageSize: number = 20,
) {
  return useQuery({
    queryKey: ['moderation-law-reports', statusFilter, reasonFilter, page, pageSize],
    queryFn: async () => {
      let query = (supabase as any)
        .from('law_article_reports')
        .select('*, profiles:reporter_id(email, raw_user_meta_data)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (reasonFilter) {
        query = query.eq('reason', reasonFilter);
      }

      const { data, error, count } = await query;
      if (error) {
        // Fallback: query without join if profiles relation doesn't exist
        let fallbackQuery = (supabase as any)
          .from('law_article_reports')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (statusFilter) fallbackQuery = fallbackQuery.eq('status', statusFilter);
        if (reasonFilter) fallbackQuery = fallbackQuery.eq('reason', reasonFilter);

        const fallback = await fallbackQuery;
        if (fallback.error) throw fallback.error;
        return {
          reports: (fallback.data ?? []) as LawReportRow[],
          totalCount: fallback.count ?? 0,
        };
      }

      const reports = (data ?? []).map((row: any) => ({
        ...row,
        reporter_email: row.profiles?.email ?? null,
        reporter_name: row.profiles?.raw_user_meta_data?.name ?? null,
        profiles: undefined,
      })) as LawReportRow[];

      return { reports, totalCount: count ?? 0 };
    },
    staleTime: 30 * 1000,
  });
}

export function useLawReportCount() {
  const { data } = useQuery({
    queryKey: ['moderation-law-report-count'],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('law_article_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });
  return data ?? 0;
}

export function useLawReportMutations() {
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

      const { error } = await (supabase as any)
        .from('law_article_reports')
        .update({
          status: resolution === 'resolve' ? 'resolved' : 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', reportId);
      if (error) throw error;

      // Log the action
      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'law_article' as any,
        target_id: reportId,
        action: (resolution === 'resolve' ? 'report_resolve' : 'report_dismiss') as any,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-law-reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-law-report-count'] });
    },
  });

  return {
    resolveReport: resolveReport.mutateAsync,
    isResolving: resolveReport.isPending,
  };
}
