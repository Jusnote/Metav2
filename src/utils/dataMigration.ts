/**
 * Sistema de migração de dados localStorage → Supabase
 * Para uso durante a transição para padrão Server-First
 */

import { supabase } from '@/integrations/supabase/client';
import { auditLocalStorage, exportLocalStorageData } from './localStorageAudit';

export interface MigrationResult {
  success: boolean;
  migratedItems: number;
  errors: string[];
  skippedItems: number;
  backupCreated: boolean;
  duration: number;
}

export interface MigrationProgress {
  stage: 'preparing' | 'backup' | 'migrating' | 'validating' | 'cleanup' | 'complete';
  progress: number; // 0-100
  currentItem?: string;
  totalItems: number;
  processedItems: number;
}

const MIGRATION_COMPLETED_KEY = 'server_first_migration_completed';
const BACKUP_KEY = 'migration_backup';

/**
 * Executa migração completa localStorage → Supabase
 */
export async function migrateToServerFirst(
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    migratedItems: 0,
    errors: [],
    skippedItems: 0,
    backupCreated: false,
    duration: 0
  };

  try {
    // Verificar se migração já foi feita
    if (localStorage.getItem(MIGRATION_COMPLETED_KEY)) {
      result.errors.push('Migração já foi executada anteriormente');
      return result;
    }

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      result.errors.push('Usuário não autenticado');
      return result;
    }

    // Auditar dados existentes
    onProgress?.({
      stage: 'preparing',
      progress: 5,
      totalItems: 0,
      processedItems: 0
    });

    const audit = auditLocalStorage();
    const itemsToMigrate = audit.dataKeys.filter(key => key.needsMigration && key.itemCount > 0);
    
    if (itemsToMigrate.length === 0) {
      result.success = true;
      result.duration = Date.now() - startTime;
      localStorage.setItem(MIGRATION_COMPLETED_KEY, new Date().toISOString());
      return result;
    }

    const totalItems = itemsToMigrate.reduce((sum, key) => sum + key.itemCount, 0);

    // Criar backup
    onProgress?.({
      stage: 'backup',
      progress: 10,
      totalItems,
      processedItems: 0
    });

    const backup = exportLocalStorageData();
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      timestamp: new Date().toISOString(),
      data: backup
    }));
    result.backupCreated = true;

    // Migrar cada tipo de dados
    onProgress?.({
      stage: 'migrating',
      progress: 20,
      totalItems,
      processedItems: 0
    });

    let processedItems = 0;

    for (const dataKey of itemsToMigrate) {
      try {
        onProgress?.({
          stage: 'migrating',
          progress: 20 + (processedItems / totalItems) * 60,
          currentItem: dataKey.description,
          totalItems,
          processedItems
        });

        const migrated = await migrateDataKey(dataKey.key, user.id);
        result.migratedItems += migrated;
        processedItems += dataKey.itemCount;

      } catch (error) {
        const errorMsg = `Erro ao migrar ${dataKey.key}: ${error instanceof Error ? error.message : error}`;
        result.errors.push(errorMsg);
        result.skippedItems += dataKey.itemCount;
      }
    }

    // Validação
    onProgress?.({
      stage: 'validating',
      progress: 85,
      totalItems,
      processedItems
    });

    const validationErrors = await validateMigration(user.id);
    result.errors.push(...validationErrors);

    // Limpeza (opcional - manter backup por segurança)
    onProgress?.({
      stage: 'cleanup',
      progress: 95,
      totalItems,
      processedItems
    });

    // Marcar migração como concluída
    localStorage.setItem(MIGRATION_COMPLETED_KEY, new Date().toISOString());

    onProgress?.({
      stage: 'complete',
      progress: 100,
      totalItems,
      processedItems
    });

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    return result;

  } catch (error) {
    result.errors.push(`Erro geral na migração: ${error instanceof Error ? error.message : error}`);
    result.duration = Date.now() - startTime;
    return result;
  }
}

/**
 * Migra dados de uma chave específica
 */
async function migrateDataKey(key: string, userId: string): Promise<number> {
  const value = localStorage.getItem(key);
  if (!value) return 0;

  try {
    const data = JSON.parse(value);
    
    switch (key) {
      case 'flashcards_decks':
        return await migrateFlashcardDecks(data, userId);
      
      case 'flashcards_cards':
        return await migrateFlashcardCards(data, userId);
      
      case 'quick_notes_local':
        return await migrateQuickNotes(data, userId);
      
      default:
        console.warn(`Tipo de migração não implementado para: ${key}`);
        return 0;
    }
  } catch (error) {
    throw new Error(`Erro ao processar dados de ${key}: ${error}`);
  }
}

/**
 * Migra decks de flashcards antigos
 */
