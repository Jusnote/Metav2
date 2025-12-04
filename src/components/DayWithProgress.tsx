interface DayWithProgressProps {
  day: number;
  progress: number; // 0-100
  isSelected?: boolean;
  isToday?: boolean;
  isEmpty?: boolean;
  onClick?: () => void;
  hasException?: boolean;
  exceptionHours?: number;
  loadPercentage?: number; // % de carga do dia (horas agendadas / horas disponíveis)
}

export function DayWithProgress({
  day,
  progress,
  isSelected = false,
  isToday = false,
  isEmpty = false,
  onClick,
  hasException = false,
  exceptionHours,
  loadPercentage = 0
}: DayWithProgressProps) {
  // Calcular o stroke-dasharray para o círculo de progresso
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determinar cores baseado na carga do dia
  const getLoadColors = () => {
    // Se completou 100%, tudo fica VERDE (vitória!)
    if (progress === 100) {
      return {
        borderColor: '#10b981',     // Verde (celebração)
        progressColor: '#10b981',    // Verde
      };
    }

    // Durante o progresso: borda indica carga, progress sempre azul
    if (loadPercentage > 100) {
      return {
        borderColor: '#f87171',      // Vermelho vibrante mas suave (sobrecarga)
        progressColor: '#3b82f6',     // Azul (progresso normal)
      };
    }
    if (loadPercentage >= 80) {
      return {
        borderColor: '#fde68a',       // Amarelo clarinho (alerta)
        progressColor: '#3b82f6',     // Azul (progresso normal)
      };
    }

    // Normal: cinza/tracejado + azul
    return {
      borderColor: hasException ? '#9ca3af' : '#e5e7eb', // Cinza (tracejado se tem exceção)
      progressColor: '#3b82f6',     // Azul (progresso)
    };
  };

  const colors = getLoadColors();

  // Tooltip informativo baseado na carga
  const getTooltip = () => {
    const parts: string[] = [];

    // Adicionar informação de exceção
    if (hasException && exceptionHours !== undefined) {
      parts.push(`${exceptionHours}h customizado`);
    }

    // Adicionar informação de carga
    if (loadPercentage > 100) {
      parts.push(`🔴 SOBRECARREGADO (${loadPercentage.toFixed(0)}%)`);
    } else if (loadPercentage >= 80) {
      parts.push(`⚠️ Próximo do limite (${loadPercentage.toFixed(0)}%)`);
    }

    return parts.length > 0 ? parts.join(' | ') : undefined;
  };

  if (isEmpty) {
    return <div className="h-8 w-8"></div>;
  }

  return (
    <div
      className="relative h-8 w-8 flex items-center justify-center cursor-pointer group"
      onClick={onClick}
      title={getTooltip()}
    >
      {/* SVG Progress Ring */}
      <svg
        className="absolute inset-0 w-8 h-8 transform -rotate-90"
        viewBox="0 0 32 32"
      >
        {/* Background circle - com borda tracejada se tiver exceção */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          stroke={colors.borderColor}
          strokeWidth="2"
          strokeDasharray={hasException ? "2 2" : "0"}
          fill="transparent"
          className="transition-all duration-300"
        />

        {/* Progress circle */}
        {progress > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke={colors.progressColor}
            strokeWidth="2"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-in-out"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Day Number */}
      <div className={`
        relative z-10 text-sm font-medium transition-colors
        ${isSelected
          ? 'text-white bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center'
          : isToday
            ? 'text-blue-600 font-bold'
            : 'text-gray-700'
        }
        ${!isSelected && 'hover:text-blue-600'}
      `}>
        {day}
      </div>
    </div>
  );
}
