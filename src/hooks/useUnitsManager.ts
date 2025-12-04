import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Unit {
  id: string;
  title: string;
  totalChapters: number;
  subject: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  title: string;
  date: string;
  totalAulas: number;
  subtopics?: Subtopic[];
  lastAccess?: string;
  tempoInvestido?: string;
  estimated_duration_minutes?: number;
}

export interface Subtopic {
  id: string;
  title: string;
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

export const useUnitsManager = (initialUnits: Unit[] = []) => {
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [editingItem, setEditingItem] = useState<{
    type: 'unit' | 'topic' | 'subtopic';
    id: string;
    unitId?: string;
    topicId?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Load units from database
  const loadUnitsFromDatabase = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    try {
      // Load all data with a single optimized query using JOIN
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select(`
          *,
          topics (
            *,
            subtopics (*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .order('created_at', { foreignTable: 'topics', ascending: true })
        .order('created_at', { foreignTable: 'topics.subtopics', ascending: true });

      if (unitsError) {
        console.error('Error loading units from database:', unitsError);
        throw unitsError;
      }

      const units: Unit[] = (unitsData || []).map(unitData => {
        const topics: Topic[] = (unitData.topics || []).map((topicData: any) => {
          const subtopics: Subtopic[] = (topicData.subtopics || []).map((subtopic: any) => ({
            id: subtopic.id,
            title: subtopic.title,
            date: new Date(subtopic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            totalAulas: subtopic.total_aulas || 0,
            status: subtopic.status || 'not-started',
            tempo: subtopic.tempo || '0min',
            resumosVinculados: subtopic.resumos_vinculados || 0,
            flashcardsVinculados: subtopic.flashcards_vinculados || 0,
            questoesVinculadas: subtopic.questoes_vinculadas || 0,
            lastAccess: subtopic.last_access,
            tempoInvestido: subtopic.tempo_investido,
            estimated_duration_minutes: subtopic.estimated_duration_minutes
          }));

          return {
            id: topicData.id,
            title: topicData.title,
            date: new Date(topicData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            totalAulas: topicData.total_aulas || 0,
            subtopics,
            lastAccess: topicData.last_access,
            tempoInvestido: topicData.tempo_investido,
            estimated_duration_minutes: topicData.estimated_duration_minutes
          };
        });

        return {
          id: unitData.id,
          title: unitData.title,
          totalChapters: unitData.total_chapters || 0,
          subject: unitData.subject || '',
          topics
        };
      });

      setUnits(units);
    } catch (error) {
      console.error('Error loading units from database:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Recalculate all topic durations (useful after loading or migration)
  const recalculateAllTopicDurations = useCallback(async () => {
    const updatesToMake: Array<{ topicId: string; duration: number }> = [];

    units.forEach(unit => {
      unit.topics.forEach(topic => {
        if (topic.subtopics && topic.subtopics.length > 0) {
          const calculatedDuration = topic.subtopics.reduce((sum, sub) => {
            return sum + (sub.estimated_duration_minutes || 90);
          }, 0);

          if (topic.estimated_duration_minutes !== calculatedDuration) {
            updatesToMake.push({ topicId: topic.id, duration: calculatedDuration });
          }
        }
      });
    });

    // Update all topics that need recalculation
    if (updatesToMake.length > 0) {
      console.log('🔄 Recalculando tempos de', updatesToMake.length, 'tópicos...');

      for (const update of updatesToMake) {
        await supabase
          .from('topics')
          .update({ estimated_duration_minutes: update.duration })
          .eq('id', update.topicId);
      }

      // Reload data after updates
      await loadUnitsFromDatabase();
    }
  }, [units, loadUnitsFromDatabase]);

  // Load data on mount or when user changes
  useEffect(() => {
    if (user) {
      loadUnitsFromDatabase();
    } else {
      setUnits([]);
    }
  }, [user]);

  // Recalculate all topic durations after initial load
  useEffect(() => {
    if (units.length > 0 && user) {
      recalculateAllTopicDurations();
    }
  }, [units.length, user]);

  // Unit operations
  const addUnit = useCallback(async (title: string, subject: string = 'Biologia e Bioquímica') => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      // First, save the unit to the database
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .insert({
          title: title,
          subject: subject,
          total_chapters: 0,
          user_id: user.id
        })
        .select()
        .single();

      if (unitError) {
        console.error('Error creating unit in database:', unitError);
        return null;
      }

      // Then update the local state with the database-generated ID
      const newUnit: Unit = {
        id: unitData.id,
        title,
        totalChapters: 0,
        subject,
        topics: []
      };
      setUnits(prev => [...prev, newUnit]);
      return unitData.id;
    } catch (error) {
      console.error('Error in addUnit:', error);
      return null;
    }
  }, [user]);

  const updateUnit = useCallback(async (unitId: string, updates: Partial<Unit>) => {
    try {
      // Update in database
      const { error } = await supabase
        .from('units')
        .update({
          title: updates.title,
          total_chapters: updates.totalChapters,
          subject: updates.subject
        })
        .eq('id', unitId);

      if (error) {
        console.error('Error updating unit in database:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.map(unit => 
        unit.id === unitId ? { ...unit, ...updates } : unit
      ));
    } catch (error) {
      console.error('Error in updateUnit:', error);
    }
  }, []);

  const deleteUnit = useCallback(async (unitId: string) => {
    try {
      // Delete from database (cascade will handle topics and subtopics)
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId);

      if (error) {
        console.error('Error deleting unit from database:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.filter(unit => unit.id !== unitId));
    } catch (error) {
      console.error('Error in deleteUnit:', error);
    }
  }, []);

  // Topic operations
  const addTopic = useCallback(async (unitId: string, title: string, estimatedDurationMinutes: number = 120) => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      // First, save the topic to the database
      const { data: topicData, error: topicError } = await supabase
        .from('topics')
        .insert({
          unit_id: unitId,
          title: title,
          total_aulas: 0,
          estimated_duration_minutes: estimatedDurationMinutes,
          user_id: user.id
        })
        .select()
        .single();

      if (topicError) {
        console.error('Error creating topic in database:', topicError);
        return null;
      }

      // Then update the local state with the database-generated ID
      const newTopic: Topic = {
        id: topicData.id,
        title,
        date: getCurrentDate(),
        totalAulas: 0,
        subtopics: [],
        estimated_duration_minutes: estimatedDurationMinutes
      };

      setUnits(prev => prev.map(unit =>
        unit.id === unitId
          ? { ...unit, topics: [...unit.topics, newTopic] }
          : unit
      ));
      return topicData.id;
    } catch (error) {
      console.error('Error in addTopic:', error);
      return null;
    }
  }, [user]);

  const updateTopic = useCallback(async (unitId: string, topicId: string, updates: Partial<Topic>) => {
    try {
      // Update in database
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.totalAulas !== undefined) dbUpdates.total_aulas = updates.totalAulas;
      if (updates.estimated_duration_minutes !== undefined) dbUpdates.estimated_duration_minutes = updates.estimated_duration_minutes;

      const { error } = await supabase
        .from('topics')
        .update(dbUpdates)
        .eq('id', topicId);

      if (error) {
        console.error('Error updating topic in database:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.map(unit =>
        unit.id === unitId
          ? {
              ...unit,
              topics: unit.topics.map(topic =>
                topic.id === topicId ? { ...topic, ...updates } : topic
              )
            }
          : unit
      ));
    } catch (error) {
      console.error('Error in updateTopic:', error);
    }
  }, []);

  const deleteTopic = useCallback(async (unitId: string, topicId: string) => {
    try {
      // Delete from database (cascade will handle subtopics)
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId);

      if (error) {
        console.error('Error deleting topic from database:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.map(unit => 
        unit.id === unitId 
          ? { ...unit, topics: unit.topics.filter(topic => topic.id !== topicId) }
          : unit
      ));
    } catch (error) {
      console.error('Error in deleteTopic:', error);
    }
  }, []);

  // Subtopic operations
  const addSubtopic = useCallback(async (unitId: string, topicId: string, title: string, estimatedDurationMinutes: number = 90) => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    try {
      // First, save the subtopic to the database
      const { data: subtopicData, error: subtopicError } = await supabase
        .from('subtopics')
        .insert({
          topic_id: topicId,
          title: title,
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
        console.error('Error creating subtopic in database:', subtopicError);
        return null;
      }

      // Then update the local state with the database-generated ID
      const newSubtopic: Subtopic = {
        id: subtopicData.id,
        title,
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
      setUnits(prev => prev.map(unit =>
        unit.id === unitId
          ? {
              ...unit,
              topics: unit.topics.map(topic => {
                if (topic.id === topicId) {
                  const updatedSubtopics = [...(topic.subtopics || []), newSubtopic];

                  // Calculate total duration from all subtopics (including the new one)
                  calculatedTopicDuration = updatedSubtopics.reduce((sum, sub) => {
                    return sum + (sub.estimated_duration_minutes || 90);
                  }, 0);

                  return {
                    ...topic,
                    subtopics: updatedSubtopics,
                    estimated_duration_minutes: calculatedTopicDuration
                  };
                }
                return topic;
              })
            }
          : unit
      ));

      // Update topic duration in database if subtopics exist
      if (calculatedTopicDuration !== undefined) {
        await supabase
          .from('topics')
          .update({ estimated_duration_minutes: calculatedTopicDuration })
          .eq('id', topicId);
      }

      return subtopicData.id;
    } catch (error) {
      console.error('Error in addSubtopic:', error);
      return null;
    }
  }, [user]);

  const updateSubtopic = useCallback(async (unitId: string, topicId: string, subtopicId: string, updates: Partial<Subtopic>) => {
    try {
      // Update in database
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.totalAulas !== undefined) dbUpdates.total_aulas = updates.totalAulas;
      if (updates.tempo !== undefined) dbUpdates.tempo = updates.tempo;
      if (updates.resumosVinculados !== undefined) dbUpdates.resumos_vinculados = updates.resumosVinculados;
      if (updates.flashcardsVinculados !== undefined) dbUpdates.flashcards_vinculados = updates.flashcardsVinculados;
      if (updates.questoesVinculadas !== undefined) dbUpdates.questoes_vinculadas = updates.questoesVinculadas;
      if (updates.estimated_duration_minutes !== undefined) dbUpdates.estimated_duration_minutes = updates.estimated_duration_minutes;

      const { error } = await supabase
        .from('subtopics')
        .update(dbUpdates)
        .eq('id', subtopicId);

      if (error) {
        console.error('Error updating subtopic in database:', error);
        return;
      }

      // Update local state and recalculate parent topic duration if duration changed
      let calculatedTopicDuration: number | undefined;
      setUnits(prev => prev.map(unit =>
        unit.id === unitId
          ? {
              ...unit,
              topics: unit.topics.map(topic => {
                if (topic.id === topicId) {
                  const updatedSubtopics = topic.subtopics?.map(subtopic =>
                    subtopic.id === subtopicId ? { ...subtopic, ...updates } : subtopic
                  );

                  // If duration was updated, recalculate topic duration
                  if (updates.estimated_duration_minutes !== undefined && updatedSubtopics && updatedSubtopics.length > 0) {
                    calculatedTopicDuration = updatedSubtopics.reduce((sum, sub) => {
                      return sum + (sub.estimated_duration_minutes || 90);
                    }, 0);

                    return {
                      ...topic,
                      subtopics: updatedSubtopics,
                      estimated_duration_minutes: calculatedTopicDuration
                    };
                  }

                  return {
                    ...topic,
                    subtopics: updatedSubtopics
                  };
                }
                return topic;
              })
            }
          : unit
      ));

      // Update topic duration in database if it was recalculated
      if (calculatedTopicDuration !== undefined) {
        await supabase
          .from('topics')
          .update({ estimated_duration_minutes: calculatedTopicDuration })
          .eq('id', topicId);
      }
    } catch (error) {
      console.error('Error in updateSubtopic:', error);
    }
  }, []);

  const deleteSubtopic = useCallback(async (unitId: string, topicId: string, subtopicId: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('subtopics')
        .delete()
        .eq('id', subtopicId);

      if (error) {
        console.error('Error deleting subtopic from database:', error);
        return;
      }

      // Update local state and recalculate topic duration
      let calculatedTopicDuration: number | undefined;
      setUnits(prev => prev.map(unit =>
        unit.id === unitId
          ? {
              ...unit,
              topics: unit.topics.map(topic => {
                if (topic.id === topicId) {
                  const updatedSubtopics = topic.subtopics?.filter(subtopic => subtopic.id !== subtopicId);

                  // If there are still subtopics remaining, recalculate duration
                  if (updatedSubtopics && updatedSubtopics.length > 0) {
                    calculatedTopicDuration = updatedSubtopics.reduce((sum, sub) => {
                      return sum + (sub.estimated_duration_minutes || 90);
                    }, 0);

                    return {
                      ...topic,
                      subtopics: updatedSubtopics,
                      estimated_duration_minutes: calculatedTopicDuration
                    };
                  }

                  // No subtopics left, return to manual duration (default 120)
                  return {
                    ...topic,
                    subtopics: updatedSubtopics,
                    estimated_duration_minutes: 120
                  };
                }
                return topic;
              })
            }
          : unit
      ));

      // Update topic duration in database
      if (calculatedTopicDuration !== undefined) {
        await supabase
          .from('topics')
          .update({ estimated_duration_minutes: calculatedTopicDuration })
          .eq('id', topicId);
      } else {
        // Reset to manual duration default when no subtopics left
        await supabase
          .from('topics')
          .update({ estimated_duration_minutes: 120 })
          .eq('id', topicId);
      }
    } catch (error) {
      console.error('Error in deleteSubtopic:', error);
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

  // Update last access for topics and subtopics
  const updateLastAccess = useCallback(async (type: 'topic' | 'subtopic', id: string) => {
    try {
      const table = type === 'topic' ? 'topics' : 'subtopics';
      const { error } = await supabase
        .from(table)
        .update({ last_access: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error(`Error updating last_access for ${type}:`, error);
        return;
      }

      // Update local state
      setUnits(prev => prev.map(unit => ({
        ...unit,
        topics: unit.topics.map(topic => {
          if (type === 'topic' && topic.id === id) {
            return { ...topic, lastAccess: new Date().toISOString() };
          }
          return {
            ...topic,
            subtopics: topic.subtopics?.map(subtopic => 
              type === 'subtopic' && subtopic.id === id 
                ? { ...subtopic, lastAccess: new Date().toISOString() }
                : subtopic
            )
          };
        })
      })));
    } catch (error) {
      console.error(`Error in updateLastAccess for ${type}:`, error);
    }
  }, []);

  // Helper function to calculate total duration from subtopics
  const calculateTopicDuration = useCallback((topic: Topic): number => {
    if (!topic.subtopics || topic.subtopics.length === 0) {
      // No subtopics, return manual duration or default
      return topic.estimated_duration_minutes || 120;
    }

    // Has subtopics, sum their durations
    return topic.subtopics.reduce((sum, subtopic) => {
      return sum + (subtopic.estimated_duration_minutes || 90);
    }, 0);
  }, []);

  // Helper function to recalculate and update topic duration based on subtopics
  const recalculateTopicDuration = useCallback(async (unitId: string, topicId: string) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const topic = unit.topics.find(t => t.id === topicId);
    if (!topic) return;

    // Only recalculate if topic has subtopics
    if (topic.subtopics && topic.subtopics.length > 0) {
      const calculatedDuration = calculateTopicDuration(topic);

      // Update in database
      const { error } = await supabase
        .from('topics')
        .update({ estimated_duration_minutes: calculatedDuration })
        .eq('id', topicId);

      if (error) {
        console.error('Error updating topic duration:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.map(u =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map(t =>
                t.id === topicId
                  ? { ...t, estimated_duration_minutes: calculatedDuration }
                  : t
              )
            }
          : u
      ));
    }
  }, [units, calculateTopicDuration]);

  return {
    units,
    setUnits,
    isLoading,
    loadUnitsFromDatabase,

    // Unit operations
    addUnit,
    updateUnit,
    deleteUnit,

    // Topic operations
    addTopic,
    updateTopic,
    deleteTopic,

    // Subtopic operations
    addSubtopic,
    updateSubtopic,
    deleteSubtopic,

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