import { useCallback, useRef, useEffect, useState } from 'react';
import { useToast } from './use-toast';
import { PlateDocument, PlateDocumentInsert, PlateDocumentUpdate, SaveStatus } from '../types/plate-document';
import { useServerFirst } from './useServerFirst';
import { supabase } from '../integrations/supabase/client';

/**
 * Hook para gerenciar documentos do Plate Editor
 * Usa o padrão Server-First com auto-save inteligente
 */
export function usePlateDocuments() {
  const { toast } = useToast();

  // Usar hook base server-first
  const {
    data: documents,
    isLoading,
    isSyncing,
    error,
    create,
    update,
    remove,
    refresh
  } = useServerFirst<PlateDocument>({
    tableName: 'documents',
    realtime: true, // Sincronização em tempo real
    cacheTimeout: 5 * 60 * 1000, // Cache por 5 minutos
    enableOfflineQueue: true
  });

  // Criar documento
  const createDocument = useCallback(async (data: PlateDocumentInsert): Promise<PlateDocument | null> => {
    try {
      const newDoc = await create({
        title: data.title || 'Documento sem título',
        content: data.content,
        content_text: data.content_text,
        is_favorite: data.is_favorite || false,
        tags: data.tags || [],
        subtopic_id: data.subtopic_id
      } as Partial<PlateDocument>);

      if (newDoc) {
        toast({
          title: 'Documento criado',
          description: 'Seu documento foi criado com sucesso',
        });
      }

      return newDoc;
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o documento',
        variant: 'destructive',
      });
      return null;
    }
  }, [create, toast]);

  // Atualizar documento
  const updateDocument = useCallback(async (id: string, data: PlateDocumentUpdate): Promise<PlateDocument | null> => {
    try {
      const updated = await update(id, data as Partial<PlateDocument>);
      return updated;
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as alterações',
        variant: 'destructive',
      });
      return null;
    }
  }, [update, toast]);

  // Deletar documento
  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await remove(id);

      if (success) {
        toast({
          title: 'Documento excluído',
          description: 'O documento foi removido com sucesso',
        });
      }

      return success;
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o documento',
        variant: 'destructive',
      });
      return false;
    }
  }, [remove, toast]);

  // Buscar documento por ID
  const getDocument = useCallback((id: string): PlateDocument | null => {
    return documents.find(doc => doc.id === id) || null;
  }, [documents]);

  // Buscar documentos por subtópico
  const getDocumentsBySubtopic = useCallback((subtopicId: string): PlateDocument[] => {
    return documents.filter(doc => doc.subtopic_id === subtopicId);
  }, [documents]);

  // Buscar documentos favoritos
  const getFavoriteDocuments = useCallback((): PlateDocument[] => {
    return documents.filter(doc => doc.is_favorite);
  }, [documents]);

  // Toggle favorito
  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
    const doc = getDocument(id);
    if (!doc) return false;

    const updated = await updateDocument(id, { is_favorite: !doc.is_favorite });
    return updated !== null;
  }, [getDocument, updateDocument]);

  // Extrair texto plano do conteúdo Plate
  const extractPlainText = useCallback((content: any[]): string => {
    const extractText = (nodes: any[]): string => {
      return nodes.map(node => {
        if (typeof node.text === 'string') {
          return node.text;
        }
        if (node.children && Array.isArray(node.children)) {
          return extractText(node.children);
        }
        return '';
      }).join(' ');
    };

    return extractText(content).trim();
  }, []);

  // Extrair título do primeiro nó de título (h1, h2, etc)
  const extractTitle = useCallback((content: any[]): string => {
    for (const node of content) {
      if (node.type && ['h1', 'h2', 'h3'].includes(node.type)) {
        if (node.children && Array.isArray(node.children)) {
          const text = node.children.map((child: any) => child.text || '').join('');
          if (text.trim()) return text.trim();
        }
      }
    }
    return 'Documento sem título';
  }, []);

  return {
    // Dados
    documents,

    // Estados
    isLoading,
    isSyncing,
    error,

    // Operações CRUD
    createDocument,
    updateDocument,
    deleteDocument,
    getDocument,

    // Operações específicas
    getDocumentsBySubtopic,
    getFavoriteDocuments,
    toggleFavorite,

    // Utilitários
    extractPlainText,
    extractTitle,
    refresh,
  };
}

/**
 * Hook para auto-save de um documento específico
 * Implementa debounce e gerenciamento de estado de salvamento
 */
