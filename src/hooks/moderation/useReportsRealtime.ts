'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useReportsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('moderation-reports-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'question_comment_reports',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
          queryClient.invalidateQueries({ queryKey: ['moderation-report-count'] });
          queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_moderation',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
          queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moderation_log',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['moderation-log'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
