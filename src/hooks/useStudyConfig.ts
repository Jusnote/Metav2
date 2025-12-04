import { useState, useEffect, useCallback } from 'react';
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
    completionRate: Record<string, number>;
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
// DEBUGGING HELPER
// ============================================================================

// Criar ID único para rastrear objetos
const objectIds = new WeakMap();
let nextId = 1;
function getObjectId(obj: any): string {
  if (!objectIds.has(obj)) {
    objectIds.set(obj, `OBJ_${nextId++}`);
  }
  return objectIds.get(obj);
}

// ============================================================================
// HOOK
// ============================================================================

export function useStudyConfig() {
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

      setConfig(data as StudyConfig);
      return data as StudyConfig;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao buscar configurações');
      setError(error);
      console.error('Error fetching study config:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // UPDATE CONFIG
  // ============================================================================

  const updateConfig = useCallback(async (updates: UpdateStudyConfigParams, skipStateUpdate = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const finalUpdates = { ...updates };

      const { data, error: updateError } = await supabase
        .from('user_study_config')
        .update(finalUpdates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('🟠 [updateConfig] Data from database:', data);
      console.log('🟠 [updateConfig] daily_exceptions from DB:', data?.daily_exceptions);
      console.log('🟠 [updateConfig] skipStateUpdate:', skipStateUpdate);

      // Só atualizar o estado se não for uma atualização otimista
      if (!skipStateUpdate) {
        setConfig(data as StudyConfig);

        toast({
          title: 'Configurações salvas!',
          description: 'Suas preferências foram atualizadas com sucesso.',
        });
      }

      return data as StudyConfig;
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

    const newMetadata = {
      speedMultiplier: config.metadata?.speedMultiplier || 1.0,
      productiveHours: config.metadata?.productiveHours || {},
      completionRate: config.metadata?.completionRate || {},
      lastLearningUpdate: config.metadata?.lastLearningUpdate || null,
      setupCompleted,
      completedSections: newCompletedSections,
    };

    await updateConfig({
      metadata: newMetadata,
    });
  }, [config, updateConfig]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getDailyHours = useCallback((date: Date): number => {
    if (!config) return 3; // Default

    // 1. VERIFICAR EXCEÇÕES PRIMEIRO (prioridade máxima)
    const dateKey = format(date, 'yyyy-MM-dd');
    const exception = config.daily_exceptions?.[dateKey];
    if (exception !== undefined) {
      return exception.hours; // Retorna valor customizado
    }

    // 2. Usar padrão semanal
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      // Sábado (6) ou Domingo (0)
      if (dayOfWeek === 6 && !config.study_saturday) return 0;
      if (dayOfWeek === 0 && !config.study_sunday) return 0;
      return config.weekend_hours;
    }

    return config.weekday_hours;
  }, [config]);

  const isSetupCompleted = useCallback((): boolean => {
    return config?.metadata?.setupCompleted ?? false;
  }, [config]);

  const hasCompletedSection = useCallback((section: string): boolean => {
    return config?.metadata?.completedSections?.includes(section) ?? false;
  }, [config]);

  // ============================================================================
  // DAY EXCEPTIONS MANAGEMENT
  // ============================================================================

  const setDayException = useCallback(async (date: Date, hours: number, reason?: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔵 [setDayException] START', { dateKey, hours, reason });

    // Criar variável para armazenar newExceptions calculado
    let computedExceptions: Record<string, DayException> = {};
    let prevConfigId = '';
    let newConfigId = '';

    // Atualizar estado local primeiro para UI responsiva
    // IMPORTANTE: Criar newExceptions DENTRO do updater para usar o estado mais recente
    setConfig(prev => {
      if (!prev) return prev;

      prevConfigId = getObjectId(prev);
      const prevExceptionsId = prev.daily_exceptions ? getObjectId(prev.daily_exceptions) : 'NULL';

      console.log('🟢 [setConfig UPDATER] RUNNING');
      console.log('🟢 [setConfig UPDATER] prev config ID:', prevConfigId);
      console.log('🟢 [setConfig UPDATER] prev.daily_exceptions ID:', prevExceptionsId);
      console.log('🟢 [setConfig UPDATER] prev.daily_exceptions content:', prev.daily_exceptions);

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

      const newExceptionsId = getObjectId(newExceptions);

      console.log('🟢 [setConfig UPDATER] NEW exceptions created');
      console.log('🟢 [setConfig UPDATER] newExceptions ID:', newExceptionsId);
      console.log('🟢 [setConfig UPDATER] newExceptions content:', newExceptions);
      console.log('🟢 [setConfig UPDATER] Value for', dateKey, '=', newExceptions[dateKey]);

      // Armazenar para usar no updateConfig
      computedExceptions = newExceptions;

      const newConfig = {
        ...prev,
        daily_exceptions: newExceptions,
      };

      newConfigId = getObjectId(newConfig);

      console.log('🟢 [setConfig UPDATER] NEW config created');
      console.log('🟢 [setConfig UPDATER] newConfig ID:', newConfigId);
      console.log('🟢 [setConfig UPDATER] newConfig.daily_exceptions ID:', getObjectId(newConfig.daily_exceptions));
      console.log('🟢 [setConfig UPDATER] RETURNING new config');

      return newConfig;
    });

    console.log('🔵 [setDayException] setConfig called');
    console.log('🔵 [setDayException] Previous config ID was:', prevConfigId);
    console.log('🔵 [setDayException] New config ID is:', newConfigId);

    // Depois salvar no banco SEM sobrescrever o estado local (skipStateUpdate = true)
    await updateConfig({
      daily_exceptions: computedExceptions,
    }, true);

    console.log('🔵 [setDayException] COMPLETED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
  // LEARNING SYSTEM (Auto-ajuste baseado em comportamento)
  // ============================================================================

  const trackStudySession = useCallback(async (session: {
    scheduledDate: string;
    estimatedDuration: number;
    actualDuration: number;
    hourOfDay: number;
    completed: boolean;
  }) => {
    if (!config) return;

    const metadata = { ...config.metadata };

    // Atualizar speed multiplier
    const speedRatio = session.actualDuration / session.estimatedDuration;
    const currentMultiplier = metadata.speedMultiplier || 1.0;
    const newMultiplier = (currentMultiplier * 0.9) + (speedRatio * 0.1); // Média móvel
    metadata.speedMultiplier = newMultiplier;

    // Rastrear horas produtivas
    const hourKey = `hour_${session.hourOfDay}`;
    const productiveHours = metadata.productiveHours || {};
    productiveHours[hourKey] = (productiveHours[hourKey] || 0) + 1;
    metadata.productiveHours = productiveHours;

    // Taxa de conclusão por dia da semana
    const dayOfWeek = new Date(session.scheduledDate).getDay();
    const dayKey = `day_${dayOfWeek}`;
    const completionRate = metadata.completionRate || {};
    const currentRate = completionRate[dayKey] || { completed: 0, total: 0 };
    completionRate[dayKey] = {
      completed: currentRate.completed + (session.completed ? 1 : 0),
      total: currentRate.total + 1,
    };
    metadata.completionRate = completionRate;

    metadata.lastLearningUpdate = new Date().toISOString();

    await updateConfig({ metadata });
  }, [config, updateConfig]);

  // ============================================================================
  // EFFECT: Load on mount
  // ============================================================================

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    config,
    isLoading,
    error,

    // Actions
    updateConfig,
    markSectionCompleted,
    refreshConfig: fetchConfig,

    // Helpers
    getDailyHours,
    isSetupCompleted,
    hasCompletedSection,
    trackStudySession,

    // Day Exceptions
    setDayException,
    removeDayException,
    getDayException,
    hasDayException,
    getAllExceptions,
  };
}
