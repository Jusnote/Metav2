import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TimerState {
  isActive: boolean;
  currentActivity: string;
  currentSubtopicKey: string;
  currentActivityType: 'documento' | 'flashcards' | 'questoes' | null;
  savedTime: number; // Tempo salvo quando pausado/parado
}

interface TimerContextType {
  timerState: TimerState;
  activityTimers: Record<string, {
    documento: number;
    flashcards: number;
    questoes: number;
  }>;
  startActivity: (subtopicKey: string, activityType: 'documento' | 'flashcards' | 'questoes', activityName: string) => void;
  stopActivity: () => void;
  completeCurrentActivity: () => void;
  pauseCurrentActivity: () => void;
  resumeCurrentActivity: () => void;
  stopCurrentActivity: () => void;
  getTotalTimeForSubtopic: (subtopicKey: string) => number;
  getActivityTime: (subtopicKey: string, activity: 'documento' | 'flashcards' | 'questoes') => number;
  getCurrentSessionTime: () => number;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};

interface TimerProviderProps {
  children: ReactNode;
}

export const TimerProvider: React.FC<TimerProviderProps> = ({ children }) => {
  const [timerState, setTimerState] = useState<TimerState>({
    isActive: false,
    currentActivity: '',
    currentSubtopicKey: '',
    currentActivityType: null,
    savedTime: 0
  });

  const [activityTimers, setActivityTimers] = useState<Record<string, {
    documento: number;
    flashcards: number;
    questoes: number;
  }>>({});

  // Obter apenas o tempo da sessão atual do timer global
  const getCurrentSessionTime = () => {
    return (window as any).globalTimer?.getCurrentTime?.() || 0;
  };

  const startActivity = (subtopicKey: string, activityType: 'documento' | 'flashcards' | 'questoes', activityName: string) => {
    // Iniciar nova atividade
    setTimerState({
      isActive: true,
      currentActivity: activityName,
      currentSubtopicKey: subtopicKey,
      currentActivityType: activityType,
      savedTime: 0
    });

    // Mostrar e iniciar timer global (que resetará automaticamente)
    (window as any).showGlobalTimer?.();
    (window as any).globalTimer?.setActivity?.(activityName); // Isso já reseta o timer
    (window as any).globalTimer?.startTimer?.();
  };

  const completeCurrentActivity = React.useCallback(() => {
    // Obter apenas o tempo da sessão atual (sem somar com savedTime)
    const sessionTime = getCurrentSessionTime();

    // Salvar tempo da atividade atual
    if (timerState.currentSubtopicKey && timerState.currentActivityType && sessionTime > 0) {
      setActivityTimers(prev => ({
        ...prev,
        [timerState.currentSubtopicKey]: {
          documento: prev[timerState.currentSubtopicKey]?.documento || 0,
          flashcards: prev[timerState.currentSubtopicKey]?.flashcards || 0,
          questoes: prev[timerState.currentSubtopicKey]?.questoes || 0,
          [timerState.currentActivityType]: (prev[timerState.currentSubtopicKey]?.[timerState.currentActivityType] || 0) + sessionTime
        }
      }));
    }

    // Resetar estado
    setTimerState({
      isActive: false,
      currentActivity: '',
      currentSubtopicKey: '',
      currentActivityType: null,
      savedTime: 0
    });

    // Esconder timer global
    (window as any).hideGlobalTimer?.();
  }, [timerState]);

  const pauseCurrentActivity = React.useCallback(() => {
    // Apenas pausar - NÃO salvar tempo ainda
    setTimerState(prev => ({
      ...prev,
      isActive: false
    }));
  }, [timerState]);

  const resumeCurrentActivity = React.useCallback(() => {
    if (!timerState.isActive && timerState.currentSubtopicKey && timerState.currentActivityType) {
      setTimerState(prev => ({
        ...prev,
        isActive: true
      }));
    }
  }, [timerState]);

  const stopCurrentActivity = React.useCallback(() => {
    setTimerState({
      isActive: false,
      currentActivity: '',
      currentSubtopicKey: '',
      currentActivityType: null,
      savedTime: 0
    });

    (window as any).hideGlobalTimer?.();
  }, []);

  const stopActivity = () => {
    stopCurrentActivity();
    (window as any).globalTimer?.stopTimer?.();
  };

  const getTotalTimeForSubtopic = (subtopicKey: string) => {
    const activities = activityTimers[subtopicKey];
    const baseTime = activities ? activities.documento + activities.flashcards + activities.questoes : 0;
    
    // Mostrar APENAS tempo salvo - não somar com sessão ativa
    return baseTime;
  };

  const getActivityTime = (subtopicKey: string, activity: 'documento' | 'flashcards' | 'questoes') => {
    const activities = activityTimers[subtopicKey];
    const time = activities?.[activity] || 0;
    
    // Mostrar APENAS tempo salvo da atividade - não somar com sessão ativa
    return time;
  };

  // Expor funções para o timer global
  React.useEffect(() => {
    (window as any).timerContext = {
      completeCurrentActivity,
      pauseCurrentActivity,
      resumeCurrentActivity,
      stopCurrentActivity
    };
  }, [completeCurrentActivity, pauseCurrentActivity, resumeCurrentActivity, stopCurrentActivity]);

  const value: TimerContextType = {
    timerState,
    activityTimers,
    startActivity,
    stopActivity,
    completeCurrentActivity,
    pauseCurrentActivity,
    resumeCurrentActivity,
    stopCurrentActivity,
    getTotalTimeForSubtopic,
    getActivityTime,
    getCurrentSessionTime
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
};

export default TimerProvider;