export function useAutoSavePlateDocument(documentId: string | null) {
  const { updateDocument, createDocument, extractPlainText, extractTitle } = usePlateDocuments();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ type: 'idle' });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const lastSavedContentHashRef = useRef<number>(0);

  // Constantes de timing
  const SAVE_DEBOUNCE = 800; // 800ms para digitação normal
  const SAVE_THROTTLE = 2000; // 2s mínimo entre saves
  const IDLE_TIMEOUT = 3000; // 3s de idle para auto-save

  // Função de hash rápido (djb2) - 10-50x mais rápido que JSON.stringify
  const hashContent = useCallback((content: any[]): number => {
    const str = JSON.stringify(content);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return hash >>> 0; // Unsigned 32-bit integer
  }, []);

  // Estado local para documento atual (busca direto do Supabase)
  const [currentDocument, setCurrentDocument] = useState<PlateDocument | null>(null);

  // Buscar documento direto do Supabase quando documentId mudar
  useEffect(() => {
    if (!documentId) {
      setCurrentDocument(null);
      return;
    }

    const fetchDocument = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        setCurrentDocument(data as PlateDocument);

        // Inicializar lastSavedContentHashRef
        if (data.content) {
          lastSavedContentHashRef.current = hashContent(Array.isArray(data.content) ? data.content : []);
        }
      } catch (error) {
        // Silently fail - error handling via toast in parent
      }
    };

    fetchDocument();
  }, [documentId, hashContent]);

  // Limpar timers ao desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  // Função de salvamento sem debounce (para uso manual e eventos)
  const saveNow = useCallback(async (content: any[], title?: string) => {
    if (!documentId) {
      return;
    }

    const contentHash = hashContent(content);
    const lastSavedHash = lastSavedContentHashRef.current;

    // Evitar salvamento duplicado usando hash
    if (contentHash === lastSavedHash) {
      return;
    }

    // Verificar throttle (mínimo 2s entre saves)
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTimeRef.current;
    if (timeSinceLastSave < SAVE_THROTTLE) {
      return;
    }

    try {
      setSaveStatus({ type: 'saving' });
      lastSaveTimeRef.current = now;

      const plainText = extractPlainText(content);
      const autoTitle = title || extractTitle(content);

      const updateData: PlateDocumentUpdate = {
        content,
        content_text: plainText,
        title: autoTitle,
      };

      const result = await updateDocument(documentId, updateData);

      if (result) {
        lastSavedContentHashRef.current = contentHash;
        setSaveStatus({ type: 'saved', at: new Date() });

        // Voltar para idle após 2 segundos
        setTimeout(() => {
          setSaveStatus({ type: 'idle' });
        }, 2000);
      } else {
        throw new Error('Falha ao salvar');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      setSaveStatus({ type: 'error', message });
    }
  }, [documentId, updateDocument, extractPlainText, extractTitle, hashContent, SAVE_THROTTLE]);

  // Função de salvamento com debounce + idle timer (para uso durante digitação)
  const saveWithDebounce = useCallback((content: any[], title?: string) => {
    if (!documentId) {
      return;
    }

    // Limpar timers anteriores
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Debounce timer (800ms)
    debounceTimerRef.current = setTimeout(() => {
      saveNow(content, title);
    }, SAVE_DEBOUNCE);

    // Idle timer (3s) - salva se parar de digitar
    idleTimerRef.current = setTimeout(() => {
      saveNow(content, title);
    }, IDLE_TIMEOUT);
  }, [documentId, saveNow, SAVE_DEBOUNCE, IDLE_TIMEOUT]);

  // Criar novo documento
  const createNew = useCallback(async (content: any[], title?: string): Promise<string | null> => {
    try {
      setSaveStatus({ type: 'saving' });

      const plainText = extractPlainText(content);
      const autoTitle = title || extractTitle(content);

      const newDoc = await createDocument({
        content,
        content_text: plainText,
        title: autoTitle,
      });

      if (newDoc) {
        lastSavedContentHashRef.current = hashContent(content);
        setSaveStatus({ type: 'saved', at: new Date() });

        setTimeout(() => {
          setSaveStatus({ type: 'idle' });
        }, 2000);

        return newDoc.id;
      }

      throw new Error('Falha ao criar documento');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      setSaveStatus({ type: 'error', message });
      return null;
    }
  }, [createDocument, extractPlainText, extractTitle, hashContent]);

  return {
    // Estado
    saveStatus,
    currentDocument,

    // Operações
    saveNow,
    saveWithDebounce,
    createNew,

    // Resetar status
    resetStatus: () => setSaveStatus({ type: 'idle' }),
  };
}
