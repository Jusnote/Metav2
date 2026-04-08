import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LogAnswerParams {
  topicoId: string;
  questaoId?: number;
  correto: boolean;
  tempoResposta?: number;
  dificuldade?: number;
  tipoErro?: string;
  conceitoConfundido?: string;
  sessionId?: string;
}

function calculateMasteryScore(topico: {
  question_accuracy?: number;
  teoria_finalizada?: boolean;
  tempo_investido?: number;
  leis_lidas?: string | null;
}): { mastery_score: number; learning_stage: string } {
  const accuracy = (topico.question_accuracy || 0) / 100;
  const teoria = topico.teoria_finalizada ? 1 : 0;
  const tempoFactor = (topico.tempo_investido || 0) > 0 ? 1 : 0;
  const leisFactor = topico.leis_lidas ? 1 : 0;

  const mastery = (accuracy * 0.60 + teoria * 0.15 + tempoFactor * 0.15 + leisFactor * 0.10) * 100;
  const score = Math.round(Math.min(100, mastery) * 100) / 100;

  let stage: string;
  if (score >= 90) stage = 'mastered';
  else if (score >= 75) stage = 'maintaining';
  else if (score >= 50) stage = 'consolidating';
  else if (score >= 20) stage = 'learning';
  else stage = 'new';

  return { mastery_score: score, learning_stage: stage };
}

export function useQuestoesLog() {
  const logAnswer = useCallback(async (params: LogAnswerParams) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // 1. Insert into questoes_log
    const { error: logError } = await supabase.from('questoes_log' as any).insert({
      user_id: user.id,
      topico_id: params.topicoId,
      questao_id: params.questaoId || null,
      correto: params.correto,
      tempo_resposta: params.tempoResposta || null,
      dificuldade: params.dificuldade || null,
      tipo_erro: params.tipoErro || null,
      conceito_confundido: params.conceitoConfundido || null,
      session_id: params.sessionId || null,
    });

    if (logError) return false;

    // 2. Update topico stats
    const { data: topico } = await supabase
      .from('topicos')
      .select('questoes_acertos, questoes_erros, questions_total, question_accuracy, teoria_finalizada, tempo_investido, leis_lidas')
      .eq('id', params.topicoId)
      .single();

    if (!topico) return false;

    const newAcertos = (topico.questoes_acertos || 0) + (params.correto ? 1 : 0);
    const newErros = (topico.questoes_erros || 0) + (params.correto ? 0 : 1);
    const newTotal = (topico.questions_total || 0) + 1;
    const newAccuracy = (newAcertos / newTotal) * 100;

    const { mastery_score, learning_stage } = calculateMasteryScore({
      ...topico,
      question_accuracy: newAccuracy,
    });

    await supabase
      .from('topicos')
      .update({
        questoes_acertos: newAcertos,
        questoes_erros: newErros,
        questions_total: newTotal,
        question_accuracy: Math.round(newAccuracy * 100) / 100,
        mastery_score,
        learning_stage,
        last_access: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.topicoId);

    return true;
  }, []);

  const getAccuracyForTopico = useCallback(async (topicoId: string, limit = 20): Promise<number> => {
    const { data } = await supabase
      .from('questoes_log' as any)
      .select('correto')
      .eq('topico_id', topicoId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) return 0;
    const correct = (data as any[]).filter(d => d.correto).length;
    return (correct / data.length) * 100;
  }, []);

  const getStatsForPlano = useCallback(async (planoId: string) => {
    // Get all topicos for this plano's disciplinas
    const { data: disciplinas } = await supabase
      .from('disciplinas')
      .select('id, nome, peso_edital')
      .eq('plano_id', planoId);

    if (!disciplinas) return [];

    const stats = [];
    for (const disc of disciplinas) {
      const { data: topicos } = await supabase
        .from('topicos')
        .select('mastery_score, question_accuracy, questions_total')
        .eq('disciplina_id', disc.id);

      const avgMastery = topicos && topicos.length > 0
        ? topicos.reduce((sum: number, t: any) => sum + (t.mastery_score || 0), 0) / topicos.length
        : 0;

      stats.push({
        disciplinaId: disc.id,
        disciplinaNome: disc.nome,
        peso: disc.peso_edital,
        avgMastery,
        totalQuestions: topicos?.reduce((sum: number, t: any) => sum + (t.questions_total || 0), 0) || 0,
      });
    }

    return stats;
  }, []);

  return { logAnswer, getAccuracyForTopico, getStatsForPlano, calculateMasteryScore };
}

export { calculateMasteryScore };
