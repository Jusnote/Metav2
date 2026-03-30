import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuestionComment } from '@/types/question-comments';

export function useToggleUpvote(questionId: number) {
  const queryClient = useQueryClient();
  const queryKey = ['question-comments', questionId];

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('toggle_upvote', {
        p_comment_id: commentId,
        p_user_id: user.id,
      });
      if (error) throw error;
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuestionComment[]>(queryKey);

      queryClient.setQueryData<QuestionComment[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((c) => {
          if (c.id !== commentId) return c;
          const wasUpvoted = c.has_upvoted;
          return {
            ...c,
            has_upvoted: !wasUpvoted,
            upvote_count: c.upvote_count + (wasUpvoted ? -1 : 1),
          };
        });
      });

      return { previous };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
