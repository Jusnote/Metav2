import { useState, useEffect } from 'react';
import { Flashcard, Deck, StudyDifficulty } from '@/types/flashcard';
import { SpacedRepetition } from '@/lib/spaced-repetition';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export function useSupabaseFlashcards() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  // Load data from Supabase on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load decks
      const { data: decksData, error: decksError } = await supabase
        .from('decks')
        .select('*')
        .order('created_at', { ascending: false });

      if (decksError) throw decksError;

      // Load cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('flashcards')
        .select('*')
        .order('created_at', { ascending: false });

      if (cardsError) throw cardsError;

      // Transform data to match our types
      const transformedDecks: Deck[] = (decksData || []).map(deck => ({
        id: deck.id,
        name: deck.name,
        description: deck.description,
        created: new Date(deck.created_at),
        cardCount: deck.card_count,
        color: deck.color,
      }));

      const transformedCards: Flashcard[] = (cardsData || []).map(card => ({
        id: card.id,
        front: card.front,
        back: card.back,
        deckId: card.deck_id,
        created: new Date(card.created_at),
        lastReviewed: card.last_reviewed ? new Date(card.last_reviewed) : undefined,
        nextReview: new Date(card.next_review),
        interval: card.interval_days,
        easeFactor: Number(card.ease_factor),
        repetitions: card.repetitions,
        difficulty: card.difficulty as StudyDifficulty,
        type: (card as any).type || 'traditional',
        hiddenWordIndices: (card as any).hidden_word_indices,
        hiddenWords: (card as any).hidden_words,
        parentId: card.parent_id,
        childIds: card.child_ids || [],
        level: card.level,
        order: card.card_order,
      }));

      setDecks(transformedDecks);
      setCards(transformedCards);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do banco.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDeck = async (name: string, description?: string): Promise<Deck | null> => {
    try {
      setIsCreatingDeck(true);
      setSyncStatus('syncing');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar um deck.",
          variant: "destructive",
        });
        setSyncStatus('error');
        return null;
      }

      const { data, error } = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          name,
          description,
          color: '#3B82F6',
        })
        .select()
        .single();

      if (error) throw error;

      const newDeck: Deck = {
        id: data.id,
        name: data.name,
        description: data.description,
        created: new Date(data.created_at),
        cardCount: data.card_count,
        color: data.color,
      };

      setDecks(prev => [newDeck, ...prev]);
      setSyncStatus('success');
      
      toast({
        title: "Deck criado com sucesso!",
        description: `O deck "${name}" foi criado e salvo no banco de dados.`,
      });
      
      return newDeck;
    } catch (error) {
      console.error('Error creating deck:', error);
      setSyncStatus('error');
      toast({
        title: "Erro ao criar deck",
        description: "Não foi possível criar o deck.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreatingDeck(false);
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const createCard = async (
    deckId: string, 
    front: string, 
    back: string, 
    parentId?: string, 
    type: 'traditional' | 'word-hiding' = 'traditional',
    hiddenWordIndices?: number[],
    hiddenWords?: string[]
  ): Promise<Flashcard | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar um cartão.",
          variant: "destructive",
        });
        return null;
      }

      const parentCard = parentId ? cards.find(c => c.id === parentId) : null;
      const level = parentCard ? parentCard.level + 1 : 0;
      
      // Calculate order among siblings
      const siblings = cards.filter(c => c.parentId === parentId && c.deckId === deckId);
      const order = siblings.length;

      const { data, error } = await supabase
        .from('flashcards')
        .insert({
          user_id: user.id,
          deck_id: deckId,
          front,
          back,
          parent_id: parentId,
          level,
          card_order: order,
          type,
          hidden_word_indices: hiddenWordIndices,
          hidden_words: hiddenWords,
        })
        .select()
        .single();

      if (error) throw error;

      const newCard: Flashcard = {
        id: data.id,
        front: data.front,
        back: data.back,
        deckId: data.deck_id,
        created: new Date(data.created_at),
        lastReviewed: data.last_reviewed ? new Date(data.last_reviewed) : undefined,
        nextReview: new Date(data.next_review),
        interval: data.interval_days,
        easeFactor: Number(data.ease_factor),
        repetitions: data.repetitions,
        difficulty: data.difficulty as StudyDifficulty,
        type: (data as any).type || 'traditional',
        hiddenWordIndices: (data as any).hidden_word_indices,
        hiddenWords: (data as any).hidden_words,
        parentId: data.parent_id,
        childIds: data.child_ids || [],
        level: data.level,
        order: data.card_order,
      };

      setCards(prev => [...prev, newCard]);

      // Update parent's childIds if this is a sub-card
      if (parentId) {
        const { error: updateError } = await supabase
          .from('flashcards')
          .update({
            child_ids: [...(parentCard?.childIds || []), newCard.id]
          })
          .eq('id', parentId);

        if (updateError) {
          console.error('Error updating parent card:', updateError);
        } else {
          setCards(prev => prev.map(card => 
            card.id === parentId 
              ? { ...card, childIds: [...card.childIds, newCard.id] }
              : card
          ));
        }
      }

      return newCard;
    } catch (error) {
      console.error('Error creating card:', error);
      toast({
        title: "Erro ao criar cartão",
        description: "Não foi possível criar o cartão.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCard = async (cardId: string, difficulty: StudyDifficulty): Promise<void> => {
    try {
      const card = cards.find(c => c.id === cardId);
      if (!card) return;

      const { interval, easeFactor, repetitions } = SpacedRepetition.calculateNextReview(card, difficulty);
      const nextReview = SpacedRepetition.getNextReviewDate(interval);

      const { error } = await supabase
        .from('flashcards')
        .update({
          last_reviewed: new Date().toISOString(),
          next_review: nextReview.toISOString(),
          interval_days: interval,
          ease_factor: easeFactor,
          repetitions,
          difficulty,
        })
        .eq('id', cardId);

      if (error) throw error;

      setCards(prev => prev.map(c => {
        if (c.id !== cardId) return c;

        return {
          ...c,
          lastReviewed: new Date(),
          nextReview,
          interval,
          easeFactor,
          repetitions,
          difficulty,
        };
      }));
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: "Erro ao atualizar cartão",
        description: "Não foi possível atualizar o cartão.",
        variant: "destructive",
      });
    }
  };

  const deleteDeck = async (deckId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (error) throw error;

      setDecks(prev => prev.filter(deck => deck.id !== deckId));
      setCards(prev => prev.filter(card => card.deckId !== deckId));
    } catch (error) {
      console.error('Error deleting deck:', error);
      toast({
        title: "Erro ao excluir deck",
        description: "Não foi possível excluir o deck.",
        variant: "destructive",
      });
    }
  };

  const deleteCard = async (cardId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;

      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (error) {
      console.error('Error deleting card:', error);
      toast({
        title: "Erro ao excluir cartão",
        description: "Não foi possível excluir o cartão.",
        variant: "destructive",
      });
    }
  };

  const getCardsByDeck = (deckId: string): Flashcard[] => {
    return cards.filter(card => card.deckId === deckId).sort((a, b) => {
      // Sort by creation date to maintain chronological order
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });
  };

  const getDueCards = (deckId?: string): Flashcard[] => {
    const relevantCards = deckId ? getCardsByDeck(deckId) : cards;
    return SpacedRepetition.getDueCards(relevantCards);
  };

  const getDeckStats = (deckId: string) => {
    const deckCards = getCardsByDeck(deckId);
    const dueCards = getDueCards(deckId);
    
    return {
      total: deckCards.length,
      due: dueCards.length,
      reviewed: deckCards.filter(card => card.lastReviewed).length,
      new: deckCards.filter(card => !card.lastReviewed).length,
    };
  };

  // Helper functions for hierarchy
  const getChildCards = (parentId: string): Flashcard[] => {
    return cards.filter(card => card.parentId === parentId).sort((a, b) => a.order - b.order);
  };

  const getRootCards = (deckId?: string): Flashcard[] => {
    const relevantCards = deckId ? getCardsByDeck(deckId) : cards;
    return relevantCards.filter(card => !card.parentId).sort((a, b) => a.order - b.order);
  };

  const getCardHierarchy = (rootCard: Flashcard): Flashcard[] => {
    const hierarchy = [rootCard];
    
    const addChildren = (parentId: string) => {
      const children = getChildCards(parentId);
      children.forEach(child => {
        hierarchy.push(child);
        addChildren(child.id);
      });
    };
    
    addChildren(rootCard.id);
    return hierarchy;
  };

  return {
    decks,
    cards,
    loading,
    isCreatingDeck,
    isCreatingCard,
    isUpdatingCard,
    isDeletingCard,
    syncStatus,
    createDeck,
    createCard,
    updateCard,
    deleteDeck,
    deleteCard,
    getCardsByDeck,
    getDueCards,
    getDeckStats,
    getChildCards,
    getRootCards,
    getCardHierarchy,
    loadData,
  };
}