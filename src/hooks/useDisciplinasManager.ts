import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Disciplina {
  id: string;
  nome: string;
  totalChapters: number;
  subject: string;
  topicos: Topico[];
}

export interface Topico {
  id: string;
  nome: string;
  date: string;
  totalAulas: number;
  subtopicos?: Subtopico[];
  lastAccess?: string;
  tempoInvestido?: string;
  estimated_duration_minutes?: number;
}

export interface Subtopico {
  id: string;
  nome: string;
  date: string;
  totalAulas: number;
  status: 'not-started' | 'in-progress' | 'completed';
  tempo: string;
  resumosVinculados: number;
  flashcardsVinculados: number;
  questoesVinculadas: number;
  lastAccess?: string;
  tempoInvestido?: string;
  estimated_duration_minutes?: number;
}

const getCurrentDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const useDisciplinasManager = (initialDisciplinas: Disciplina[] = []) => {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(initialDisciplinas);
  const [editingItem, setEditingItem] = useState<{
    type: 'unit' | 'topic' | 'subtopic';
    id: string;
    unitId?: string;
    topicId?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Load disciplinas from database
  const loadDisciplinasFromDatabase = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    try {
      // Load all data with a single optimized query using JOIN
      const { data: disciplinasData, error: disciplinasError } = await supabase
        .from('disciplinas')
        .select(`
          *,
          topicos (
            *,
            subtopicos (*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .order('created_at', { foreignTable: 'topicos', ascending: true })
        .order('created_at', { foreignTable: 'topicos.subtopicos', ascending: true });

      if (disciplinasError) {
        console.error('Error loading disciplinas from database:', disciplinasError);
        throw disciplinasError;
      }

      const disciplinas: Disciplina[] = (disciplinasData || []).map(disciplinaData => {
        const topicos: Topico[] = (disciplinaData.topicos || []).map((topicoData: any) => {
          const subtopicos: Subtopico[] = (topicoData.subtopicos || []).map((subtopico: any) => ({
            id: subtopico.id,
            nome: subtopico.nome,
            date: new Date(subtopico.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            totalAulas: subtopico.total_aulas || 0,
            status: subtopico.status || 'not-started',
            tempo: subtopico.tempo || '0min',
            resumosVinculados: subtopico.resumos_vinculados || 0,
            flashcardsVinculados: subtopico.flashcards_vinculados || 0,
            questoesVinculadas: subtopico.questoes_vinculadas || 0,
            lastAccess: subtopico.last_access,
            tempoInvestido: subtopico.tempo_investido,
            estimated_duration_minutes: subtopico.estimated_duration_minutes
          }));

          return {
            id: topicoData.id,
            nome: topicoData.nome,
            date: new Date(topicoData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            totalAulas: topicoData.total_aulas || 0,
            subtopicos,
            lastAccess: topicoData.last_access,
            tempoInvestido: topicoData.tempo_investido,
            estimated_duration_minutes: topicoData.estimated_duration_minutes
          };
        });

        return {
          id: disciplinaData.id,
          nome: disciplinaData.nome,
          totalChapters: disciplinaData.total_chapters || 0,
          subject: disciplinaData.subject || '',
          topicos
        };
      });

      setDisciplinas(disciplinas);
    } catch (error) {
      console.error('Error loading disciplinas from database:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Recalculate all topic durations (useful after loading or migration)
  const recalculateAllTopicDurations = useCallback(async () => {
    const updatesToMake: Array<{ topicId: string; duration: number }> = [];

    disciplinas.forEach(disciplina => {
      disciplina.topicos.forEach(topico => {
        if (topico.subtopicos && topico.subtopicos.length > 0) {
          const calculatedDuration = topico.subtopicos.reduce((sum, sub) => {
            return sum + (sub.estimated_duration_minutes || 90);
          }, 0);

          if (topico.estimated_duration_minutes !== calculatedDuration) {
            updatesToMake.push({ topicId: topico.id, duration: calculatedDuration });
          }
        }
      });
    });

    // Update all topics that need recalculation
    if (updatesToMake.length > 0) {
      console.log('🔄 Recalculando tempos de', updatesToMake.length, 'tópicos...');

      for (const update of updatesToMake) {
        await supabase
          .from('topicos')
          .update({ estimated_duration_minutes: update.duration })
          .eq('id', update.topicId);
      }

      // Reload data after updates
      await loadDisciplinasFromDatabase();
    }
  }, [disciplinas, loadDisciplinasFromDatabase]);

  // Load data on mount or when user changes
  useEffect(() => {
    if (user) {
      loadDisciplinasFromDatabase();
    } else {
      setDisciplinas([]);
    }
  }, [user]);

  // Recalculate all topic durations after initial load
  useEffect(() => {
    if (disciplinas.length > 0 && user) {
      recalculateAllTopicDurations();
    }
  }, [disciplinas.length, user]);

  // Disciplina operations
  const addDisciplina = useCallback(async (nome: string, subject: string = 'Biologia e Bioquímica') => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      // First, save the disciplina to the database
      const { data: disciplinaData, error: disciplinaError } = await supabase
        .from('disciplinas')
        .insert({
          nome: nome,
          subject: subject,
          total_chapters: 0,
          user_id: user.id
        })
        .select()
        .single();

      if (disciplinaError) {
        console.error('Error creating disciplina in database:', disciplinaError);
        return null;
      }

      // Then update the local state with the database-generated ID
      const newDisciplina: Disciplina = {
        id: disciplinaData.id,
        nome,
        totalChapters: 0,
        subject,
        topicos: []
      };
      setDisciplinas(prev => [...prev, newDisciplina]);
      return disciplinaData.id;
    } catch (error) {
      console.error('Error in addDisciplina:', error);
      return null;
    }
  }, [user]);

  const updateDisciplina = useCallback(async (disciplinaId: string, updates: Partial<Disciplina>) => {
    try {
      // Update in database
      const { error } = await supabase
        .from('disciplinas')
        .update({
          nome: updates.nome,
          total_chapters: updates.totalChapters,
          subject: updates.subject
        })
        .eq('id', disciplinaId);

      if (error) {
        console.error('Error updating disciplina in database:', error);
        return;
      }

      // Update local state
      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId ? { ...disciplina, ...updates } : disciplina
      ));
    } catch (error) {
      console.error('Error in updateDisciplina:', error);
    }
  }, []);

  const deleteDisciplina = useCallback(async (disciplinaId: string) => {
    try {
      // Delete from database (cascade will handle topicos and subtopicos)
      const { error } = await supabase
        .from('disciplinas')
        .delete()
        .eq('id', disciplinaId);

      if (error) {
        console.error('Error deleting disciplina from database:', error);
        return;
      }

      // Update local state
      setDisciplinas(prev => prev.filter(disciplina => disciplina.id !== disciplinaId));
    } catch (error) {
      console.error('Error in deleteDisciplina:', error);
    }
  }, []);

  // Topico operations
  const addTopico = useCallback(async (disciplinaId: string, nome: string, estimatedDurationMinutes: number = 120) => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      // First, save the topico to the database
      const { data: topicoData, error: topicoError } = await supabase
        .from('topicos')
        .insert({
          disciplina_id: disciplinaId,
          nome: nome,
          total_aulas: 0,
          estimated_duration_minutes: estimatedDurationMinutes,
          user_id: user.id
        })
        .select()
        .single();

      if (topicoError) {
        console.error('Error creating topico in database:', topicoError);
        return null;
      }

      // Then update the local state with the database-generated ID
      const newTopico: Topico = {
        id: topicoData.id,
        nome,
        date: getCurrentDate(),
        totalAulas: 0,
        subtopicos: [],
        estimated_duration_minutes: estimatedDurationMinutes
      };

      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId
          ? { ...disciplina, topicos: [...disciplina.topicos, newTopico] }
          : disciplina
      ));
      return topicoData.id;
    } catch (error) {
      console.error('Error in addTopico:', error);
      return null;
    }
  }, [user]);

  const updateTopico = useCallback(async (disciplinaId: string, topicoId: string, updates: Partial<Topico>) => {
    try {
      // Update in database
      const dbUpdates: any = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.totalAulas !== undefined) dbUpdates.total_aulas = updates.totalAulas;
      if (updates.estimated_duration_minutes !== undefined) dbUpdates.estimated_duration_minutes = updates.estimated_duration_minutes;

      const { error } = await supabase
        .from('topicos')
        .update(dbUpdates)
        .eq('id', topicoId);

      if (error) {
        console.error('Error updating topico in database:', error);
        return;
      }

      // Update local state
      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId
          ? {
              ...disciplina,
              topicos: disciplina.topicos.map(topico =>
                topico.id === topicoId ? { ...topico, ...updates } : topico
              )
            }
          : disciplina
      ));
    } catch (error) {
      console.error('Error in updateTopico:', error);
    }
  }, []);

  const deleteTopico = useCallback(async (disciplinaId: string, topicoId: string) => {
    try {
      // Delete from database (cascade will handle subtopicos)
      const { error } = await supabase
        .from('topicos')
        .delete()
        .eq('id', topicoId);

      if (error) {
        console.error('Error deleting topico from database:', error);
        return;
      }

      // Update local state
      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId
          ? { ...disciplina, topicos: disciplina.topicos.filter(topico => topico.id !== topicoId) }
          : disciplina
      ));
    } catch (error) {
      console.error('Error in deleteTopico:', error);
    }
  }, []);

  // Subtopico operations
  const addSubtopico = useCallback(async (disciplinaId: string, topicoId: string, nome: string, estimatedDurationMinutes: number = 90) => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      // First, save the subtopico to the database
      const { data: subtopicData, error: subtopicError } = await supabase
        .from('subtopicos')
        .insert({
          topico_id: topicoId,
          nome: nome,
          status: 'not-started',
          total_aulas: 0,
          tempo: '0min',
          resumos_vinculados: 0,
          flashcards_vinculados: 0,
          questoes_vinculadas: 0,
          estimated_duration_minutes: estimatedDurationMinutes,
          user_id: user.id
        })
        .select()
        .single();

      if (subtopicError) {
        console.error('Error creating subtopico in database:', subtopicError);
        return null;
      }

      // Then update the local state with the database-generated ID
      const newSubtopico: Subtopico = {
        id: subtopicData.id,
        nome,
        date: getCurrentDate(),
        totalAulas: 0,
        status: 'not-started',
        tempo: '0min',
        resumosVinculados: 0,
        flashcardsVinculados: 0,
        questoesVinculadas: 0,
        estimated_duration_minutes: estimatedDurationMinutes
      };

      // Update local state
      let calculatedTopicDuration: number | undefined;
      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId
          ? {
              ...disciplina,
              topicos: disciplina.topicos.map(topico => {
                if (topico.id === topicoId) {
                  const updatedSubtopicos = [...(topico.subtopicos || []), newSubtopico];

                  // Calculate total duration from all subtopicos (including the new one)
                  calculatedTopicDuration = updatedSubtopicos.reduce((sum, sub) => {
                    return sum + (sub.estimated_duration_minutes || 90);
                  }, 0);

                  return {
                    ...topico,
                    subtopicos: updatedSubtopicos,
                    estimated_duration_minutes: calculatedTopicDuration
                  };
                }
                return topico;
              })
            }
          : disciplina
      ));

      // Update topico duration in database if subtopicos exist
      if (calculatedTopicDuration !== undefined) {
        await supabase
          .from('topicos')
          .update({ estimated_duration_minutes: calculatedTopicDuration })
          .eq('id', topicoId);
      }

      return subtopicData.id;
    } catch (error) {
      console.error('Error in addSubtopico:', error);
      return null;
    }
  }, [user]);

  const updateSubtopico = useCallback(async (disciplinaId: string, topicoId: string, subtopicId: string, updates: Partial<Subtopico>) => {
    try {
      // Update in database
      const dbUpdates: any = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.totalAulas !== undefined) dbUpdates.total_aulas = updates.totalAulas;
      if (updates.tempo !== undefined) dbUpdates.tempo = updates.tempo;
      if (updates.resumosVinculados !== undefined) dbUpdates.resumos_vinculados = updates.resumosVinculados;
      if (updates.flashcardsVinculados !== undefined) dbUpdates.flashcards_vinculados = updates.flashcardsVinculados;
      if (updates.questoesVinculadas !== undefined) dbUpdates.questoes_vinculadas = updates.questoesVinculadas;
      if (updates.estimated_duration_minutes !== undefined) dbUpdates.estimated_duration_minutes = updates.estimated_duration_minutes;

      const { error } = await supabase
        .from('subtopicos')
        .update(dbUpdates)
        .eq('id', subtopicId);

      if (error) {
        console.error('Error updating subtopico in database:', error);
        return;
      }

      // Update local state and recalculate parent topico duration if duration changed
      let calculatedTopicDuration: number | undefined;
      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId
          ? {
              ...disciplina,
              topicos: disciplina.topicos.map(topico => {
                if (topico.id === topicoId) {
                  const updatedSubtopicos = topico.subtopicos?.map(subtopico =>
                    subtopico.id === subtopicId ? { ...subtopico, ...updates } : subtopico
                  );

                  // If duration was updated, recalculate topico duration
                  if (updates.estimated_duration_minutes !== undefined && updatedSubtopicos && updatedSubtopicos.length > 0) {
                    calculatedTopicDuration = updatedSubtopicos.reduce((sum, sub) => {
                      return sum + (sub.estimated_duration_minutes || 90);
                    }, 0);

                    return {
                      ...topico,
                      subtopicos: updatedSubtopicos,
                      estimated_duration_minutes: calculatedTopicDuration
                    };
                  }

                  return {
                    ...topico,
                    subtopicos: updatedSubtopicos
                  };
                }
                return topico;
              })
            }
          : disciplina
      ));

      // Update topico duration in database if it was recalculated
      if (calculatedTopicDuration !== undefined) {
        await supabase
          .from('topicos')
          .update({ estimated_duration_minutes: calculatedTopicDuration })
          .eq('id', topicoId);
      }
    } catch (error) {
      console.error('Error in updateSubtopico:', error);
    }
  }, []);

  const deleteSubtopico = useCallback(async (disciplinaId: string, topicoId: string, subtopicId: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('subtopicos')
        .delete()
        .eq('id', subtopicId);

      if (error) {
        console.error('Error deleting subtopico from database:', error);
        return;
      }

      // Update local state and recalculate topico duration
      let calculatedTopicDuration: number | undefined;
      setDisciplinas(prev => prev.map(disciplina =>
        disciplina.id === disciplinaId
          ? {
              ...disciplina,
              topicos: disciplina.topicos.map(topico => {
                if (topico.id === topicoId) {
                  const updatedSubtopicos = topico.subtopicos?.filter(subtopico => subtopico.id !== subtopicId);

                  // If there are still subtopicos remaining, recalculate duration
                  if (updatedSubtopicos && updatedSubtopicos.length > 0) {
                    calculatedTopicDuration = updatedSubtopicos.reduce((sum, sub) => {
                      return sum + (sub.estimated_duration_minutes || 90);
                    }, 0);

                    return {
                      ...topico,
                      subtopicos: updatedSubtopicos,
                      estimated_duration_minutes: calculatedTopicDuration
                    };
                  }

                  // No subtopicos left, return to manual duration (default 120)
                  return {
                    ...topico,
                    subtopicos: updatedSubtopicos,
                    estimated_duration_minutes: 120
                  };
                }
                return topico;
              })
            }
          : disciplina
      ));

      // Update topico duration in database
      if (calculatedTopicDuration !== undefined) {
        await supabase
          .from('topicos')
          .update({ estimated_duration_minutes: calculatedTopicDuration })
          .eq('id', topicoId);
      } else {
        // Reset to manual duration default when no subtopicos left
        await supabase
          .from('topicos')
          .update({ estimated_duration_minutes: 120 })
          .eq('id', topicoId);
      }
    } catch (error) {
      console.error('Error in deleteSubtopico:', error);
    }
  }, []);

  // Editing state management
  const startEditing = useCallback((type: 'unit' | 'topic' | 'subtopic', id: string, unitId?: string, topicId?: string) => {
    setEditingItem({ type, id, unitId, topicId });
  }, []);

  const stopEditing = useCallback(() => {
    setEditingItem(null);
  }, []);

  const isEditing = useCallback((type: 'unit' | 'topic' | 'subtopic', id: string) => {
    return editingItem?.type === type && editingItem?.id === id;
  }, [editingItem]);

  // Update last access for topicos and subtopicos
  const updateLastAccess = useCallback(async (type: 'topic' | 'subtopic', id: string) => {
    try {
      const table = type === 'topic' ? 'topicos' : 'subtopicos';
      const { error } = await supabase
        .from(table)
        .update({ last_access: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error(`Error updating last_access for ${type}:`, error);
        return;
      }

      // Update local state
      setDisciplinas(prev => prev.map(disciplina => ({
        ...disciplina,
        topicos: disciplina.topicos.map(topico => {
          if (type === 'topic' && topico.id === id) {
            return { ...topico, lastAccess: new Date().toISOString() };
          }
          return {
            ...topico,
            subtopicos: topico.subtopicos?.map(subtopico =>
              type === 'subtopic' && subtopico.id === id
                ? { ...subtopico, lastAccess: new Date().toISOString() }
                : subtopico
            )
          };
        })
      })));
    } catch (error) {
      console.error(`Error in updateLastAccess for ${type}:`, error);
    }
  }, []);

  // Helper function to calculate total duration from subtopicos
  const calculateTopicDuration = useCallback((topico: Topico): number => {
    if (!topico.subtopicos || topico.subtopicos.length === 0) {
      // No subtopicos, return manual duration or default
      return topico.estimated_duration_minutes || 120;
    }

    // Has subtopicos, sum their durations
    return topico.subtopicos.reduce((sum, subtopico) => {
      return sum + (subtopico.estimated_duration_minutes || 90);
    }, 0);
  }, []);

  // Helper function to recalculate and update topico duration based on subtopicos
  const recalculateTopicDuration = useCallback(async (disciplinaId: string, topicoId: string) => {
    const disciplina = disciplinas.find(d => d.id === disciplinaId);
    if (!disciplina) return;

    const topico = disciplina.topicos.find(t => t.id === topicoId);
    if (!topico) return;

    // Only recalculate if topico has subtopicos
    if (topico.subtopicos && topico.subtopicos.length > 0) {
      const calculatedDuration = calculateTopicDuration(topico);

      // Update in database
      const { error } = await supabase
        .from('topicos')
        .update({ estimated_duration_minutes: calculatedDuration })
        .eq('id', topicoId);

      if (error) {
        console.error('Error updating topico duration:', error);
        return;
      }

      // Update local state
      setDisciplinas(prev => prev.map(d =>
        d.id === disciplinaId
          ? {
              ...d,
              topicos: d.topicos.map(t =>
                t.id === topicoId
                  ? { ...t, estimated_duration_minutes: calculatedDuration }
                  : t
              )
            }
          : d
      ));
    }
  }, [disciplinas, calculateTopicDuration]);

  return {
    disciplinas,
    setDisciplinas,
    isLoading,
    loadDisciplinasFromDatabase,

    // Disciplina operations
    addDisciplina,
    updateDisciplina,
    deleteDisciplina,

    // Topico operations
    addTopico,
    updateTopico,
    deleteTopico,

    // Subtopico operations
    addSubtopico,
    updateSubtopico,
    deleteSubtopico,

    // Editing state
    editingItem,
    startEditing,
    stopEditing,
    isEditing,

    // Last access tracking
    updateLastAccess,

    // Duration helpers
    calculateTopicDuration,
    recalculateTopicDuration
  };
};
