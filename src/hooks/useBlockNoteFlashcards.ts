import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BlockNoteFlashcard, BlockNoteFlashcardInsert, BlockNoteFlashcardUpdate } from '@/types/database';

interface FlashcardStats {
  total: number;
  dueForReview: number;
  newCards: number;
  learning: number;
}

export function useBlockNoteFlashcards() {
  const [flashcards, setFlashcards] = useState<BlockNoteFlashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats>({ total: 0, dueForReview: 0, newCards: 0, learning: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Buscar todos os flashcards do usuário
  const fetchFlashcards = useCallback(async (deckName?: string) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('flashcards')
        .select('*')
        .order('created_at', { ascending: false });

      if (deckName) {
        query = query.eq('deck_name', deckName);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFlashcards(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Erro ao buscar flashcards:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar flashcards',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Buscar flashcards para revisão
  const fetchDueFlashcards = useCallback(async (limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .lte('next_review', new Date().toISOString())
        .order('next_review', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar flashcards para revisão:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar flashcards para revisão',
        variant: 'destructive',
      });
      return [];
    }
  }, [toast]);

  // Criar flashcard a partir de uma nota
  const createFlashcardFromNote = useCallback(async (
    title: string,
    content: any[],
    deckName = 'Default Deck'
  ): Promise<BlockNoteFlashcard | null> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const flashcardData: BlockNoteFlashcardInsert = {
        user_id: user.user.id,
        deck_name: deckName,
        title,
        front: content, // Por enquanto, front = back = mesmo conteúdo
        back: content,
        next_review: new Date().toISOString(),
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        difficulty: 'medium'
      };

      const { data, error } = await supabase
        .from('flashcards')
        .insert(flashcardData)
        .select()
        .single();

      if (error) throw error;

      setFlashcards(prev => [data, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Flashcard criado com sucesso!',
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar flashcard:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar flashcard',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Atualizar conteúdo do flashcard (sincronização com nota)
  const updateFlashcardContent = useCallback(async (
    flashcardId: string,
    title: string,
    content: any[]
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('flashcards')
        .update({
          title,
          front: content,
          back: content,
          updated_at: new Date().toISOString()
        })
        .eq('id', flashcardId);

      if (error) throw error;

      // Atualizar estado local
      setFlashcards(prev => prev.map(f => 
        f.id === flashcardId 
          ? { ...f, title, front: content, back: content }
          : f
      ));

      return true;
    } catch (error) {
      console.error('Erro ao atualizar conteúdo do flashcard:', error);
      return false;
    }
  }, []);

  // Atualizar resultado da revisão (spaced repetition)
  const updateFlashcardReview = useCallback(async (
    flashcardId: string,
    difficulty: 'again' | 'hard' | 'medium' | 'easy'
  ): Promise<boolean> => {
    try {
      const flashcard = flashcards.find(f => f.id === flashcardId);
      if (!flashcard) throw new Error('Flashcard não encontrado');

      // Calcular próxima revisão usando algoritmo de spaced repetition
      const { nextReview, interval, easeFactor, repetitions } = calculateNextReview(
        flashcard.ease_factor,
        flashcard.repetitions,
        flashcard.interval_days,
        difficulty
      );

      const updateData: BlockNoteFlashcardUpdate = {
        last_reviewed: new Date().toISOString(),
        next_review: nextReview.toISOString(),
        interval_days: interval,
        ease_factor: easeFactor,
        repetitions: repetitions,
        difficulty: difficulty
      };

      const { error } = await supabase
        .from('flashcards')
        .update(updateData)
        .eq('id', flashcardId);

      if (error) throw error;

      // Atualizar estado local
      setFlashcards(prev => prev.map(f => 
        f.id === flashcardId 
          ? { ...f, ...updateData }
          : f
      ));

      return true;
    } catch (error) {
      console.error('Erro ao atualizar revisão:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar resultado da revisão',
        variant: 'destructive',
      });
      return false;
    }
  }, [flashcards, toast]);

  // Deletar flashcard
  const deleteFlashcard = useCallback(async (flashcardId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', flashcardId);

      if (error) throw error;

      // Atualizar estado local
      setFlashcards(prev => {
        const updated = prev.filter(f => f.id !== flashcardId);
        calculateStats(updated);
        return updated;
      });

      toast({
        title: 'Sucesso',
        description: 'Flashcard excluído com sucesso!',
      });

      return true;
    } catch (error) {
      console.error('Erro ao deletar flashcard:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir flashcard',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Buscar decks únicos
  const getDecks = useCallback(async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('deck_name')
        .order('deck_name');

      if (error) throw error;

      const uniqueDecks = [...new Set(data?.map(d => d.deck_name) || [])];
      return uniqueDecks;
    } catch (error) {
      console.error('Erro ao buscar decks:', error);
      return [];
    }
  }, []);

  // Calcular estatísticas
  const calculateStats = (cards: BlockNoteFlashcard[]) => {
    const now = new Date();
    const stats = {
      total: cards.length,
      dueForReview: cards.filter(c => new Date(c.next_review) <= now).length,
      newCards: cards.filter(c => c.repetitions === 0).length,
      learning: cards.filter(c => c.repetitions > 0 && c.repetitions < 3).length,
    };
    setStats(stats);
  };

  // Algoritmo de spaced repetition (SM-2 simplificado)
  const calculateNextReview = (
    easeFactor: number,
    repetitions: number,
    intervalDays: number,
    difficulty: 'again' | 'hard' | 'medium' | 'easy'
  ) => {
    let newEaseFactor = easeFactor;
    let newRepetitions = repetitions;
    let newInterval = intervalDays;

    if (difficulty === 'again') {
      // Resetar se errou
      newRepetitions = 0;
      newInterval = 0;
      newEaseFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
      newRepetitions += 1;
      
      // Ajustar ease factor baseado na dificuldade
      switch (difficulty) {
        case 'hard':
          newEaseFactor = Math.max(1.3, easeFactor - 0.15);
          break;
        case 'medium':
          // Manter ease factor
          break;
        case 'easy':
          newEaseFactor = Math.min(2.5, easeFactor + 0.1);
          break;
      }

      // Calcular próximo intervalo
      if (newRepetitions === 1) {
        newInterval = 1;
      } else if (newRepetitions === 2) {
        newInterval = 6;
      } else {
        newInterval = Math.round(intervalDays * newEaseFactor);
      }

      // Ajustar intervalo baseado na dificuldade
      if (difficulty === 'hard') {
        newInterval = Math.max(1, Math.round(newInterval * 0.8));
      } else if (difficulty === 'easy') {
        newInterval = Math.round(newInterval * 1.2);
      }
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    return {
      nextReview,
      interval: newInterval,
      easeFactor: newEaseFactor,
      repetitions: newRepetitions
    };
  };

  // Carregar flashcards automaticamente
  useEffect(() => {
    fetchFlashcards();
  }, [fetchFlashcards]);

  return {
    flashcards,
    stats,
    isLoading,
    fetchFlashcards,
    fetchDueFlashcards,
    createFlashcardFromNote,
    updateFlashcardContent,
    updateFlashcardReview,
    deleteFlashcard,
    getDecks,
  };
}
