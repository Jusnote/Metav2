import { useState, useEffect } from 'react';
import { Flashcard, Deck, StudyDifficulty } from '@/types/flashcard';
import { SpacedRepetition } from '@/lib/spaced-repetition';

const STORAGE_KEYS = {
  decks: 'flashcards_decks',
  cards: 'flashcards_cards',
};

export function useFlashcards() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedDecks = localStorage.getItem(STORAGE_KEYS.decks);
    const savedCards = localStorage.getItem(STORAGE_KEYS.cards);

    if (savedDecks) {
      try {
        const parsedDecks = JSON.parse(savedDecks).map((deck: any) => ({
          ...deck,
          created: new Date(deck.created),
        }));
        setDecks(parsedDecks);
      } catch (error) {
        console.error('Error parsing saved decks:', error);
      }
    }

    if (savedCards) {
      try {
        const parsedCards = JSON.parse(savedCards).map((card: any) => ({
          ...card,
          created: new Date(card.created),
          lastReviewed: card.lastReviewed ? new Date(card.lastReviewed) : undefined,
          nextReview: new Date(card.nextReview),
          // Ensure hierarchy fields exist for older cards
          childIds: card.childIds || [],
          level: card.level || 0,
          order: card.order || 0,
        }));
        setCards(parsedCards);
      } catch (error) {
        console.error('Error parsing saved cards:', error);
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.decks, JSON.stringify(decks));
  }, [decks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cards, JSON.stringify(cards));
  }, [cards]);

  const createDeck = (name: string, description?: string): Deck => {
    const newDeck: Deck = {
      id: crypto.randomUUID(),
      name,
      description,
      created: new Date(),
      cardCount: 0,
      color: '#3B82F6', // primary color
    };

    setDecks(prev => [...prev, newDeck]);
    return newDeck;
  };

  const createCard = (deckId: string, front: string, back: string, parentId?: string): Flashcard => {
    const parentCard = parentId ? cards.find(c => c.id === parentId) : null;
    const level = parentCard ? parentCard.level + 1 : 0;
    
    // Calculate order among siblings
    const siblings = cards.filter(c => c.parentId === parentId && c.deckId === deckId);
    const order = siblings.length;

    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      front,
      back,
      deckId,
      created: new Date(),
      nextReview: new Date(), // Due immediately for first review
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      difficulty: 'medium',
      type: 'traditional', // Default type
      hiddenWordIndices: undefined,
      
      // Hierarchy fields
      parentId,
      childIds: [],
      level,
      order,
    };

    setCards(prev => {
      const updated = [...prev, newCard];
      
      // Update parent's childIds if this is a sub-card
      if (parentId) {
        return updated.map(card => 
          card.id === parentId 
            ? { ...card, childIds: [...card.childIds, newCard.id] }
            : card
        );
      }
      
      return updated;
    });
    
    // Update deck card count
    setDecks(prev => prev.map(deck => 
      deck.id === deckId 
        ? { ...deck, cardCount: deck.cardCount + 1 }
        : deck
    ));

    return newCard;
  };

  const updateCard = (cardId: string, difficulty: StudyDifficulty): void => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;

      const { interval, easeFactor, repetitions } = SpacedRepetition.calculateNextReview(card, difficulty);
      const nextReview = SpacedRepetition.getNextReviewDate(interval);

      return {
        ...card,
        lastReviewed: new Date(),
        nextReview,
        interval,
        easeFactor,
        repetitions,
        difficulty,
      };
    }));
  };

  const deleteDeck = (deckId: string): void => {
    setDecks(prev => prev.filter(deck => deck.id !== deckId));
    setCards(prev => prev.filter(card => card.deckId !== deckId));
  };

  const deleteCard = (cardId: string): void => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      setCards(prev => prev.filter(c => c.id !== cardId));
      setDecks(prev => prev.map(deck => 
        deck.id === card.deckId 
          ? { ...deck, cardCount: Math.max(0, deck.cardCount - 1) }
          : deck
      ));
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
  };
}