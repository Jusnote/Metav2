import React from 'react';

interface DayWithProgressProps {
  day: number;
  progress: number; // 0-100
  isSelected?: boolean;
  isToday?: boolean;
  isEmpty?: boolean;
  onClick?: () => void;
}

export function DayWithProgress({ 
  day, 
  progress, 
  isSelected = false, 
  isToday = false,
  isEmpty = false,
  onClick 
}: DayWithProgressProps) {
  // Calcular o stroke-dasharray para o círculo de progresso
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (isEmpty) {
    return <div className="h-8 w-8"></div>;
  }

  return (
    <div 
      className="relative h-8 w-8 flex items-center justify-center cursor-pointer"
      onClick={onClick}
    >
      {/* SVG Progress Ring */}
      <svg 
        className="absolute inset-0 w-8 h-8 transform -rotate-90"
        viewBox="0 0 32 32"
      >
        {/* Background circle */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="2"
          fill="transparent"
        />
        
        {/* Progress circle */}
        {progress > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke={progress === 100 ? "#10b981" : "#3b82f6"}
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
