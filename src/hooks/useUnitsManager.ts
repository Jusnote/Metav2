import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
}

const generateId = () => crypto.randomUUID();

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
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load units
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (unitsError) throw unitsError;

      // Load topics for each unit
      const unitsWithTopics = await Promise.all(
        (unitsData || []).map(async (unit) => {
          const { data: topicsData, error: topicsError } = await supabase
            .from('topics')
            .select('*')
            .eq('unit_id', unit.id)
            .order('created_at', { ascending: true });

          if (topicsError) throw topicsError;

          // Load subtopics for each topic
          const topicsWithSubtopics = await Promise.all(
            (topicsData || []).map(async (topic) => {
              const { data: subtopicsData, error: subtopicsError } = await supabase
                .from('subtopics')
                .select('*')
                .eq('topic_id', topic.id)
                .order('created_at', { ascending: true });

              if (subtopicsError) throw subtopicsError;

              return {
                ...topic,
                subtopics: (subtopicsData || []).map(subtopic => ({
                  id: subtopic.id,
                  title: subtopic.title,
                  date: new Date(subtopic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  totalAulas: subtopic.total_aulas || 0,
                  status: subtopic.status || 'not-started',
                  tempo: subtopic.tempo || '0min',
                  resumosVinculados: subtopic.resumos_vinculados || 0,
                  flashcardsVinculados: subtopic.flashcards_vinculados || 0,
                  questoesVinculadas: subtopic.questoes_vinculadas || 0
                }))
              };
            })
          );

          return {
            id: unit.id,
            title: unit.title,
            totalChapters: unit.total_chapters || 0,
            subject: unit.subject || '',
            topics: topicsWithSubtopics.map(topic => ({
              id: topic.id,
              title: topic.title,
              date: new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              totalAulas: topic.total_aulas || 0,
              subtopics: topic.subtopics
            }))
          };
        })
      );

      setUnits(unitsWithTopics);
    } catch (error) {
      console.error('Error loading units:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load data on mount and when user changes
  useEffect(() => {
    if (user) {
      loadUnitsFromDatabase();
    } else {
      setUnits(initialUnits);
    }
  }, [user, loadUnitsFromDatabase, initialUnits]);

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
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Update in database
      const { error } = await supabase
        .from('units')
        .update({
          title: updates.title,
          total_chapters: updates.totalChapters,
          subject: updates.subject
        })
        .eq('id', unitId)
        .eq('user_id', user.id);

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
  }, [user]);

  const deleteUnit = useCallback(async (unitId: string) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Delete from database (cascade will handle topics and subtopics)
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting unit from database:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.filter(unit => unit.id !== unitId));
    } catch (error) {
      console.error('Error in deleteUnit:', error);
    }
  }, [user]);

  // Topic operations
  const addTopic = useCallback(async (unitId: string, title: string) => {
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
        subtopics: []
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
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Update in database
      const { error } = await supabase
        .from('topics')
        .update({
          title: updates.title,
          total_aulas: updates.totalAulas
        })
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
  }, [user]);

  const deleteTopic = useCallback(async (unitId: string, topicId: string) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

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
  }, [user]);

  // Subtopic operations
  const addSubtopic = useCallback(async (unitId: string, topicId: string, title: string) => {
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
        questoesVinculadas: 0
      };
      
      setUnits(prev => prev.map(unit => 
        unit.id === unitId 
          ? {
              ...unit,
              topics: unit.topics.map(topic => 
                topic.id === topicId 
                  ? { 
                      ...topic, 
                      subtopics: [...(topic.subtopics || []), newSubtopic] 
                    }
                  : topic
              )
            }
          : unit
      ));
      
      return subtopicData.id;
    } catch (error) {
      console.error('Error in addSubtopic:', error);
      return null;
    }
  }, [user]);

  const updateSubtopic = useCallback(async (unitId: string, topicId: string, subtopicId: string, updates: Partial<Subtopic>) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Update in database
      const { error } = await supabase
        .from('subtopics')
        .update({
          title: updates.title,
          status: updates.status,
          total_aulas: updates.totalAulas,
          tempo: updates.tempo,
          resumos_vinculados: updates.resumosVinculados,
          flashcards_vinculados: updates.flashcardsVinculados,
          questoes_vinculadas: updates.questoesVinculadas
        })
        .eq('id', subtopicId);

      if (error) {
        console.error('Error updating subtopic in database:', error);
        return;
      }

      // Update local state
      setUnits(prev => prev.map(unit => 
        unit.id === unitId 
          ? {
              ...unit,
              topics: unit.topics.map(topic => 
                topic.id === topicId 
                  ? {
                      ...topic,
                      subtopics: topic.subtopics?.map(subtopic => 
                        subtopic.id === subtopicId ? { ...subtopic, ...updates } : subtopic
                      )
                    }
                  : topic
              )
            }
          : unit
      ));
    } catch (error) {
      console.error('Error in updateSubtopic:', error);
    }
  }, [user]);

  const deleteSubtopic = useCallback(async (unitId: string, topicId: string, subtopicId: string) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

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

      // Update local state
      setUnits(prev => prev.map(unit => 
        unit.id === unitId 
          ? {
              ...unit,
              topics: unit.topics.map(topic => 
                topic.id === topicId 
                  ? {
                      ...topic,
                      subtopics: topic.subtopics?.filter(subtopic => subtopic.id !== subtopicId)
                    }
                  : topic
              )
            }
          : unit
      ));
    } catch (error) {
      console.error('Error in deleteSubtopic:', error);
    }
  }, [user]);

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
    isEditing
  };
};