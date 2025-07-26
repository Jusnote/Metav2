import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Questao, Alternativa } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

export interface QuestaoCompleta extends Questao {
  alternativas: Alternativa[];
  banca?: string;
  cargo?: string;
}

export const useQuestoes = () => {
  const [questoes, setQuestoes] = useState<QuestaoCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchQuestoes = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setQuestoes([]);
        return;
      }

      // Buscar todas as questões do usuário
      const { data: questoesData, error: questoesError } = await supabase
        .from('questoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (questoesError) {
        throw questoesError;
      }

      // Para cada questão, buscar suas alternativas
      const questoesCompletas: QuestaoCompleta[] = [];
      
      for (const questao of questoesData || []) {
        const { data: alternativasData, error: alternativasError } = await supabase
          .from('alternativas')
          .select('*')
          .eq('questao_id', questao.id)
          .order('letra', { ascending: true });

        if (alternativasError) {
          throw alternativasError;
        }

        questoesCompletas.push({
          ...questao,
          alternativas: alternativasData || []
        });
      }

      setQuestoes(questoesCompletas);
    } catch (err) {
      console.error('Erro ao buscar questões:', err);
      setError('Falha ao carregar questões. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const createQuestao = async (
    questao: Omit<Questao, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'tipo'>,
    alternativas: Omit<Alternativa, 'id' | 'questao_id' | 'created_at'>[]
  ) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Inserir a questão
      const { data: questaoData, error: questaoError } = await supabase
        .from('questoes')
        .insert({
          ...questao,
          user_id: user.id
        })
        .select()
        .single();

      if (questaoError || !questaoData) {
        throw questaoError || new Error('Falha ao criar questão');
      }

      // Inserir as alternativas
      const alternativasComQuestaoId = alternativas.map(alt => ({
        ...alt,
        questao_id: questaoData.id
      }));

      const { data: alternativasData, error: alternativasError } = await supabase
        .from('alternativas')
        .insert(alternativasComQuestaoId)
        .select();

      if (alternativasError) {
        throw alternativasError;
      }

      // Atualizar o estado local
      const novaQuestaoCompleta: QuestaoCompleta = {
        ...questaoData,
        alternativas: alternativasData || []
      };

      setQuestoes(prev => [novaQuestaoCompleta, ...prev]);
      
      return novaQuestaoCompleta;
    } catch (err) {
      console.error('Erro ao criar questão:', err);
      setError('Falha ao criar questão. Por favor, tente novamente.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestao = async (questaoId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Excluir a questão (as alternativas serão excluídas automaticamente devido à restrição ON DELETE CASCADE)
      const { error } = await supabase
        .from('questoes')
        .delete()
        .eq('id', questaoId);

      if (error) {
        throw error;
      }

      // Atualizar o estado local
      setQuestoes(prev => prev.filter(q => q.id !== questaoId));
    } catch (err) {
      console.error('Erro ao excluir questão:', err);
      setError('Falha ao excluir questão. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar questões quando o componente montar ou quando o usuário mudar
  useEffect(() => {
    if (user) {
      fetchQuestoes();
    } else {
      setQuestoes([]);
      setLoading(false);
    }
  }, [user]);

  return {
    questoes,
    loading,
    error,
    fetchQuestoes,
    createQuestao,
    deleteQuestao
  };
};

