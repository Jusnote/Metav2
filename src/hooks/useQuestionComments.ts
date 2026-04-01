import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuestionComment } from '@/types/question-comments';

export function useQuestionComments(questionId: number | null) {
  return useQuery({
    queryKey: ['question-comments', questionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_comments_with_votes', {
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
