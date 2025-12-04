import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export interface DayException {
  hours: number;
  reason?: string;
}

export interface StudyConfig {
  id: string;
  user_id: string;

  // Seção 1: Essencial
  weekday_hours: number;
  weekend_hours: number;
  study_saturday: boolean;
  study_sunday: boolean;
  preferred_session_duration: number; // 45, 90, 120

  // Seção 2: Horários
  preferred_times: string[]; // ['morning', 'afternoon', 'night', 'dawn']
  avoid_times: string[];

  // Seção 3: Preferências
  fsrs_aggressiveness: 'aggressive' | 'balanced' | 'spaced';

  // Seção 4: Metas
  has_exam: boolean;
  exam_date: string | null;
  study_goal_type: 'exam' | 'continuous' | 'review';

  // Exceções diárias
  daily_exceptions: Record<string, DayException>; // { "2025-01-23": { hours: 6, reason: "Folga" } }

  // Metadados
  metadata: {
    speedMultiplier: number;
    productiveHours: Record<string, number>;
    completionRate: Record<string, number | { completed: number; total: number }>;
    lastLearningUpdate: string | null;
    setupCompleted: boolean;
    completedSections: string[]; // ['essential', 'times', 'preferences', 'goals']
  };

  created_at: string;
  updated_at: string;
}

export interface UpdateStudyConfigParams {
  weekday_hours?: number;
  weekend_hours?: number;
  study_saturday?: boolean;
  study_sunday?: boolean;
  preferred_session_duration?: number;
  preferred_times?: string[];
  avoid_times?: string[];
  fsrs_aggressiveness?: 'aggressive' | 'balanced' | 'spaced';
  has_exam?: boolean;
  exam_date?: string | null;
  study_goal_type?: 'exam' | 'continuous' | 'review';
  daily_exceptions?: Record<string, DayException>;
  metadata?: Partial<StudyConfig['metadata']>;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface StudyConfigContextValue {
  config: StudyConfig | null;
  isLoading: boolean;
  error: Error | null;
  fetchConfig: () => Promise<StudyConfig | null>;
  refreshConfig: () => Promise<void>;
  updateConfig: (updates: UpdateStudyConfigParams, skipStateUpdate?: boolean) => Promise<StudyConfig | null>;
  markSectionCompleted: (section: string) => Promise<void>;
  isSectionCompleted: (section: string) => boolean;
  setDayException: (date: Date, hours: number, reason?: string) => Promise<void>;
  removeDayException: (date: Date) => Promise<void>;
  getDayException: (date: Date) => DayException | null;
  hasDayException: (date: Date) => boolean;
  getAllExceptions: () => Array<{ date: string; exception: DayException }>;
  getDailyHours: (date: Date) => number;
  recordProductiveTime: (date: Date, hours: number) => Promise<void>;
  recordCompletion: (date: Date, completionRate: number) => Promise<void>;
}

const StudyConfigContext = createContext<StudyConfigContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function StudyConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  // ============================================================================
  // FETCH CONFIG
  // ============================================================================

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar ou criar config usando função do banco
      const { data, error: rpcError } = await supabase
        .rpc('get_or_create_user_study_config', { p_user_id: user.id });

      if (rpcError) throw rpcError;

