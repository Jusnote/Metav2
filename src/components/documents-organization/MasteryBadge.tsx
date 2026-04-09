import React from 'react';

// ============ Types ============

interface MasteryBadgeProps {
  stage: string;
  score: number;
}

// ============ Stage Config ============

interface StageStyle {
  label: string;
  bg: string;
  text: string;
}

const STAGES: Record<string, StageStyle> = {
  new: { label: 'Novo', bg: '#f0eef5', text: '#9e99ae' },
  learning: { label: 'Aprendendo', bg: '#f5f3ff', text: '#6c63ff' },
  consolidating: { label: 'Consolidando', bg: '#eeecfb', text: '#4f46e5' },
  maintaining: { label: 'Mantendo', bg: '#e8f5e9', text: '#2e7d32' },
  mastered: { label: 'Dominado', bg: '#e8f5e9', text: '#1b5e20' },
};

const DEFAULT_STYLE: StageStyle = { label: 'Desconhecido', bg: '#f0eef5', text: '#9e99ae' };

// ============ Component ============

export const MasteryBadge: React.FC<MasteryBadgeProps> = ({ stage, score }) => {
  const config = STAGES[stage] || DEFAULT_STYLE;
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Badge */}
      <span
        className="text-[9px] px-2 py-0.5 rounded-md font-semibold leading-none whitespace-nowrap"
        style={{ backgroundColor: config.bg, color: config.text }}
      >
        {config.label}
      </span>

      {/* Progress bar (only when score > 0) */}
      {clampedScore > 0 && (
        <div
          className="h-[2px] rounded-full"
          style={{ maxWidth: 40, width: 40, backgroundColor: config.bg }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${clampedScore}%`,
              backgroundColor: config.text,
            }}
          />
        </div>
      )}
    </div>
  );
};
