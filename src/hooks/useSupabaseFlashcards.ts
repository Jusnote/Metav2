import { useState, useEffect } from 'react';
import { Flashcard, Deck, StudyDifficulty, studyDifficultyToRating } from '@/types/flashcard';
import { FSRSSpacedRepetition } from '@/lib/fsrs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { State } from 'ts-fsrs';

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
        .from("flashcards")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("Supabase cardsData:", cardsData);
      console.log("Supabase cardsError:", cardsError);

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

      const transformedCards: Flashcard[] = (cardsData || []).map(card => {
        console.log("Original Supabase card:", card);
        const transformedCard: Flashcard = {
          id: card.id,
          front: card.front,
          back: card.back,
          deckId: card.deck_id,
          created: new Date(card.created_at),
          lastReviewed: card.last_reviewed ? new Date(card.last_reviewed) : undefined,
          nextReview: new Date(card.next_review),
          difficulty: card.difficulty_fsrs || 0,
          stability: card.stability || 0,
          state: card.state || State.New,
          due: new Date(card.due || card.next_review),
          last_review: card.last_review_fsrs ? new Date(card.last_review_fsrs) : undefined,
          review_count: card.review_count || 0,
          type: (card as any).type || 'traditional',
          hiddenWordIndices: (card as any).hidden_word_indices,
          hiddenWords: (card as any).hidden_words,
          parentId: card.parent_id,
          childIds: card.child_ids || [],
          level: card.level,
          order: card.card_order,
        };
        console.log("Transformed card:", transformedCard);
        return transformedCard;
      });

      setDecks(transformedDecks);
      setCards(transformedCards);
      console.log("Dados carregados com sucesso. Cards:", transformedCards);
      console.log("Estado atual dos cards após loadData:", cards);
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
  ): Promise<string | null> => {
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

      console.log("Creating card with parentId:", parentId);
      console.log("Calculated level:", level);
      console.log("Calculated order:", order);

      const insertData = {
        user_id: user.id,
        deck_id: deckId,
        front,
        back,
        parent_id: parentId === undefined ? null : parentId,
        level,
        card_order: order,
        type,
        hidden_word_indices: hiddenWordIndices,
        hidden_words: hiddenWords,
        difficulty_fsrs: 0, // Default for FSRS
        stability: 0, // Default for FSRS
        state: State.New, // State.New for FSRS
        due: new Date().toISOString(), // Default for FSRS
        last_review_fsrs: null, // Default for FSRS
        review_count: 0, // Default for FSRS
      };
      console.log("Supabase insert payload:", insertData);
      const { data, error } = await supabase
        .from("flashcards")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      console.log("Supabase insert data:", data);

      const newCard: Flashcard = {
        id: data.id,
        front: data.front,
        back: data.back,
        deckId: data.deck_id,
        created: new Date(data.created_at),
        lastReviewed: data.last_reviewed ? new Date(data.last_reviewed) : undefined,
        nextReview: new Date(data.next_review),
        difficulty: data.difficulty_fsrs || 0,
        stability: data.stability || 0,
        state: data.state || State.New,
        due: new Date(data.due || data.next_review),
        last_review: data.last_review_fsrs ? new Date(data.last_review_fsrs) : undefined,
        review_count: data.review_count || 0,
        type: (data as any).type || 'traditional',
        hiddenWordIndices: (data as any).hidden_word_indices,
        hiddenWords: (data as any).hidden_words,
        parentId: data.parent_id,
        childIds: data.child_ids || [],
        level: data.level,
        order: data.card_order,
      };

      console.log("New card created with ID:", newCard.id);
      setCards(prev => [...prev, newCard]);

      // Update parent's childIds if this is a sub-card
      if (parentId) {
        const currentChildIds = parentCard?.childIds || [];
        const updatedChildIds = [...currentChildIds, newCard.id];
        console.log("Updating parent with child_ids:", updatedChildIds);

        const { error: updateError } = await supabase
          .from("flashcards")
          .update({
            child_ids: updatedChildIds
          })
          .eq("id", parentId);

        if (updateError) {
          console.error("Error updating parent card:", updateError);
        } else {
          // Recarregar todos os dados para garantir que os childIds do pai sejam atualizados
          await loadData();
        }
      }

      return newCard.id;
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

      const rating = studyDifficultyToRating(difficulty);
      const { difficulty: newDifficulty, stability, state, due, last_review, review_count } = FSRSSpacedRepetition.calculateNextReview(card, rating);

      const { error } = await supabase
        .from("flashcards")
        .update({
          last_reviewed: new Date().toISOString(),
          next_review: due.toISOString(), // next_review will be the due date from FSRS
          difficulty_fsrs: newDifficulty,
          stability,
          state,
          due: due.toISOString(),
          last_review_fsrs: last_review.toISOString(),
          review_count,
        })
        .eq("id", cardId);

      if (error) throw error;

      setCards(prev => prev.map(c => {
        if (c.id !== cardId) return c;

        return {
          ...c,
          lastReviewed: new Date(),
          nextReview: due,
          difficulty: newDifficulty,
          stability,
          state,
          due,
          last_review,
          review_count,
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
    return FSRSSpacedRepetition.getDueCards(relevantCards);
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