      setConfig(data as any);
      return data as any;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao buscar configurações');
      setError(error);
      console.error('Error fetching study config:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    await fetchConfig();
  }, [fetchConfig]);

  // ============================================================================
  // UPDATE CONFIG
  // ============================================================================

  const updateConfig = useCallback(async (updates: UpdateStudyConfigParams, skipStateUpdate = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error: updateError } = await supabase
        .from('user_study_config')
        .update(updates as any)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Só atualizar o estado se não for uma atualização otimista
      if (!skipStateUpdate) {
        setConfig(data as any);

        toast({
          title: 'Configurações salvas!',
          description: 'Suas preferências foram atualizadas com sucesso.',
        });
      }

      return data as any;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao atualizar configurações');
      setError(error);

      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });

      console.error('Error updating study config:', error);
      return null;
    }
  }, [toast]);

  // ============================================================================
  // MARK SECTION AS COMPLETED
  // ============================================================================

  const markSectionCompleted = useCallback(async (section: string) => {
    if (!config) return;

    const completedSections = config.metadata?.completedSections || [];
    if (completedSections.includes(section)) return; // Já completado

    const newCompletedSections = [...completedSections, section];
    const setupCompleted = newCompletedSections.includes('essential'); // Essential é obrigatório

    await updateConfig({
      metadata: {
        ...config.metadata,
        completedSections: newCompletedSections,
        setupCompleted,
      },
    });
  }, [config, updateConfig]);

  const isSectionCompleted = useCallback((section: string): boolean => {
    return config?.metadata?.completedSections?.includes(section) ?? false;
  }, [config]);

  // ============================================================================
  // DAY EXCEPTIONS MANAGEMENT
  // ============================================================================

  const setDayException = useCallback(async (date: Date, hours: number, reason?: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');

    // Criar variável para armazenar newExceptions calculado
    let computedExceptions: Record<string, DayException> = {};

    // Atualizar estado local primeiro para UI responsiva
    // IMPORTANTE: Criar newExceptions DENTRO do updater para usar o estado mais recente
    setConfig(prev => {
      if (!prev) return prev;

      // CRIAR NOVO OBJETO para garantir nova referência
      const newExceptions: Record<string, DayException> = {};

      // Copiar exceções existentes do ESTADO ATUAL (prev), não da closure
      if (prev.daily_exceptions) {
        Object.keys(prev.daily_exceptions).forEach(key => {
          newExceptions[key] = { ...prev.daily_exceptions![key] };
        });
      }

      // Adicionar nova exceção
      newExceptions[dateKey] = { hours, reason };

      // Armazenar para usar no updateConfig
      computedExceptions = newExceptions;

      return {
        ...prev,
        daily_exceptions: newExceptions,
      };
    });

    // Depois salvar no banco SEM sobrescrever o estado local (skipStateUpdate = true)
    await updateConfig({
      daily_exceptions: computedExceptions,
    }, true);
  }, [updateConfig]);

  const removeDayException = useCallback(async (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');

    // Criar variável para armazenar newExceptions calculado
    let computedExceptions: Record<string, DayException> = {};

    // Atualizar estado local primeiro para UI responsiva
    setConfig(prev => {
      if (!prev) return prev;

      // CRIAR NOVO OBJETO para garantir nova referência
      const newExceptions: Record<string, DayException> = {};

      // Copiar exceções existentes EXCETO a que será removida
      if (prev.daily_exceptions) {
        Object.keys(prev.daily_exceptions).forEach(key => {
          if (key !== dateKey) {
            newExceptions[key] = { ...prev.daily_exceptions![key] };
          }
        });
      }

      // Armazenar para usar no updateConfig
      computedExceptions = newExceptions;

      return {
        ...prev,
        daily_exceptions: newExceptions,
      };
    });

    // Depois salvar no banco SEM sobrescrever o estado local (skipStateUpdate = true)
    await updateConfig({
      daily_exceptions: computedExceptions,
    }, true);
  }, [updateConfig]);

  const getDayException = useCallback((date: Date): DayException | null => {
    if (!config) return null;

    const dateKey = format(date, 'yyyy-MM-dd');
    return config.daily_exceptions?.[dateKey] || null;
  }, [config]);

  const hasDayException = useCallback((date: Date): boolean => {
    return getDayException(date) !== null;
  }, [getDayException]);

  const getAllExceptions = useCallback((): Array<{ date: string; exception: DayException }> => {
    if (!config || !config.daily_exceptions) return [];

    return Object.entries(config.daily_exceptions).map(([date, exception]) => ({
      date,
      exception,
    }));
  }, [config]);

  // ============================================================================
  // DAILY HOURS CALCULATION
  // ============================================================================

  const getDailyHours = useCallback((date: Date): number => {
    if (!config) return 3; // Default

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Verificar se tem exceção para este dia
    const exception = getDayException(date);
    if (exception) {
      return exception.hours;
    }

    // Se for fim de semana e não estuda no fim de semana, retorna 0
    if (isWeekend) {
      const studyWeekend = dayOfWeek === 0 ? config.study_sunday : config.study_saturday;
      if (!studyWeekend) return 0;
      return config.weekend_hours || 5;
    }

    return config.weekday_hours || 3;
  }, [config, getDayException]);

  // ============================================================================
  // LEARNING SYSTEM (Auto-ajuste baseado em comportamento)
  // ============================================================================

  const recordProductiveTime = useCallback(async (date: Date, hours: number) => {
    if (!config) return;

    const dateKey = format(date, 'yyyy-MM-dd');
    const productiveHours = config.metadata?.productiveHours || {};
    productiveHours[dateKey] = hours;

    await updateConfig({
      metadata: {
        ...config.metadata,
        productiveHours,
        lastLearningUpdate: new Date().toISOString(),
      },
    });
  }, [config, updateConfig]);

  const recordCompletion = useCallback(async (date: Date, completionRate: number) => {
    if (!config) return;

    const dateKey = format(date, 'yyyy-MM-dd');
    const completionRates = config.metadata?.completionRate || {};
    completionRates[dateKey] = completionRate;

    await updateConfig({
      metadata: {
        ...config.metadata,
        completionRate: completionRates,
        lastLearningUpdate: new Date().toISOString(),
      },
    });
  }, [config, updateConfig]);

  // ============================================================================
  // INITIAL FETCH
  // ============================================================================

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: StudyConfigContextValue = {
    config,
    isLoading,
    error,
    fetchConfig,
    refreshConfig,
    updateConfig,
    markSectionCompleted,
    isSectionCompleted,
    setDayException,
    removeDayException,
    getDayException,
    hasDayException,
    getAllExceptions,
    getDailyHours,
    recordProductiveTime,
    recordCompletion,
  };

  return (
    <StudyConfigContext.Provider value={value}>
      {children}
    </StudyConfigContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useStudyConfig() {
  const context = useContext(StudyConfigContext);
  if (context === undefined) {
    throw new Error('useStudyConfig must be used within StudyConfigProvider');
  }
  return context;
}
