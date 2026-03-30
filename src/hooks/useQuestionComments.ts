import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuestionComment } from '@/types/question-comments';

export function useQuestionComments(questionId: number | null) {
  return useQuery({
    queryKey: ['question-comments', questionId],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Call the RPC that returns comments with vote status
      // Note: table/RPC types not yet in generated database.ts — cast needed
      const { data, error } = await (supabase as any).rpc('get_comments_with_votes', {
        p_question_id: questionId!,
        p_user_id: user.id,
      });
      if (error) throw error;
      return (data ?? []) as QuestionComment[];
    },
    enabled: !!questionId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
