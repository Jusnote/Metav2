import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DispositivoComment } from '@/types/comments';

export function useToggleDispositivoCommentReaction(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['comments', 'dispositivo', dispositivoId, leiId];

  return useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('toggle_dispositivo_comment_reaction', {
        p_comment_id: commentId,
        p_user_id: user.id,
        p_emoji: emoji,
      });
      if (error) throw error;
    },
    onMutate: async ({ commentId, emoji }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DispositivoComment[]>(queryKey);

      queryClient.setQueryData<DispositivoComment[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((c) => {
          if (c.id !== commentId) return c;

          const hadReaction = c.user_reactions.includes(emoji);
          const newUserReactions = hadReaction
            ? c.user_reactions.filter((e) => e !== emoji)
            : [...c.user_reactions, emoji];

          const newCounts = { ...c.reaction_counts };
          if (hadReaction) {
            newCounts[emoji] = (newCounts[emoji] ?? 1) - 1;
            if (newCounts[emoji] <= 0) delete newCounts[emoji];
          } else {
            newCounts[emoji] = (newCounts[emoji] ?? 0) + 1;
          }

          return {
            ...c,
            user_reactions: newUserReactions,
            reaction_counts: newCounts,
          };
        });
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
