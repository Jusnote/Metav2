import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuestionComment } from '@/types/question-comments';

export function useQuestionComments(questionId: number | null) {
  return useQuery({
    queryKey: ['question-comments', questionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch ALL comments for this question (roots + replies)
      const { data: comments, error } = await supabase
        .from('question_comments')
        .select('*')
        .eq('question_id', questionId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!comments || comments.length === 0) return [] as QuestionComment[];

      // Fetch votes for current user to determine has_upvoted
      const commentIds = comments.map((c) => c.id);
      const { data: votes } = await supabase
        .from('question_comment_votes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds);

      const votedSet = new Set((votes ?? []).map((v) => v.comment_id));

      // Filter out shadowbanned comments (unless author is current user)
      return comments
        .filter((c) => !c.is_author_shadowbanned || c.user_id === user.id)
        .map((c) => ({
          ...c,
          has_upvoted: votedSet.has(c.id),
        })) as QuestionComment[];
    },
    enabled: !!questionId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
