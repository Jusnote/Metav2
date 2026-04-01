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
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Cores: amber para progresso, emerald para 100%, vermelho para sobrecarga
  const getColors = () => {
    if (progress === 100) {
      return {
        trackColor: 'transparent',
        progressColor: '#10b981',   // emerald-500 — conquista
      };
    }

    if (loadPercentage > 100) {
      return {
        trackColor: '#f87171',      // red-400 — sobrecarga
        progressColor: '#E8930C',    // amber brand
      };
    }
    if (loadPercentage >= 80) {
      return {
        trackColor: '#fde68a',       // amber-200 — alerta
        progressColor: '#E8930C',    // amber brand
      };
    }

    return {
      trackColor: hasException ? '#a1a1aa' : '#d4d4d8', // zinc-400/zinc-300 track
      progressColor: '#E8930C',     // amber brand
    };
  };

  const colors = getColors();
  const hasTasks = progress > 0 || loadPercentage > 0;

  const getTooltip = () => {
    const parts: string[] = [];
    if (hasException && exceptionHours !== undefined) {
      parts.push(`${exceptionHours}h customizado`);
    }
    if (loadPercentage > 100) {
      parts.push(`Sobrecarregado (${loadPercentage.toFixed(0)}%)`);
    } else if (loadPercentage >= 80) {
      parts.push(`Próximo do limite (${loadPercentage.toFixed(0)}%)`);
    }
    if (progress > 0) {
      parts.push(`${progress}% concluído`);
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  if (isEmpty) {
    return <div className="h-8 w-8" />;
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
        {/* Track circle — only show if day has tasks */}
        {hasTasks && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke={colors.trackColor}
            strokeWidth="2.5"
            strokeDasharray={hasException ? "2 2" : "0"}
            fill="transparent"
            opacity={0.4}
            className="transition-all duration-300"
          />
        )}

        {/* Progress fill */}
        {progress > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke={colors.progressColor}
            strokeWidth="2.5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-500 ease-out ${progress === 100 ? 'drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]' : ''}`}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Day Number */}
      <div className={`
        relative z-10 text-[11px] font-medium transition-all duration-200
        ${isSelected
          ? 'text-white bg-[#E8930C] rounded-full w-[22px] h-[22px] flex items-center justify-center font-semibold shadow-[0_0_0_2px_rgba(232,147,12,0.2)]'
          : isToday
            ? 'text-zinc-800 font-bold'
            : hasTasks
              ? 'text-zinc-700'
              : 'text-zinc-400'
        }
        ${!isSelected && 'group-hover:text-zinc-900'}
      `}>
        {day}
      </div>

      {/* Today dot */}
      {isToday && !isSelected && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-[#E8930C]" />
      )}
    </div>
  );
}
