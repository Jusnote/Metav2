import React from 'react';

interface ProgressBarProps {
  percentage: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'gray';
  showLabel?: boolean;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  size = 'sm',
  color = 'blue',
  showLabel = false,
  animated = true
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  const sizeClasses = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    blue: {
      bg: 'bg-blue-200',
      fill: 'bg-blue-600'
    },
    green: {
      bg: 'bg-green-200',
      fill: 'bg-green-600'
    },
    purple: {
      bg: 'bg-purple-200',
      fill: 'bg-purple-600'
    },
    orange: {
      bg: 'bg-orange-200',
      fill: 'bg-orange-600'
    },
    gray: {
      bg: 'bg-gray-200',
      fill: 'bg-gray-600'
    }
  };

  const { bg, fill } = colorClasses[color];

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">Progresso</span>
          <span className="text-xs font-semibold text-gray-900">{clampedPercentage}%</span>
        </div>
      )}
      <div className={`w-full ${bg} rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full ${fill} rounded-full ${animated ? 'transition-all duration-500 ease-out' : ''}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
};

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'gray';
  showLabel?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 40,
  strokeWidth = 4,
  color = 'blue',
  showLabel = true
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedPercentage / 100) * circumference;

  const colorMap = {
    blue: '#2563eb',
    green: '#16a34a',
    purple: '#9333ea',
    orange: '#ea580c',
    gray: '#4b5563'
  };

  const strokeColor = colorMap[color];

  return (
    <div className="inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute text-xs font-bold" style={{ color: strokeColor }}>
          {Math.round(clampedPercentage)}%
        </div>
      )}
    </div>
  );
};
