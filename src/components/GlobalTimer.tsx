import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Minimize2, Maximize2, CheckCircle } from 'lucide-react';

interface GlobalTimerProps {
  isVisible: boolean;
  onTimeUpdate?: (seconds: number) => void;
  onActivityComplete?: () => void;
}

export const GlobalTimer: React.FC<GlobalTimerProps> = ({ 
  isVisible, 
  onTimeUpdate,
  onActivityComplete 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Formatar tempo em HH:MM:SS
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Iniciar timer
  const startTimer = () => {
    if (!isActive) {
      setIsActive(true);
      intervalRef.current = setInterval(() => {
        setTime(prevTime => {
          const newTime = prevTime + 1;
          // Remover onTimeUpdate para evitar contagem dupla
          // onTimeUpdate?.(newTime);
          return newTime;
        });
      }, 1000);
      
      // Notificar contexto sobre retomada
      (window as any).timerContext?.resumeCurrentActivity?.();
    }
  };

  // Pausar timer
  const pauseTimer = () => {
    if (isActive && intervalRef.current) {
      setIsActive(false);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      
      // Timer global pausado - contexto não precisa fazer nada especial
      (window as any).timerContext?.pauseCurrentActivity?.();
    }
  };

  // Parar timer
  const stopTimer = () => {
    setIsActive(false);
    setTime(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Notificar contexto sobre stop
    (window as any).timerContext?.stopCurrentActivity?.();
  };

  // Concluir atividade
  const completeActivity = () => {
    // Notificar conclusão antes de parar
    onActivityComplete?.();
    
    // Parar timer e resetar
    setIsActive(false);
    setTime(0);
    setCurrentActivity('');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Toggle play/pause
  const toggleTimer = () => {
    if (isActive) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Função para definir atividade atual e resetar timer
  const setActivity = (activity: string) => {
    setCurrentActivity(activity);
    setTime(0); // Resetar timer para nova sessão
  };

  // Expor função para componentes externos
  useEffect(() => {
    (window as any).globalTimer = {
      setActivity,
      startTimer,
      pauseTimer,
      stopTimer,
      completeActivity,
      getTime: () => time,
      getCurrentTime: () => time, // Fonte única de tempo
      isActive,
      isTimerActive: isActive
    };
  }, [time, isActive]);

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-gray-900 text-white shadow-2xl z-50 transition-all duration-300 ${
      isMinimized ? 'h-16' : 'h-20'
    }`}>
      {/* Barra principal do timer */}
      <div className="flex items-center justify-between h-full px-6">
        
        {/* Informações da atividade atual */}
        <div className="flex items-center gap-4 flex-1">
          {currentActivity && !isMinimized && (
            <>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                }`}></div>
                <span className="text-sm font-medium text-gray-300">Estudando:</span>
              </div>
              <span className="text-white font-medium truncate max-w-xs">
                {currentActivity}
              </span>
            </>
          )}
          
          {!currentActivity && !isMinimized && (
            <span className="text-gray-400 text-sm">
              Clique em uma atividade no cronograma para começar
            </span>
          )}
        </div>

        {/* Timer central */}
        <div className="flex items-center gap-4">
          <div className={`font-mono text-2xl font-bold ${
            isActive ? 'text-green-400' : 'text-white'
          }`}>
            {formatTime(time)}
          </div>

          {/* Controles do timer */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTimer}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                isActive 
                  ? 'bg-orange-500 hover:bg-orange-600' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
              title={isActive ? 'Pausar' : 'Iniciar'}
            >
              {isActive ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={stopTimer}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
              title="Parar e resetar"
            >
              <Square className="w-5 h-5 text-white" />
            </button>

            {/* Botão Concluir - só aparece se tem atividade ativa */}
            {currentActivity && (
              <button
                onClick={completeActivity}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 transition-colors font-medium"
                title="Concluir atividade"
              >
                <CheckCircle className="w-4 h-4 text-white" />
                <span className="text-sm text-white">Concluir</span>
              </button>
            )}
          </div>
        </div>

        {/* Controles de minimizar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-700 transition-colors"
            title={isMinimized ? 'Expandir' : 'Minimizar'}
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Barra de progresso sutil */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-700">
        <div 
          className={`h-full transition-colors duration-1000 ${
            isActive ? 'bg-green-400' : 'bg-gray-600'
          }`}
          style={{
            width: `${isActive ? '100%' : '0%'}`,
            transition: isActive ? 'none' : 'width 0.3s ease'
          }}
        />
      </div>
    </div>
  );
};

export default GlobalTimer;
