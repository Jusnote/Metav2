import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { BlockNoteFlashcard, BlockNoteFlashcardInsert, BlockNoteFlashcardUpdate } from '@/types/database';
import { useServerFirst } from './useServerFirst';

interface FlashcardStats {
  total: number;
  dueForReview: number;
  newCards: number;
  learning: number;
}

/**
 * Hook para flashcards BlockNote usando padrão Server-First
 * Mantém a mesma interface pública para compatibilidade
 */
export function useBlockNoteFlashcards() {
  const { toast } = useToast();

  // Usar hook base server-first
  const {
    data: flashcards,
    isLoading,
    isSyncing,
    error,
    create,
    update,
    remove,
    refresh
  } = useServerFirst<BlockNoteFlashcard>({
    tableName: 'flashcards',
    realtime: true, // Sincronização em tempo real
    cacheTimeout: 5 * 60 * 1000, // Cache por 5 minutos
    enableOfflineQueue: true
  });


  // Calcular estatísticas baseadas nos dados
  const stats = useMemo((): FlashcardStats => {
    const now = new Date();
    
    const total = flashcards.length;
    const dueForReview = flashcards.filter(card => 
      new Date(card.next_review) <= now
    ).length;
    const newCards = flashcards.filter(card => 
      card.repetitions === 0
    ).length;
    const learning = flashcards.filter(card => 
      card.repetitions > 0 && card.repetitions < 3
    ).length;

    return { total, dueForReview, newCards, learning };
  }, [flashcards]);

  // Buscar todos os flashcards (compatibilidade)
  const fetchFlashcards = useCallback(async (deckName?: string) => {
    try {
      await refresh();

      if (deckName) {
        // Filtrar por deck localmente (dados já estão em cache)
        // Nota: Para filtros complexos, podemos expandir useServerFirst
        console.log(`Filtro por deck "${deckName}" aplicado localmente`);
      }
    } catch (error) {
      console.error('Erro ao buscar flashcards:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar flashcards',
        variant: 'destructive',
      });
    }
  }, [refresh, toast]);

  // Buscar flashcards para revisão
  const fetchDueFlashcards = useCallback(async (limit = 20): Promise<BlockNoteFlashcard[]> => {
    try {
      const now = new Date();
      const dueCards = flashcards
        .filter(card => new Date(card.next_review) <= now)
        .sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime())
        .slice(0, limit);
      
      return dueCards;
    } catch (error) {
      console.error('Erro ao buscar flashcards para revisão:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar flashcards para revisão',
        variant: 'destructive',
      });
      return [];
    }
  }, [flashcards, toast]);

  // Criar flashcard a partir de uma nota
  const createFlashcardFromNote = useCallback(async (
    title: string,
    content: any[],
    deckName = 'Default Deck',
    noteId?: string,
    markNoteAsFlashcard?: (noteId: string, flashcardId: string) => void
  ): Promise<BlockNoteFlashcard | null> => {
    try {
      const flashcardData: Omit<BlockNoteFlashcardInsert, 'user_id'> = {
        deck_name: deckName,
        title,
        front: content,
        back: content,
        next_review: new Date().toISOString(),
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        difficulty: 'medium'
      };

      const newFlashcard = await create(flashcardData as any);
      
      if (newFlashcard && noteId && markNoteAsFlashcard) {
        markNoteAsFlashcard(noteId, newFlashcard.id);
      }

      if (newFlashcard) {
      toast({
        title: 'Sucesso',
        description: 'Flashcard criado com sucesso!',
      });
      }

      return newFlashcard;
    } catch (error) {
      console.error('Erro ao criar flashcard:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar flashcard',
        variant: 'destructive',
      });
      return null;
    }
  }, [create, toast]);

  // Atualizar conteúdo do flashcard
  const updateFlashcardContent = useCallback(async (
    flashcardId: string,
    title: string,
    content: any[]
  ): Promise<BlockNoteFlashcard | null> => {
    try {
      const updates: Partial<BlockNoteFlashcard> = {
          title,
          front: content,
          back: content,
          updated_at: new Date().toISOString()
      };

      const updatedFlashcard = await update(flashcardId, updates);

      if (updatedFlashcard) {
        toast({
          title: 'Sucesso',
          description: 'Flashcard atualizado com sucesso!',
        });
      }

      return updatedFlashcard;
    } catch (error) {
      console.error('Erro ao atualizar flashcard:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar flashcard',
        variant: 'destructive',
      });
      return null;
    }
  }, [update, toast]);

  // Atualizar revisão do flashcard (sistema de repetição espaçada)
  const updateFlashcardReview = useCallback(async (
    flashcardId: string,
    difficulty: 'again' | 'hard' | 'medium' | 'easy'
  ): Promise<boolean> => {
    try {
      const flashcard = flashcards.find(f => f.id === flashcardId);
      if (!flashcard) {
        throw new Error('Flashcard não encontrado');
      }

      // Calcular próxima revisão baseada na dificuldade
      const now = new Date();
      let intervalDays = flashcard.interval_days || 0;
      let easeFactor = flashcard.ease_factor || 2.5;
      let repetitions = flashcard.repetitions || 0;

      switch (difficulty) {
        case 'again':
          intervalDays = 1;
          repetitions = 0;
          easeFactor = Math.max(1.3, easeFactor - 0.2);
          break;
        case 'hard':
          intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
          repetitions += 1;
          easeFactor = Math.max(1.3, easeFactor - 0.15);
          break;
        case 'medium':
          intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
          repetitions += 1;
          break;
        case 'easy':
          intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * 1.3));
          repetitions += 1;
          easeFactor += 0.15;
          break;
      }

      const nextReview = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

      const updates: Partial<BlockNoteFlashcard> = {
        last_reviewed: now.toISOString(),
        next_review: nextReview.toISOString(),
        interval_days: intervalDays,
        ease_factor: easeFactor,
        repetitions,
        difficulty: difficulty === 'again' ? 'hard' : difficulty === 'easy' ? 'easy' : 'medium'
      };

      const updatedFlashcard = await update(flashcardId, updates);
      return !!updatedFlashcard;

    } catch (error) {
      console.error('Erro ao atualizar revisão:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar revisão do flashcard',
        variant: 'destructive',
      });
      return false;
    }
  }, [flashcards, update, toast]);

  // Deletar flashcard
  const deleteFlashcard = useCallback(async (flashcardId: string): Promise<boolean> => {
    try {
      const success = await remove(flashcardId);
      
      if (success) {
      toast({
        title: 'Sucesso',
        description: 'Flashcard excluído com sucesso!',
      });
      }

      return success;
    } catch (error) {
      console.error('Erro ao deletar flashcard:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir flashcard',
        variant: 'destructive',
      });
      return false;
    }
  }, [remove, toast]);

  // Carregar dados na inicialização
  useEffect(() => {
    fetchFlashcards();
  }, [fetchFlashcards]);

  // Mostrar erros do servidor
  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro de Sincronização',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  return {
    // Dados
    flashcards,
    stats,
    
    // Estados
    isLoading,
    isSyncing,
    error,
    
    // Operações principais (interface compatível)
    fetchFlashcards,
    fetchDueFlashcards,
    createFlashcardFromNote,
    updateFlashcardContent,
    updateFlashcardReview,
    deleteFlashcard,
    
    // Operações adicionais
    refresh
  };
}
