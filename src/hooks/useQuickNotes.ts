import { useState, useCallback, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useServerFirst } from './useServerFirst';

// Tipos para Quick Notes
export interface QuickNote {
  id: string;
  user_id: string;
  title: string;
  content: any[]; // BlockNote JSON structure
  created_at: string;
  updated_at: string;
  flashcard_id?: string;
  type: 'note' | 'flashcard' | 'both';
}

export interface QuickNoteInsert {
  title?: string;
  content: any[];
  flashcard_id?: string;
  type?: 'note' | 'flashcard' | 'both';
}

export interface QuickNoteUpdate {
  title?: string;
  content?: any[];
  flashcard_id?: string;
  type?: 'note' | 'flashcard' | 'both';
  updated_at?: string;
}

// Interface local para compatibilidade com NotesPage
interface LocalNote {
  id: string;
  title: string;
  content: any[];
  createdAt: Date;
  isEditing?: boolean;
  syncStatus?: 'pending' | 'synced' | 'error';
  needsSync?: boolean;
  flashcardId?: string;
}

/**
 * Hook para Quick Notes usando padrão Server-First
 * Mantém compatibilidade com a interface anterior
 */
export function useQuickNotes() {
  const { toast } = useToast();
  
  // Usar hook base server-first
  const {
    data: serverNotes,
    isLoading,
    isSyncing,
    error,
    create,
    update,
    remove,
    refresh
  } = useServerFirst<QuickNote>({
    tableName: 'quick_notes',
    realtime: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutos
    enableOfflineQueue: true
  });

  // Converter notas do servidor para formato local (compatibilidade)
  const localNotes = useMemo((): LocalNote[] => {
    return serverNotes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: new Date(note.created_at),
      isEditing: false,
      syncStatus: 'synced' as const,
      needsSync: false,
      flashcardId: note.flashcard_id
    }));
  }, [serverNotes]);

  // Estado local para compatibilidade (será removido gradualmente)
  const [localNotesState, setLocalNotesState] = useState<LocalNote[]>([]);

  // Sincronizar localNotesState com dados do servidor
  useEffect(() => {
    setLocalNotesState(localNotes);
  }, [localNotes]);

  // Status de sincronização simplificado
  const syncStatus = useMemo(() => ({
    pending: 0, // Com server-first, não há queue manual
    syncing: isSyncing,
    lastSync: new Date(),
    error: error
  }), [isSyncing, error]);

  // Salvar nota instantaneamente
  const saveNoteInstantly = useCallback(async (title: string, content: any[]) => {
    try {
      const noteData: QuickNoteInsert = {
      title,
      content,
        type: 'note'
      };

      const newNote = await create(noteData as any);
      
      if (newNote) {
        toast({
          title: 'Nota salva',
          description: 'Sua nota foi salva com sucesso!',
        });
      }

      return newNote;
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar nota',
        variant: 'destructive',
      });
      return null;
    }
  }, [create, toast]);

  // Editar nota existente
  const saveNoteEdit = useCallback(async (noteId: string, title: string, content: any[]) => {
    try {
      const updates: QuickNoteUpdate = {
      title,
      content,
        updated_at: new Date().toISOString()
      };

      const updatedNote = await update(noteId, updates as any);
      
      // Se a nota tem flashcard vinculado, atualizar o flashcard também
      if (updatedNote && updatedNote.flashcard_id) {
        try {
          // Usar Supabase diretamente para atualizar o flashcard
          const { supabase } = await import('@/integrations/supabase/client');
          
            const { error: flashcardError } = await supabase
              .from('flashcards')
              .update({
              title,
              front: content,
              back: content,
                updated_at: new Date().toISOString()
              })
            .eq('id', updatedNote.flashcard_id);

            if (flashcardError) {
            console.error('Erro ao atualizar flashcard vinculado:', flashcardError);
          }
        } catch (flashcardError) {
          console.error('Erro ao atualizar flashcard vinculado:', flashcardError);
          // Não mostrar erro para o usuário, pois a nota foi salva com sucesso
        }
      }
      
      if (updatedNote) {
      toast({
          title: 'Nota atualizada',
          description: 'Suas alterações foram salvas!',
        });
      }

      return updatedNote;
    } catch (error) {
      console.error('Erro ao editar nota:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar alterações',
        variant: 'destructive',
      });
      return null;
    }
  }, [update, toast]);

  // Deletar nota
  const deleteNote = useCallback(async (noteId: string) => {
    try {
      await remove(noteId);

      toast({
        title: 'Nota excluída',
        description: 'Nota excluída com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir nota',
        variant: 'destructive',
      });
    }
  }, [remove, toast]);

  // Marcar nota como convertida para flashcard
  const markNoteAsFlashcard = useCallback(async (noteId: string, flashcardId: string) => {
    try {
      const updates: QuickNoteUpdate = {
        flashcard_id: flashcardId,
        type: 'both' // Nota que também é flashcard
      };

      await update(noteId, updates as any);
      
      // Atualizar estado local imediatamente para UX responsiva
      setLocalNotesState(prev => prev.map(note => 
        note.id === noteId 
          ? { ...note, flashcardId, syncStatus: 'synced' as const }
          : note
      ));

    } catch (error) {
      console.error('Erro ao marcar nota como flashcard:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao vincular flashcard',
        variant: 'destructive',
      });
    }
  }, [update, toast]);

  // Buscar notas do servidor (compatibilidade)
  const fetchServerNotes = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Forçar sincronização (compatibilidade - não necessário com server-first)
  const forcSync = useCallback(async () => {
    await refresh();
    toast({
      title: 'Sincronização',
      description: 'Dados atualizados com sucesso!',
    });
  }, [refresh, toast]);

  return {
    // Dados
    localNotes: localNotesState, // Compatibilidade com NotesPage
    setLocalNotes: setLocalNotesState, // Compatibilidade
    serverNotes, // Dados do servidor
    
    // Status
    syncStatus,
    isLoading,
    
    // Ações
    saveNoteInstantly,
    saveNoteEdit,
    deleteNote,
    fetchServerNotes,
    forcSync,
    markNoteAsFlashcard,
  };
}
