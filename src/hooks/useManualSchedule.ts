import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useConflictDetection } from '@/hooks/useConflictDetection';

interface CreateManualScheduleParams {
  date: Date;
  durationMinutes: number;
  topicId?: string;
  subtopicId?: string;
  title: string;
  skipConflictCheck?: boolean; // Permite forçar agendamento ignorando conflitos
}

export function useManualSchedule() {
  const { toast } = useToast();
  const { checkConflict } = useConflictDetection();

  const createManualSchedule = useCallback(
    async ({ date, durationMinutes, topicId, subtopicId, title, skipConflictCheck = false }: CreateManualScheduleParams) => {
      try {
        // 1. VERIFICAR CONFLITOS (se não for forçado)
        if (!skipConflictCheck) {
          const conflict = checkConflict(date, durationMinutes);

          if (conflict.hasConflict) {
            // Retornar informação de conflito para o componente tratar
            return {
              conflict,
              success: false,
            };
          }
        }

        // 2. Obter usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: 'Erro',
            description: 'Usuário não autenticado',
            variant: 'destructive',
          });
          return { success: false };
        }

        // 3. Formatar data como YYYY-MM-DD
        const formatDate = (d: Date): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const scheduledDate = formatDate(date);

        // 4. Criar schedule_item
        const { data, error } = await supabase
          .from('schedule_items')
          .insert({
            user_id: user.id,
            topic_id: topicId,
            subtopic_id: subtopicId,
            scheduled_date: scheduledDate,
            estimated_duration: durationMinutes,
            title: `${title} (Manual)`,
            item_type: 'manual',
            priority: 5,
            completed: false,
            revision_type: 'initial_study_part1',
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Agendado com sucesso!',
          description: `"${title}" foi agendado para ${scheduledDate}`,
        });

        return { success: true, data };
      } catch (error) {
        console.error('Error creating manual schedule:', error);
        toast({
          title: 'Erro ao agendar',
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'destructive',
        });
        return { success: false, error };
      }
    },
    [toast, checkConflict]
  );

  return { createManualSchedule };
}
