'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type QuestionReportReason =
  | 'desatualizada'
  | 'gabarito_errado'
  | 'enunciado_incompleto'
  | 'classificacao_errada'
  | 'outro';

export const QUESTION_REPORT_REASONS: { value: QuestionReportReason; label: string; desc: string }[] = [
  { value: 'desatualizada', label: 'Questao desatualizada', desc: 'Lei ou jurisprudencia mudou' },
  { value: 'gabarito_errado', label: 'Gabarito errado', desc: 'A alternativa correta esta incorreta' },
  { value: 'enunciado_incompleto', label: 'Enunciado incompleto', desc: 'Falta texto, imagem ou informacao' },
  { value: 'classificacao_errada', label: 'Classificacao errada', desc: 'Materia, assunto, banca ou ano incorretos' },
  { value: 'outro', label: 'Outro', desc: '' },
];

export function useHasReportedQuestion(questionId: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['question-report-check', questionId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count, error } = await (supabase as any)
        .from('question_reports')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', questionId)
        .eq('reporter_id', user.id);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitQuestionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      reason,
      details,
      materia,
      assunto,
    }: {
      questionId: number;
      reason: QuestionReportReason;
      details?: string;
      materia?: string;
      assunto?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('question_reports')
        .insert({
          question_id: questionId,
          reporter_id: user.id,
          reason,
          details: details || null,
          materia: materia || null,
          assunto: assunto || null,
          status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['question-report-check', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['moderation-question-reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-question-report-count'] });
    },
  });
}
