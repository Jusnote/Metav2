interface Props {
  score: number;  // 0-100
  targetScore?: number;  // e.g., 80
  trend?: number;  // e.g., +4
}

export function BasicScoreDisplay({ score, targetScore, trend }: Props) {
  const gap = targetScore ? targetScore - score : null;

  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-[#f5f3ff] border border-[#eeecfb] rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold bg-gradient-to-r from-[#4f46e5] to-[#9b8afb] bg-clip-text text-transparent">
          {score.toFixed(0)}
        </span>
        <span className="text-[10px] text-[#c8c5d0]">/100</span>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-[10px] font-semibold ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>
      {gap !== null && gap > 0 && (
        <span className="text-[9px] text-[#9e99ae]">
          Meta: {targetScore} · Faltam {gap.toFixed(0)}
        </span>
      )}
    </div>
  );
}
