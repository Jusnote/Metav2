import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Tipos base
export interface BaseEntity {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ServerFirstOptions {
  realtime?: boolean;
  cacheTimeout?: number;
  enableOfflineQueue?: boolean;
  tableName: string;
}

export interface SyncStatus {
  status: 'idle' | 'loading' | 'syncing' | 'error';
  lastSync?: Date;
  error?: string;
  pendingOperations: number;
}

interface Operation<T> {
  id: string;
  type: 'create' | 'update' | 'delete';
  data?: Partial<T>;
  timestamp: number;
  retries: number;
}

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  version: number;
}

const MAX_RETRIES = 3;
const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const RETRY_DELAY_BASE = 1000; // 1 segundo

/**
 * Hook genérico para padrão Server-First com cache inteligente
 * 
 * Características:
 * - Fonte única de verdade: Supabase
 * - Cache em memória para performance
 * - Updates otimistas para UX responsiva
 * - Queue offline para operações sem internet
 * - Sincronização automática em background
 * - Estados de loading/erro claros
 */
export function useServerFirst<T extends BaseEntity>(
  options: ServerFirstOptions
) {
  const { tableName, realtime = false, cacheTimeout = DEFAULT_CACHE_TIMEOUT, enableOfflineQueue = true } = options;

  // Estados principais
  const [data, setData] = useState<T[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle',
    pendingOperations: 0
  });

  // Refs para cache e queue
  const cacheRef = useRef<CacheEntry<T> | null>(null);
  const offlineQueueRef = useRef<Operation<T>[]>([]);
  const isOnlineRef = useRef(navigator.onLine);
  const subscriptionRef = useRef<any>(null);

  const { toast } = useToast();

  // Utilitários
  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const isDataFresh = useCallback(() => {
    if (!cacheRef.current) return false;
    return Date.now() - cacheRef.current.timestamp < cacheTimeout;
  }, [cacheTimeout]);

  const updateCache = useCallback((newData: T[]) => {
    cacheRef.current = {
      data: newData,
      timestamp: Date.now(),
      version: (cacheRef.current?.version || 0) + 1
    };
  }, []);

  // Carregar dados do servidor
  const fetchFromServer = useCallback(async (): Promise<T[]> => {
    try {
      setSyncStatus(prev => ({ ...prev, status: 'loading' }));

      const { data: serverData, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = (serverData || []) as T[];
      updateCache(typedData);
      setData(typedData);

      setSyncStatus(prev => ({
        ...prev,
        status: 'idle',
        lastSync: new Date(),
        error: undefined
      }));

      return typedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados';
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      
      console.error(`Erro ao buscar dados de ${tableName}:`, error);
      throw error;
    }
  }, [tableName, updateCache]);

  // Inicialização
  const initialize = useCallback(async () => {
    // Usar cache se disponível e fresco
    if (cacheRef.current && isDataFresh()) {
      setData(cacheRef.current.data);
      setSyncStatus(prev => ({ ...prev, status: 'idle' }));
      return;
    }

    // Buscar do servidor
    try {
      await fetchFromServer();
    } catch (error) {
      // Se falhar e tiver cache, usar cache mesmo que antigo
      if (cacheRef.current) {
        setData(cacheRef.current.data);
        toast({
          title: 'Dados em cache',
          description: 'Usando dados salvos localmente. Verifique sua conexão.',
          variant: 'default'
        });
      }
    }
  }, [fetchFromServer, isDataFresh, toast]);

  // Processar queue offline
  const processOfflineQueue = useCallback(async () => {
    if (offlineQueueRef.current.length === 0 || !isOnlineRef.current) return;

    setSyncStatus(prev => ({ ...prev, status: 'syncing' }));

    const queue = [...offlineQueueRef.current];
    const failedOperations: Operation<T>[] = [];

    for (const operation of queue) {
      try {
        let result;
        
        switch (operation.type) {
          case 'create':
            result = await supabase
              .from(tableName)
              .insert(operation.data!)
              .select()
              .single();
            break;
            
          case 'update':
            result = await supabase
              .from(tableName)
              .update(operation.data!)
              .eq('id', operation.id)
              .select()
              .single();
            break;
            
          case 'delete':
            result = await supabase
              .from(tableName)
              .delete()
              .eq('id', operation.id);
            break;
        }

        if (result?.error) throw result.error;

        // Remover da queue se sucesso
        offlineQueueRef.current = offlineQueueRef.current.filter(op => op !== operation);
        
      } catch (error) {
        console.error(`Erro ao processar operação ${operation.type}:`, error);
        
        // Incrementar tentativas
        operation.retries++;
        
        if (operation.retries <= MAX_RETRIES) {
          failedOperations.push(operation);
        } else {
          // Descartar após max tentativas
          toast({
            title: 'Operação falhou',
            description: `Não foi possível ${operation.type === 'create' ? 'criar' : operation.type === 'update' ? 'atualizar' : 'deletar'} item após ${MAX_RETRIES} tentativas.`,
            variant: 'destructive'
          });
        }
      }
    }

    // Atualizar queue com operações que falharam
    offlineQueueRef.current = failedOperations;
    
    setSyncStatus(prev => ({
      ...prev,
      status: 'idle',
      pendingOperations: offlineQueueRef.current.length,
      lastSync: new Date()
    }));

    // Recarregar dados após sincronização
    if (failedOperations.length < queue.length) {
      await fetchFromServer();
    }
  }, [tableName, fetchFromServer, toast]);

  // Operações CRUD com updates otimistas
  const create = useCallback(async (newItem: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T | null> => {
    const tempId = generateTempId();
    const optimisticItem: T = {
      ...newItem,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as T;

    // Update otimista
    setData(prev => [optimisticItem, ...prev]);

    if (isOnlineRef.current) {
      try {
        const { data: serverItem, error } = await supabase
          .from(tableName)
          .insert(newItem)
          .select()
          .single();

        if (error) throw error;

        // Substituir item temporário pelo real
        setData(prev => prev.map(item => 
          item.id === tempId ? serverItem as T : item
        ));

        updateCache(data);
        return serverItem as T;

      } catch (error) {
        // Reverter update otimista
        setData(prev => prev.filter(item => item.id !== tempId));
        
        if (enableOfflineQueue) {
          // Adicionar à queue offline
          offlineQueueRef.current.push({
            id: tempId,
            type: 'create',
            data: newItem,
            timestamp: Date.now(),
            retries: 0
          });
          
          setSyncStatus(prev => ({
            ...prev,
            pendingOperations: offlineQueueRef.current.length
          }));
        }

        toast({
          title: 'Erro ao criar',
          description: 'Item será sincronizado quando a conexão for restabelecida.',
          variant: 'default'
        });

        return null;
      }
    } else if (enableOfflineQueue) {
      // Adicionar à queue offline
      offlineQueueRef.current.push({
        id: tempId,
        type: 'create',
        data: newItem,
        timestamp: Date.now(),
        retries: 0
      });
      
      setSyncStatus(prev => ({
        ...prev,
        pendingOperations: offlineQueueRef.current.length
      }));

      return optimisticItem;
    }

    return null;
  }, [tableName, enableOfflineQueue, toast, updateCache, data]);

  const update = useCallback(async (id: string, updates: Partial<T>): Promise<T | null> => {
    // Update otimista
    const previousData = [...data];
    setData(prev => prev.map(item => 
      item.id === id 
        ? { ...item, ...updates, updated_at: new Date().toISOString() }
        : item
    ));

    if (isOnlineRef.current) {
      try {
        const { data: serverItem, error } = await supabase
          .from(tableName)
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        setData(prev => prev.map(item => 
          item.id === id ? serverItem as T : item
        ));

        updateCache(data);
        return serverItem as T;

      } catch (error) {
        // Reverter update otimista
        setData(previousData);
        
        if (enableOfflineQueue) {
          offlineQueueRef.current.push({
            id,
            type: 'update',
            data: updates,
            timestamp: Date.now(),
            retries: 0
          });
          
          setSyncStatus(prev => ({
            ...prev,
            pendingOperations: offlineQueueRef.current.length
          }));
        }

        toast({
          title: 'Erro ao atualizar',
          description: 'Alteração será sincronizada quando a conexão for restabelecida.',
          variant: 'default'
        });

        return null;
      }
    } else if (enableOfflineQueue) {
      offlineQueueRef.current.push({
        id,
        type: 'update',
        data: updates,
        timestamp: Date.now(),
        retries: 0
      });
      
      setSyncStatus(prev => ({
        ...prev,
        pendingOperations: offlineQueueRef.current.length
      }));
    }

    return null;
  }, [data, tableName, enableOfflineQueue, toast, updateCache]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    // Update otimista
    const previousData = [...data];
    setData(prev => prev.filter(item => item.id !== id));

    if (isOnlineRef.current) {
      try {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);

        if (error) throw error;

        updateCache(data);
        return true;

      } catch (error) {
        // Reverter update otimista
        setData(previousData);
        
        if (enableOfflineQueue) {
          offlineQueueRef.current.push({
            id,
            type: 'delete',
            timestamp: Date.now(),
            retries: 0
          });
          
          setSyncStatus(prev => ({
            ...prev,
            pendingOperations: offlineQueueRef.current.length
          }));
        }

        toast({
          title: 'Erro ao deletar',
          description: 'Exclusão será sincronizada quando a conexão for restabelecida.',
          variant: 'default'
        });

        return false;
      }
    } else if (enableOfflineQueue) {
      offlineQueueRef.current.push({
        id,
        type: 'delete',
        timestamp: Date.now(),
        retries: 0
      });
      
      setSyncStatus(prev => ({
        ...prev,
        pendingOperations: offlineQueueRef.current.length
      }));
    }

    return true;
  }, [data, tableName, enableOfflineQueue, toast, updateCache]);

  // Sincronização manual
  const sync = useCallback(async () => {
    await processOfflineQueue();
    await fetchFromServer();
  }, [processOfflineQueue, fetchFromServer]);

  // Efeitos
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      processOfflineQueue();
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processOfflineQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!realtime) return;

    subscriptionRef.current = supabase
      .channel(`${tableName}_changes`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          console.log('Realtime update:', payload);
          // Recarregar dados quando houver mudanças
          fetchFromServer();
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [realtime, tableName, fetchFromServer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    // Dados
    data,
    
    // Status
    isLoading: syncStatus.status === 'loading',
    isSyncing: syncStatus.status === 'syncing',
    error: syncStatus.error,
    syncStatus,
    
    // Operações
    create,
    update,
    remove,
    sync,
    
    // Utilitários
    refresh: fetchFromServer
  };
}
