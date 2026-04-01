import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateDispositivoCommentParams {
  dispositivo_id: string;
  lei_id: string;
  content_json: Record<string, unknown>;
  content_text: string;
  root_id?: string | null;
  reply_to_id?: string | null;
  quoted_text?: string | null;
}

interface EditDispositivoCommentParams {
  comment_id: string;
  content_json: Record<string, unknown>;
  content_text: string;
}

export function useDispositivoCommentMutations(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const commentsKey = ['comments', 'dispositivo', dispositivoId, leiId];
  const countsKey = ['dispositivo-comment-counts', leiId];

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: commentsKey });
    queryClient.invalidateQueries({ queryKey: countsKey });
  }

  const createComment = useMutation({
    mutationFn: async (params: CreateDispositivoCommentParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('dispositivo_comments')
        .insert({
          dispositivo_id: params.dispositivo_id,
          lei_id: params.lei_id,
          user_id: user.id,
          content_json: params.content_json,
          content_text: params.content_text,
          root_id: params.root_id ?? null,
          reply_to_id: params.reply_to_id ?? null,
          quoted_text: params.quoted_text ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      // If this is a reply, increment the parent's reply_count
      if (params.root_id) {
        const { data: parent } = await supabase.from('dispositivo_comments')
          .select('reply_count')
          .eq('id', params.root_id)
          .single();
        if (parent) {
          await supabase.from('dispositivo_comments')
            .update({ reply_count: (parent.reply_count ?? 0) + 1 })
            .eq('id', params.root_id);
        }
      }

      return data;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const editComment = useMutation({
    mutationFn: async (params: EditDispositivoCommentParams) => {
      // Fetch current edit_count to increment
      const { data: current } = await supabase.from('dispositivo_comments')
        .select('edit_count')
        .eq('id', params.comment_id)
        .single();

      const { error } = await supabase.from('dispositivo_comments')
        .update({
          content_json: params.content_json,
          content_text: params.content_text,
          edit_count: ((current?.edit_count as number) ?? 0) + 1,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', params.comment_id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('handle_dispositivo_soft_delete', {
        p_comment_id: commentId,
        p_user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const pinComment = useMutation({
    mutationFn: async ({ commentId, isPinned }: { commentId: string; isPinned: boolean }) => {
      const { error } = await supabase.from('dispositivo_comments')
        .update({ is_pinned: isPinned })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const endorseComment = useMutation({
    mutationFn: async ({ commentId, isEndorsed }: { commentId: string; isEndorsed: boolean }) => {
      const { error } = await supabase.from('dispositivo_comments')
        .update({ is_endorsed: isEndorsed })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  return {
    createComment: createComment.mutateAsync,
    editComment: editComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
    pinComment: pinComment.mutateAsync,
    endorseComment: endorseComment.mutateAsync,
    isCreating: createComment.isPending,
    isEditing: editComment.isPending,
    isDeleting: deleteComment.isPending,
    isPinning: pinComment.isPending,
    isEndorsing: endorseComment.isPending,
  };
}
