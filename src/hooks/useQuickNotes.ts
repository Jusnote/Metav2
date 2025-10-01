import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface QuickNote {
  id: string;
  user_id: string;
  title: string;
  content: any[]; // BlockNote JSON structure
  created_at: string;
  updated_at: string;
}

interface QueueItem {
  id: string;
  title: string;
  content: any[];
  timestamp: number;
  retries: number;
  isUpdate: boolean; // true para UPDATE, false para INSERT
  flashcardId?: string;
}

interface SyncStatus {
  pending: number;
  syncing: boolean;
  lastSync?: Date;
  error?: string;
}

const STORAGE_KEY = 'quick_notes_local';
const QUEUE_KEY = 'quick_notes_queue';
const DEBOUNCE_DELAY = 2500; // 2.5 segundos
const MAX_RETRIES = 3;

export function useQuickNotes() {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [localNotes, setLocalNotes] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ pending: 0, syncing: false });
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const queueRef = useRef<QueueItem[]>([]);

  // Carregar notas locais na inicialização
  useEffect(() => {
    loadLocalNotes();
    loadQueue();
    // Processar queue pendente na inicialização
    processQueue();
  }, []);

  // Salvar notas locais sempre que mudarem
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localNotes));
  }, [localNotes]);

  // Salvar queue sempre que mudar
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queueRef.current));
    setSyncStatus(prev => ({ 
      ...prev, 
      pending: queueRef.current.length 
    }));
  }, [queueRef.current]);

  const loadLocalNotes = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Converter strings de data para objetos Date
        const notesWithDates = parsed.map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt)
        }));
        setLocalNotes(notesWithDates);
      }
    } catch (error) {
      console.error('Erro ao carregar notas locais:', error);
    }
  };

  const loadQueue = () => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        queueRef.current = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Erro ao carregar queue:', error);
    }
  };

  // Salvamento instantâneo local + adição à queue
  const saveNoteInstantly = useCallback((title: string, content: any[], flashcardId?: string) => {
    const noteId = crypto.randomUUID();
    const newLocalNote = {
      id: noteId,
      title,
      content,
      createdAt: new Date(),
      isEditing: false,
      syncStatus: 'pending' as const,
      needsSync: true,
      flashcardId
    };

    // Salvar instantaneamente no localStorage
    setLocalNotes(prev => [newLocalNote, ...prev]);

    // Adicionar à queue para sincronização (INSERT)
    addToQueue(noteId, title, content, false, flashcardId);
    
    return noteId;
  }, []);

  // Função para salvar edições de notas
  const saveNoteEdit = useCallback((noteId: string, title: string, content: any[]) => {
    // Encontrar a nota atual para preservar o flashcardId
    const currentNote = localNotes.find(note => note.id === noteId);
    const flashcardId = currentNote?.flashcardId;

    // Atualizar nota local
    setLocalNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, title, content, syncStatus: 'pending' as const, needsSync: true }
        : note
    ));

    // Adicionar à queue para sincronização (UPDATE)
    addToQueue(noteId, title, content, true, flashcardId);
  }, [localNotes]);

  const addToQueue = (id: string, title: string, content: any[], isUpdate: boolean, flashcardId?: string) => {
    // Remover item existente da queue se for update
    if (isUpdate) {
      queueRef.current = queueRef.current.filter(item => item.id !== id);
    }

    const queueItem: QueueItem = {
      id,
      title,
      content,
      timestamp: Date.now(),
      retries: 0,
      isUpdate,
      flashcardId
    };

    queueRef.current.push(queueItem);
    
    // Resetar debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Iniciar novo timer de debounce
    debounceTimerRef.current = setTimeout(() => {
      processQueue();
    }, DEBOUNCE_DELAY);
  };

  const processQueue = async () => {
    if (queueRef.current.length === 0 || syncStatus.syncing) return;

    setSyncStatus(prev => ({ ...prev, syncing: true, error: undefined }));

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('Usuário não autenticado');
      }

      // Separar inserções de atualizações
      const batch = [...queueRef.current];
      const insertItems = batch.filter(item => !item.isUpdate);
      const updateItems = batch.filter(item => item.isUpdate);

      // Processar inserções
      if (insertItems.length > 0) {
        const insertData = insertItems.map(item => ({
          id: item.id,
          user_id: user.user.id,
          title: item.title,
          content: item.content,
          flashcard_id: item.flashcardId
        }));

        const { error: insertError } = await supabase
          .from('quick_notes')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      // Processar atualizações (uma por vez)
      for (const item of updateItems) {
        const { error: updateError } = await supabase
          .from('quick_notes')
          .update({
            title: item.title,
            content: item.content,
            updated_at: new Date().toISOString(),
            flashcard_id: item.flashcardId
          })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Se a nota tem flashcard vinculado, sincronizar também
        if (item.flashcardId) {
          try {
            const { error: flashcardError } = await supabase
              .from('flashcards')
              .update({
                title: item.title,
                front: item.content,
                back: item.content,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.flashcardId);

            if (flashcardError) {
              console.error('Erro ao sincronizar flashcard:', flashcardError);
              // Não falhar a operação toda por causa do flashcard
            }
          } catch (flashcardSyncError) {
            console.error('Erro na sincronização do flashcard:', flashcardSyncError);
          }
        }
      }

      // Sucesso - limpar queue e atualizar status local
      queueRef.current = [];
      
      // Atualizar status das notas locais
      setLocalNotes(prev => prev.map(note => 
        batch.find(item => item.id === note.id) 
          ? { ...note, syncStatus: 'synced' as const, needsSync: false }
          : note
      ));

      setSyncStatus({
        pending: 0,
        syncing: false,
        lastSync: new Date()
      });

      toast({
        title: 'Sincronizado',
        description: `${batch.length} nota(s) salva(s) com sucesso!`,
      });

    } catch (error) {
      console.error('Erro ao processar queue:', error);
      
      // Implementar retry com backoff exponencial
      const failedItems = queueRef.current.map(item => ({
        ...item,
        retries: item.retries + 1
      }));

      // Manter apenas itens que não excederam max retries
      queueRef.current = failedItems.filter(item => item.retries <= MAX_RETRIES);

      const errorMessage = error instanceof Error ? error.message : 'Erro de sincronização';
      
      setSyncStatus({
        pending: queueRef.current.length,
        syncing: false,
        error: errorMessage
      });

      // Retry automático com delay exponencial
      if (queueRef.current.length > 0) {
        const retryDelay = Math.min(DEBOUNCE_DELAY * Math.pow(2, failedItems[0]?.retries || 1), 30000);
        setTimeout(() => processQueue(), retryDelay);
      }
    }
  };

  // Buscar notas do servidor
  const fetchServerNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Erro ao buscar notas do servidor:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar notas do servidor',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Forçar sincronização manual
  const forcSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    processQueue();
  }, []);

  // Deletar nota
  const deleteNote = useCallback(async (noteId: string) => {
    try {
      // Encontrar a nota para verificar se tem flashcard vinculado
      const noteToDelete = localNotes.find(note => note.id === noteId);
      const flashcardId = noteToDelete?.flashcardId;

      // Remover do localStorage imediatamente
      setLocalNotes(prev => prev.filter(note => note.id !== noteId));
      
      // Remover da queue se existir
      queueRef.current = queueRef.current.filter(item => item.id !== noteId);
      
      // Deletar do servidor se já foi sincronizada
      const { error } = await supabase
        .from('quick_notes')
        .delete()
        .eq('id', noteId);

      if (error && error.code !== 'PGRST116') { // Ignorar "not found"
        throw error;
      }

      // Se a nota tinha flashcard vinculado, deletar também (cascata)
      if (flashcardId) {
        try {
          const { error: flashcardError } = await supabase
            .from('flashcards')
            .delete()
            .eq('id', flashcardId);

          if (flashcardError && flashcardError.code !== 'PGRST116') {
            console.error('Erro ao deletar flashcard vinculado:', flashcardError);
          }
        } catch (flashcardDeleteError) {
          console.error('Erro na deleção do flashcard:', flashcardDeleteError);
        }
      }

      toast({
        title: 'Sucesso',
        description: flashcardId 
          ? 'Nota e flashcard vinculado excluídos com sucesso!' 
          : 'Nota excluída com sucesso!',
      });

    } catch (error) {
      console.error('Erro ao deletar nota:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir nota',
        variant: 'destructive',
      });
    }
  }, [localNotes, toast]);

  return {
    // Notas locais (para exibição imediata)
    localNotes,
    setLocalNotes,
    // Notas do servidor (para backup/histórico)
    serverNotes: notes,
    // Status de sincronização
    syncStatus,
    isLoading,
    // Ações
    saveNoteInstantly,
    saveNoteEdit,
    deleteNote,
    fetchServerNotes,
    forcSync,
  };
}