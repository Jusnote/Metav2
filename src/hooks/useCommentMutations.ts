import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateCommentParams {
  question_id: number;
  content_json: Record<string, unknown>;
  content_text: string;
  root_id?: string | null;
  reply_to_id?: string | null;
  quoted_text?: string | null;
}

interface EditCommentParams {
  comment_id: string;
  content_json: Record<string, unknown>;
  content_text: string;
}

export function useCommentMutations(questionId: number) {
  const queryClient = useQueryClient();
  const queryKey = ['question-comments', questionId];

  const createComment = useMutation({
    mutationFn: async (params: CreateCommentParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Note: table types not yet in generated database.ts — cast needed
      const { data, error } = await (supabase as any)
        .from('question_comments')
        .insert({
          question_id: params.question_id,
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const editComment = useMutation({
    mutationFn: async (params: EditCommentParams) => {
      const { error } = await (supabase as any)
        .from('question_comments')
        .update({
          content_json: params.content_json,
          content_text: params.content_text,
        })
        .eq('id', params.comment_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any).rpc('handle_soft_delete', {
        p_comment_id: commentId,
        p_user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createComment: createComment.mutateAsync,
    editComment: editComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
    isCreating: createComment.isPending,
    isEditing: editComment.isPending,
    isDeleting: deleteComment.isPending,
  };
}
