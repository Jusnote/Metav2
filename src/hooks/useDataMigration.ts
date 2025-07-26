import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Deck, Flashcard } from '@/types/flashcard';

export function useDataMigration() {
  const [hasLocalData, setHasLocalData] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);

  useEffect(() => {
    checkForLocalData();
  }, []);

  const checkForLocalData = () => {
    // Temporariamente desabilitado
    setHasLocalData(false);
    setShowMigrationDialog(false);
  };

  const migrateData = async () => {
    setIsMigrating(true);
    setMigrationProgress(0);

    try {
      // Temporariamente desabilitado - necessário implementar migração correta
      console.log('Migração temporariamente desabilitada');
      setMigrationProgress(100);
      clearLocalData();
    } catch (error) {
      console.error('Erro na migração:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  const skipMigration = () => {
    localStorage.setItem('migration_completed', 'true');
    setShowMigrationDialog(false);
  };

  const clearLocalData = () => {
    localStorage.removeItem('flashcards_decks');
    localStorage.removeItem('flashcards_cards');
    localStorage.setItem('migration_completed', 'true');
    setShowMigrationDialog(false);
    setHasLocalData(false);
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