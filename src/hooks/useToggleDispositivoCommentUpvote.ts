import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DispositivoComment } from '@/types/comments';

export function useToggleDispositivoCommentUpvote(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['comments', 'dispositivo', dispositivoId, leiId];

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('toggle_dispositivo_comment_upvote', {
        p_comment_id: commentId,
        p_user_id: user.id,
      });
      if (error) throw error;
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DispositivoComment[]>(queryKey);

      queryClient.setQueryData<DispositivoComment[]>(queryKey, (old) => {
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
