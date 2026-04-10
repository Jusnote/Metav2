import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEditalSnapshot } from './useEditalSnapshot';
import { calculateMasteryScore } from './useQuestoesLog';
import type { CompletionData } from '@/components/documents-organization/StudyCompletionForm';

export function useStudyCompletion() {
  const { ensureTopicoLocal } = useEditalSnapshot();

  const completeStudy = useCallback(async (params: {
    // Topic identification (either local ID or origin refs for lazy creation)
    localTopicoId?: string;
    originTopicoRef?: number;
    originDisciplinaRef?: number;
    topicoNome: string;
    disciplinaNome: string;
    planoId?: string;
    // Schedule context (if completing a cronograma item)
    scheduleItemId?: string;
    estimatedMinutes?: number;
    // The completion data from the form
    data: CompletionData;
  }): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // 1. Ensure local topico exists (lazy creation)
    let topicoId = params.localTopicoId;
    if (!topicoId && params.originTopicoRef && params.originDisciplinaRef) {
      topicoId = await ensureTopicoLocal({
        originTopicoRef: params.originTopicoRef,
        originDisciplinaRef: params.originDisciplinaRef,
        topicoNome: params.topicoNome,
        disciplinaNome: params.disciplinaNome,
        planoId: params.planoId,
      }) ?? undefined;
    }
    if (!topicoId) return false;

    // 2. Get current topico data
    const { data: topico } = await supabase
      .from('topicos')
      .select('tempo_investido, questoes_acertos, questoes_erros, questions_total, question_accuracy, teoria_finalizada, leis_lidas, mastery_score')
      .eq('id', topicoId)
      .single();

    if (!topico) return false;

    // 3. Calculate updates
    const updates: Record<string, unknown> = {
      last_access: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Tempo
    const tempoReal = params.data.tempoReal || params.estimatedMinutes || 0;
    if (tempoReal > 0) {
      updates.tempo_investido = (topico.tempo_investido || 0) + tempoReal;
    }

    // Questoes
    if (params.data.questoesAcertos !== undefined || params.data.questoesErros !== undefined) {
      const newAcertos = (topico.questoes_acertos || 0) + (params.data.questoesAcertos || 0);
      const newErros = (topico.questoes_erros || 0) + (params.data.questoesErros || 0);
      const newTotal = (topico.questions_total || 0) + (params.data.questoesAcertos || 0) + (params.data.questoesErros || 0);
      const newAccuracy = newTotal > 0 ? (newAcertos / newTotal) * 100 : 0;

      updates.questoes_acertos = newAcertos;
      updates.questoes_erros = newErros;
      updates.questions_total = newTotal;
      updates.question_accuracy = Math.round(newAccuracy * 100) / 100;
    }

    // Lei seca
    if (params.data.leisLidas) {
      updates.leis_lidas = params.data.leisLidas;
    }

    // Teoria
    if (params.data.teoriaFinalizada) {
      updates.teoria_finalizada = true;
    }

    // Recalculate mastery
    const { mastery_score, learning_stage } = calculateMasteryScore({
      question_accuracy: (updates.question_accuracy as number) ?? topico.question_accuracy,
      teoria_finalizada: (updates.teoria_finalizada as boolean) ?? topico.teoria_finalizada,
      tempo_investido: (updates.tempo_investido as number) ?? topico.tempo_investido,
      leis_lidas: (updates.leis_lidas as string) ?? topico.leis_lidas,
    });

    updates.mastery_score = mastery_score;
    updates.learning_stage = learning_stage;

    // Check if completed
    if (mastery_score >= 90) {
      updates.completed_at = updates.completed_at || new Date().toISOString();
    }

    // 4. Update topico
    await supabase.from('topicos').update(updates).eq('id', topicoId);

    // 5. Mark schedule_item completed (if from cronograma)
    if (params.scheduleItemId) {
      await supabase
        .from('schedule_items')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          actual_duration: tempoReal,
        })
        .eq('id', params.scheduleItemId);
    }

    // 6. Log questions if provided (detailed mode)
    if (params.data.questoesAcertos !== undefined && params.data.questoesAcertos > 0) {
      for (let i = 0; i < params.data.questoesAcertos; i++) {
        await supabase.from('questoes_log' as any).insert({
          user_id: user.id,
          topico_id: topicoId,
          correto: true,
          created_at: new Date().toISOString(),
        });
      }
    }
    if (params.data.questoesErros !== undefined && params.data.questoesErros > 0) {
      for (let i = 0; i < params.data.questoesErros; i++) {
        await supabase.from('questoes_log' as any).insert({
          user_id: user.id,
          topico_id: topicoId,
          correto: false,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 7. Create score snapshot
    await supabase.from('score_snapshots' as any).insert({
      user_id: user.id,
      plano_id: params.planoId || null,
      score_current: mastery_score,
      created_at: new Date().toISOString(),
    });

    return true;
  }, [ensureTopicoLocal]);

  return { completeStudy };
}
