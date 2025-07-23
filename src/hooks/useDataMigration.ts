import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Deck, Flashcard } from '@/types/flashcard';

const DECKS_KEY = 'flashcards_decks';
const CARDS_KEY = 'flashcards_cards';
const MIGRATION_COMPLETED_KEY = 'migration_completed';

export function useDataMigration() {
  const [hasLocalData, setHasLocalData] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkForLocalData();
  }, []);

  const checkForLocalData = () => {
    const migrationCompleted = localStorage.getItem(MIGRATION_COMPLETED_KEY);
    if (migrationCompleted) {
      return; // Migração já foi feita
    }

    const savedDecks = localStorage.getItem(DECKS_KEY);
    const savedCards = localStorage.getItem(CARDS_KEY);
    
    if (savedDecks || savedCards) {
      try {
        const decks = savedDecks ? JSON.parse(savedDecks) : [];
        const cards = savedCards ? JSON.parse(savedCards) : [];
        
        if (decks.length > 0 || cards.length > 0) {
          setHasLocalData(true);
          setShowMigrationDialog(true);
        }
      } catch (error) {
        console.error('Erro ao verificar dados locais:', error);
      }
    }
  };

  const migrateData = async (): Promise<boolean> => {
    try {
      setIsMigrating(true);
      setMigrationProgress(0);

      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para migrar os dados.",
          variant: "destructive",
        });
        return false;
      }

      // Obter dados do localStorage
      const savedDecks = localStorage.getItem(DECKS_KEY);
      const savedCards = localStorage.getItem(CARDS_KEY);
      
      const localDecks: Deck[] = savedDecks ? JSON.parse(savedDecks).map((deck: any) => ({
        ...deck,
        created: new Date(deck.created),
      })) : [];
      
      const localCards: Flashcard[] = savedCards ? JSON.parse(savedCards).map((card: any) => ({
        ...card,
        created: new Date(card.created),
        lastReviewed: card.lastReviewed ? new Date(card.lastReviewed) : undefined,
      })) : [];

      const totalItems = localDecks.length + localCards.length;
      let processedItems = 0;

      // Migrar decks
      const deckMapping: { [oldId: string]: string } = {};
      
      for (const deck of localDecks) {
        try {
          const { data, error } = await supabase
            .from('decks')
            .insert({
              user_id: user.id,
              name: deck.name,
              description: deck.description,
              color: deck.color || '#3B82F6',
            })
            .select()
            .single();

          if (error) throw error;
          
          deckMapping[deck.id] = data.id;
          processedItems++;
          setMigrationProgress((processedItems / totalItems) * 100);
        } catch (error) {
          console.error(`Erro ao migrar deck ${deck.name}:`, error);
        }
      }

      // Migrar cards
      for (const card of localCards) {
        try {
          const newDeckId = deckMapping[card.deckId];
          if (!newDeckId) {
            console.warn(`Deck não encontrado para o card ${card.id}`);
            processedItems++;
            continue;
          }

          const { error } = await supabase
            .from('flashcards')
            .insert({
              user_id: user.id,
              deck_id: newDeckId,
              front: card.front,
              back: card.back,
              last_reviewed: card.lastReviewed?.toISOString(),
              next_review: card.nextReview.toISOString(),
              interval_days: card.interval,
              ease_factor: card.easeFactor,
              repetitions: card.repetitions,
              difficulty: card.difficulty,
              parent_id: card.parentId ? deckMapping[card.parentId] : null,
              child_ids: card.childIds || [],
              level: card.level || 0,
              card_order: card.order || 0,
            });

          if (error) throw error;
          
          processedItems++;
          setMigrationProgress((processedItems / totalItems) * 100);
        } catch (error) {
          console.error(`Erro ao migrar card ${card.id}:`, error);
        }
      }

      // Marcar migração como concluída
      localStorage.setItem(MIGRATION_COMPLETED_KEY, 'true');
      
      // Limpar dados locais
      localStorage.removeItem(DECKS_KEY);
      localStorage.removeItem(CARDS_KEY);
      
      setHasLocalData(false);
      setShowMigrationDialog(false);
      
      toast({
        title: "Migração concluída!",
        description: `${localDecks.length} decks e ${localCards.length} cards foram migrados para o banco de dados.`,
      });
      
      return true;
    } catch (error) {
      console.error('Erro durante a migração:', error);
      toast({
        title: "Erro na migração",
        description: "Ocorreu um erro durante a migração dos dados.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsMigrating(false);
      setMigrationProgress(0);
    }
  };

  const skipMigration = () => {
    localStorage.setItem(MIGRATION_COMPLETED_KEY, 'true');
    setHasLocalData(false);
    setShowMigrationDialog(false);
    
    toast({
      title: "Migração ignorada",
      description: "Os dados locais foram mantidos no navegador.",
    });
  };

  const clearLocalData = () => {
    localStorage.removeItem(DECKS_KEY);
    localStorage.removeItem(CARDS_KEY);
    localStorage.setItem(MIGRATION_COMPLETED_KEY, 'true');
    setHasLocalData(false);
    setShowMigrationDialog(false);
    
    toast({
      title: "Dados locais removidos",
      description: "Os dados do localStorage foram limpos.",
    });
  };

  return {
    hasLocalData,
    isMigrating,
    migrationProgress,
    showMigrationDialog,
    setShowMigrationDialog,
    migrateData,
    skipMigration,
    clearLocalData,
    checkForLocalData,
  };
}

