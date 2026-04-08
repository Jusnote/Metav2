import { useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Note, CreateNoteRequest, UpdateNoteRequest, UseNotesReturn } from '../types/notes';
import { useToast } from './use-toast';

export const useNotes = (): UseNotesReturn => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchNotes = useCallback(async (subtopicoId?: string | null, topicoId?: string | null) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (subtopicoId) {
        query = query.eq('subtopico_id', subtopicoId);
      } else if (topicoId) {
        query = query.eq('topico_id', topicoId);
      } else {
        throw new Error('É necessário fornecer subtopicoId ou topicoId');
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotes((data as unknown as Note[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar anotações';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchNotesByTopic = useCallback(async (topicoId: string) => {
    await fetchNotes(null, topicoId);
  }, [fetchNotes]);

  const fetchNotesBySubtopic = useCallback(async (subtopicoId: string) => {
    await fetchNotes(subtopicoId, null);
  }, [fetchNotes]);

  const createNote = useCallback(async (data: CreateNoteRequest): Promise<Note | null> => {
    setError(null);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      if (!data.subtopico_id && !data.topico_id) {
        throw new Error('É necessário fornecer subtopico_id ou topico_id');
      }

      const { data: newNote, error } = await supabase
        .from('notes')
        .insert({
          subtopico_id: data.subtopico_id || null,
          topico_id: data.topico_id || null,
          title: data.title || 'Nova Anotação',
          content: data.content,
          user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [newNote as unknown as Note, ...prev]);

      toast({
        title: 'Sucesso',
        description: 'Anotação criada com sucesso!',
      });

      return newNote as unknown as Note;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar anotação';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const updateNote = useCallback(async (data: UpdateNoteRequest): Promise<Note | null> => {
    setError(null);
    
    try {
      const { data: updatedNote, error } = await supabase
        .from('notes')
        .update({
          content: data.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => prev.map(note =>
        note.id === data.id ? updatedNote as unknown as Note : note
      ));

      toast({
        title: 'Sucesso',
        description: 'Anotação atualizada com sucesso!',
      });

      return updatedNote as unknown as Note;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar anotação';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setNotes(prev => prev.filter(note => note.id !== id));
      
      toast({
        title: 'Sucesso',
        description: 'Anotação excluída com sucesso!',
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir anotação';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const clearNotes = useCallback(() => {
    setNotes([]);
    setError(null);
  }, []);

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    fetchNotes,
    fetchNotesByTopic,
    fetchNotesBySubtopic,
    clearNotes,
  };
};