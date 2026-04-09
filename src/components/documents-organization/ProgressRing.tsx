interface ProgressRingProps {
  value: number;
  max: number;
  color: string;  // e.g., "#6c63ff"
  size?: number;  // default 44
  label: string;  // e.g., "Estudo"
}

export function ProgressRing({ value, max, color, size = 44, label }: ProgressRingProps) {
  const radius = (size / 2) - 4;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? value / max : 0;
  const dashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-[3px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#eeecfb" strokeWidth={3}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700 ease-out"
        />
        {/* Center text */}
        <text
          x={size / 2} y={size / 2 + 1}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fontWeight={700}
          fill={progress >= 1 ? color : '#1a1625'}
        >
          {value}/{max}
        </text>
      </svg>
      <span className="text-[9px] text-[#9e99ae] font-medium">{label}</span>
    </div>
  );
}
