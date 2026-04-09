import React from 'react';

// ============ Types ============

type DotStatus = 'completed' | 'partial' | 'none';

interface ProgressDotsProps {
  estudo: DotStatus;
  revisao: DotStatus;
  questoes: DotStatus;
  leiSeca: DotStatus;
  size?: 'sm' | 'md';
}

// ============ Color Map ============

const DOT_COLORS: Record<DotStatus, string> = {
  completed: '#6c63ff',
  partial: '#9b8afb',
  none: '#eeecfb',
};

// ============ Utility ============

/**
 * Maps a topico's fields to ProgressDots status values.
 * Accepts any object with optional progress-related fields.
 */
export function calculateProgressDots(topico: {
  estudoConcluido?: boolean;
  estudoParcial?: boolean;
  revisaoConcluida?: boolean;
  revisaoParcial?: boolean;
  questoesConcluidas?: boolean;
  questoesParcial?: boolean;
  leiSecaConcluida?: boolean;
  leiSecaParcial?: boolean;
}): {
  estudo: DotStatus;
  revisao: DotStatus;
  questoes: DotStatus;
  leiSeca: DotStatus;
} {
  const resolve = (done?: boolean, partial?: boolean): DotStatus => {
    if (done) return 'completed';
    if (partial) return 'partial';
    return 'none';
  };

  return {
    estudo: resolve(topico.estudoConcluido, topico.estudoParcial),
    revisao: resolve(topico.revisaoConcluida, topico.revisaoParcial),
    questoes: resolve(topico.questoesConcluidas, topico.questoesParcial),
    leiSeca: resolve(topico.leiSecaConcluida, topico.leiSecaParcial),
  };
}

// ============ Component ============

export const ProgressDots: React.FC<ProgressDotsProps> = ({
  estudo,
  revisao,
  questoes,
  leiSeca,
  size = 'sm',
}) => {
  const dotSize = size === 'sm' ? 5 : 7;
  const dots: DotStatus[] = [estudo, revisao, questoes, leiSeca];

  return (
    <div
      className="inline-flex items-center"
      style={{ gap: 2 }}
      title="Estudo \u00B7 Revis\u00E3o \u00B7 Quest\u00F5es \u00B7 Lei Seca"
    >
      {dots.map((status, i) => (
        <div
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: 1,
            backgroundColor: DOT_COLORS[status],
            transition: 'background-color 0.2s ease',
          }}
        />
      ))}
    </div>
  );
};
