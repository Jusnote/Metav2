import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { commentFrom } from '@/types/question-comments';
import type { QuestionNote } from '@/types/question-comments';

export function useQuestionNote(questionId: number | null) {
  const queryClient = useQueryClient();
  const queryKey = ['question-note', questionId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await commentFrom(supabase, 'question_notes')
        .select('*')
        .eq('question_id', questionId!)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as QuestionNote | null;
    },
    enabled: !!questionId,
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (params: { content_json: Record<string, unknown>; content_text: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await commentFrom(supabase, 'question_notes')
        .upsert({
          user_id: user.id,
          question_id: questionId!,
          content_json: params.content_json,
          content_text: params.content_text,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,question_id' })
        .select()
        .single();
      if (error) throw error;
      return data as QuestionNote;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await commentFrom(supabase, 'question_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('question_id', questionId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
    },
  });

  return {
    note: query.data ?? null,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
