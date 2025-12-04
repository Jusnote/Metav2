import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

interface MaterialCounts {
  documents: number;
  flashcards: number;
  questions: number;
}

interface UseMaterialCountsReturn {
  counts: MaterialCounts;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Hook para contar materiais (documentos, flashcards, questões) associados a um subtópico ou tópico
 * @param subtopicId - ID do subtópico (opcional)
 * @param topicId - ID do tópico (opcional, usado quando não há subtópico)
 * @returns Contagens de materiais, estado de carregamento e função de refetch
 */
export const useMaterialCounts = (
  subtopicId?: string | null,
  topicId?: string | null
): UseMaterialCountsReturn => {
  const [counts, setCounts] = useState<MaterialCounts>({
    documents: 0,
    flashcards: 0,
    questions: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchCounts = async () => {
    if (!subtopicId && !topicId) {
      setCounts({ documents: 0, flashcards: 0, questions: 0 });
      return;
    }

    setIsLoading(true);

    try {
      // Contar documentos
      const { count: documentsCount, error: docsError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq(subtopicId ? 'subtopic_id' : 'topic_id', (subtopicId || topicId) as string);

      if (docsError) {
        console.error('Error counting documents:', docsError);
      }

      // TODO: Adicionar contagem de flashcards quando tabela existir
      // const { count: flashcardsCount, error: flashcardsError } = await supabase
      //   .from('flashcards')
      //   .select('*', { count: 'exact', head: true })
      //   .eq(subtopicId ? 'subtopic_id' : 'topic_id', subtopicId || topicId);

      // TODO: Adicionar contagem de questões quando tabela existir
      // const { count: questionsCount, error: questionsError } = await supabase
      //   .from('questions')
      //   .select('*', { count: 'exact', head: true })
      //   .eq(subtopicId ? 'subtopic_id' : 'topic_id', subtopicId || topicId);

      setCounts({
        documents: documentsCount || 0,
        flashcards: 0, // TODO: flashcardsCount || 0,
        questions: 0   // TODO: questionsCount || 0
      });
    } catch (error) {
      console.error('Error fetching material counts:', error);
      setCounts({ documents: 0, flashcards: 0, questions: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [subtopicId, topicId]);

  // Realtime subscription para documents
  useEffect(() => {
    if (!subtopicId && !topicId) return;

    const channel = supabase
      .channel(`material_counts_${subtopicId || topicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: subtopicId
            ? `subtopic_id=eq.${subtopicId}`
            : `topic_id=eq.${topicId}`
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [subtopicId, topicId]);

  return {
    counts,
    isLoading,
    refetch: fetchCounts
  };
};