async function migrateFlashcardDecks(decks: any[], userId: string): Promise<number> {
  if (!Array.isArray(decks) || decks.length === 0) return 0;

  // Verificar se já existem decks no Supabase
  const { data: existingDecks } = await supabase
    .from('decks')
    .select('id')
    .eq('user_id', userId);

  if (existingDecks && existingDecks.length > 0) {
    console.log('Decks já existem no Supabase, pulando migração');
    return 0;
  }

  const migrationData = decks.map(deck => ({
    user_id: userId,
    name: deck.name || 'Deck Migrado',
    description: deck.description || '',
    color: deck.color || '#3B82F6',
    created_at: deck.created ? new Date(deck.created).toISOString() : new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('decks')
    .insert(migrationData)
    .select();

  if (error) throw error;

  return data?.length || 0;
}

/**
 * Migra flashcards antigos
 */
async function migrateFlashcardCards(cards: any[], userId: string): Promise<number> {
  if (!Array.isArray(cards) || cards.length === 0) return 0;

  // Verificar se já existem flashcards no Supabase
  const { data: existingCards } = await supabase
    .from('flashcards')
    .select('id')
    .eq('user_id', userId);

  if (existingCards && existingCards.length > 0) {
    console.log('Flashcards já existem no Supabase, pulando migração');
    return 0;
  }

  const migrationData = cards.map(card => ({
    user_id: userId,
    title: card.front || 'Flashcard Migrado',
    deck_name: 'Deck Migrado',
    front: typeof card.front === 'string' ? [{ type: 'paragraph', content: card.front }] : card.front,
    back: typeof card.back === 'string' ? [{ type: 'paragraph', content: card.back }] : card.back,
    created_at: card.created ? new Date(card.created).toISOString() : new Date().toISOString(),
    next_review: card.nextReview ? new Date(card.nextReview).toISOString() : new Date().toISOString(),
    interval_days: card.intervalDays || 0,
    ease_factor: card.easeFactor || 2.5,
    repetitions: card.repetitions || 0,
    difficulty: card.difficulty || 'medium'
  }));

  const { data, error } = await supabase
    .from('flashcards')
    .insert(migrationData)
    .select();

  if (error) throw error;

  return data?.length || 0;
}

/**
 * Migra notas rápidas
 */
async function migrateQuickNotes(notes: any[], userId: string): Promise<number> {
  if (!Array.isArray(notes) || notes.length === 0) return 0;

  // Verificar se já existem notas no Supabase
  const { data: existingNotes } = await supabase
    .from('quick_notes')
    .select('id')
    .eq('user_id', userId);

  if (existingNotes && existingNotes.length > 0) {
    console.log('Quick notes já existem no Supabase, pulando migração');
    return 0;
  }

  const migrationData = notes.map(note => ({
    user_id: userId,
    title: note.title || 'Nota Migrada',
    content: note.content || [],
    created_at: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString(),
    type: note.flashcardId ? 'both' : 'note',
    flashcard_id: note.flashcardId || null
  }));

  const { data, error } = await supabase
    .from('quick_notes')
    .insert(migrationData)
    .select();

  if (error) throw error;

  return data?.length || 0;
}

/**
 * Valida se a migração foi bem-sucedida
 */
async function validateMigration(userId: string): Promise<string[]> {
  const errors: string[] = [];

  try {
    // Verificar se dados foram migrados corretamente
    const { data: flashcards } = await supabase
      .from('flashcards')
      .select('id')
      .eq('user_id', userId);

    const { data: quickNotes } = await supabase
      .from('quick_notes')
      .select('id')
      .eq('user_id', userId);

    // Comparar com dados locais
    const localFlashcards = localStorage.getItem('flashcards_cards');
    const localNotes = localStorage.getItem('quick_notes_local');

    if (localFlashcards) {
      const localCount = JSON.parse(localFlashcards).length;
      const serverCount = flashcards?.length || 0;
      
      if (localCount > 0 && serverCount === 0) {
        errors.push('Flashcards não foram migrados corretamente');
      }
    }

    if (localNotes) {
      const localCount = JSON.parse(localNotes).length;
      const serverCount = quickNotes?.length || 0;
      
      if (localCount > 0 && serverCount === 0) {
        errors.push('Quick notes não foram migradas corretamente');
      }
    }

  } catch (error) {
    errors.push(`Erro na validação: ${error instanceof Error ? error.message : error}`);
  }

  return errors;
}

/**
 * Restaura dados do backup em caso de problemas
 */
export async function restoreFromBackup(): Promise<boolean> {
  try {
    const backupData = localStorage.getItem(BACKUP_KEY);
    if (!backupData) {
      console.error('Backup não encontrado');
      return false;
    }

    const backup = JSON.parse(backupData);
    
    // Restaurar dados importantes
    Object.entries(backup.data).forEach(([key, value]) => {
      if (key.startsWith('flashcards_') || key.startsWith('quick_notes_')) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });

    // Remover flag de migração para permitir nova tentativa
    localStorage.removeItem(MIGRATION_COMPLETED_KEY);

    return true;
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    return false;
  }
}

/**
 * Verifica se migração já foi executada
 */
export function isMigrationCompleted(): boolean {
  return localStorage.getItem(MIGRATION_COMPLETED_KEY) !== null;
}

/**
 * Limpa dados migrados do localStorage (usar com cuidado)
 */
export function cleanupMigratedData(): number {
  const keysToClean = [
    'flashcards_decks',
    'flashcards_cards',
    'quick_notes_local'
  ];

  let cleaned = 0;
  keysToClean.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      cleaned++;
    }
  });

  return cleaned;
}
