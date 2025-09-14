import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export interface Document {
  id: string;
  user_id: string;
  title: string;
  content: any; // Lexical editor state
  content_text?: string;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  tags: string[];
  subtopic_id?: string;
}

export interface CreateDocumentData {
  title?: string;
  content: any;
  content_text?: string;
  is_favorite?: boolean;
  tags?: string[];
  subtopic_id?: string;
}

export interface UpdateDocumentData {
  title?: string;
  content?: any;
  is_favorite?: boolean;
  tags?: string[];
  subtopic_id?: string;
}

export function useDocuments(user: User | null) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all documents for the current user
  const fetchDocuments = useCallback(async () => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a new document
  const createDocument = async (documentData: CreateDocumentData): Promise<Document | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: documentData.title || 'Untitled Document',
          content: documentData.content,
          is_favorite: documentData.is_favorite || false,
          tags: documentData.tags || [],
          subtopic_id: documentData.subtopic_id
        })
        .select()
        .single();

      if (error) throw error;
      
      // Add to local state
      setDocuments(prev => [data, ...prev]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      return null;
    }
  };

  // Update an existing document
  const updateDocument = async (id: string, updates: UpdateDocumentData): Promise<Document | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      // Update local state
      setDocuments(prev => 
        prev.map(doc => doc.id === id ? data : doc)
      );
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
      return null;
    }
  };

  // Delete a document
  const deleteDocument = async (id: string): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      return false;
    }
  };

  // Get a single document by ID
  const getDocument = async (id: string): Promise<Document | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch document');
      return null;
    }
  };

  // Search documents by text content
  const searchDocuments = async (query: string): Promise<Document[]> => {
    if (!user || !query.trim()) {
      return documents;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .textSearch('content_text', query)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search documents');
      return [];
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (id: string): Promise<boolean> => {
    const document = documents.find(doc => doc.id === id);
    if (!document) return false;

    const updated = await updateDocument(id, { is_favorite: !document.is_favorite });
    return updated !== null;
  };

  // Clear error
  const clearError = () => setError(null);

  // Fetch documents when user changes
  useEffect(() => {
    if (user) {
      fetchDocuments();
    } else {
      setDocuments([]);
      setLoading(false);
      setError(null);
    }
  }, [user]);

  return {
    documents,
    loading,
    error,
    createDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    searchDocuments,
    toggleFavorite,
    refetch: fetchDocuments,
    clearError
  };
}

// Hook for auto-saving documents with debounce
export function useAutoSave(user: User | null = null) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load document when currentDocumentId changes
  const loadDocument = useCallback(async (documentId: string) => {
    try {
      setIsLoading(true);
      setSaveError(null);

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.log('❌ Error loading document:', error);
        throw error;
      }
      
      console.log('✅ Document loaded successfully:', {
        id: data.id,
        title: data.title,
        contentType: typeof data.content,
        hasContent: !!data.content
      });
      
      setCurrentDocument(data);
      return data;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to load document');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load document when currentDocumentId changes
  useEffect(() => {
    console.log('🔄 useEffect triggered - currentDocumentId changed:', currentDocumentId);
    if (currentDocumentId) {
      console.log('📥 Loading document:', currentDocumentId);
      loadDocument(currentDocumentId);
    } else {
      console.log('🗑️ Clearing current document');
      setCurrentDocument(null);
    }
  }, [currentDocumentId, loadDocument]);

  const saveDocument = useCallback(async (documentData: {
    title?: string;
    content: any;
    content_text?: string;
    subtopic_id?: string;
  }) => {
    try {
      setIsSaving(true);
      setSaveError(null);

      if (!user) {
        console.log('❌ saveDocument: No user found');
        return;
      }

      console.log('💾 saveDocument started:', {
        currentDocumentId,
        title: documentData.title,
        subtopic_id: documentData.subtopic_id,
        user_id: user.id
      });

      if (currentDocumentId && !currentDocumentId.startsWith('temp-')) {
        console.log('📝 Updating existing document:', currentDocumentId);
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            ...documentData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDocumentId)
          .eq('user_id', user.id);

        if (error) {
          console.log('❌ Update error:', error);
          throw error;
        }
        console.log('✅ Document updated successfully');
      } else {
        console.log('📄 Creating new document');
        // Create new document
        const { data, error } = await supabase
          .from('documents')
          .insert({
            ...documentData,
            title: documentData.title || 'Documento sem título',
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.log('❌ Insert error:', error);
          throw error;
        }
        if (data) {
          console.log('✅ Document created with ID:', data.id);
          setCurrentDocumentId(data.id);
        }
      }
      
      setLastSaved(new Date());
      console.log('✅ saveDocument completed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save document';
      console.log('❌ saveDocument error:', errorMessage);
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [currentDocumentId, user]);

  const debouncedSave = useCallback((documentData: {
    title?: string;
    content: any;
    content_text?: string;
    subtopic_id?: string;
  }) => {
    console.log('🔄 debouncedSave called with:', {
      title: documentData.title,
      subtopic_id: documentData.subtopic_id,
      currentDocumentId,
      hasContent: !!documentData.content,
      contentText: documentData.content_text?.substring(0, 50) + '...'
    });
    
    // Clear previous timeout if it exists
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout to save after 2 seconds
    debounceRef.current = setTimeout(() => {
      if (currentDocumentId) {
        console.log('⏰ Executing saveDocument after debounce');
        saveDocument(documentData);
      } else {
        console.log('⏰ Skipping save - no document ID available');
      }
    }, 2000);
  }, [saveDocument, currentDocumentId]);

  // Cleanup timeout when component unmounts
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    saveDocument,
    debouncedSave,
    loadDocument,
    isSaving,
    isLoading,
    lastSaved,
    saveError,
    currentDocumentId,
    setCurrentDocumentId,
    currentDocument,
    clearSaveError: () => setSaveError(null)
  };
}