'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type LawReportReason =
  | 'texto_desatualizado'
  | 'texto_errado'
  | 'dispositivo_revogado'
  | 'referencia_errada'
  | 'outro';

export const LAW_REPORT_REASONS: { value: LawReportReason; label: string; desc: string }[] = [
  { value: 'texto_desatualizado', label: 'Texto desatualizado', desc: 'A redacao nao e a vigente' },
  { value: 'texto_errado', label: 'Texto errado', desc: 'Erro de digitacao ou formatacao' },
  { value: 'dispositivo_revogado', label: 'Dispositivo revogado', desc: 'Este dispositivo foi revogado' },
  { value: 'referencia_errada', label: 'Referencia errada', desc: 'Remissao ou link incorreto' },
  { value: 'outro', label: 'Outro', desc: '' },
];

export function useHasReportedLawArticle(dispositivoId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['law-report-check', dispositivoId, user?.id],
    queryFn: async () => {
      if (!user || !dispositivoId) return false;
      const { count, error } = await (supabase as any)
        .from('law_article_reports')
        .select('*', { count: 'exact', head: true })
        .eq('dispositivo_id', dispositivoId)
        .eq('reporter_id', user.id);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user && !!dispositivoId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitLawReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispositivoId,
      leiId,
      dispositivoTipo,
      dispositivoTexto,
      reason,
      details,
    }: {
      dispositivoId: string;
      leiId: string;
      dispositivoTipo: string;
      dispositivoTexto: string;
      reason: LawReportReason;
      details?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('law_article_reports')
        .insert({
          dispositivo_id: dispositivoId,
          lei_id: leiId,
          dispositivo_tipo: dispositivoTipo,
          dispositivo_texto: dispositivoTexto,
          reporter_id: user.id,
          reason,
          details: details || null,
          status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['law-report-check', variables.dispositivoId] });
      queryClient.invalidateQueries({ queryKey: ['moderation-law-reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-law-report-count'] });
    },
  });
}
