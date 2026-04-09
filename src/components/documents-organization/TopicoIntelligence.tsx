import React from 'react';

// ============ Types ============

export interface IntelligenceData {
  subtopicosFrequentes: Array<{ nome: string; frequencia: number }>;
  editaisQueCobram: Array<{ nome: string; sigla: string }>;
  legislacao: Array<{ referencia: string }>;
  bancas: string[];
  frequenciaProvas: number;
  rankingEdital: { posicao: number; total: number };
}

interface TopicoIntelligenceProps {
  data: IntelligenceData | null;
  isLoading: boolean;
}

// ============ Shimmer Skeleton ============

function ShimmerBlock({ width, height }: { width: string; height: string }) {
  return (
    <div
      className="rounded animate-pulse"
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, #eeecfb 25%, #f5f3ff 50%, #eeecfb 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="rounded-xl border p-4 space-y-4"
      style={{
        background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)',
        borderColor: '#eeecfb',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {/* Title skeleton */}
      <ShimmerBlock width="120px" height="12px" />
      {/* Bars skeleton */}
      <div className="space-y-2">
        <ShimmerBlock width="100%" height="20px" />
        <ShimmerBlock width="85%" height="20px" />
        <ShimmerBlock width="70%" height="20px" />
      </div>
      {/* Badges skeleton */}
      <div className="flex gap-1.5">
        <ShimmerBlock width="50px" height="18px" />
        <ShimmerBlock width="60px" height="18px" />
        <ShimmerBlock width="45px" height="18px" />
      </div>
      {/* Stats skeleton */}
      <ShimmerBlock width="140px" height="10px" />
    </div>
  );
}

// ============ Frequency Bar ============

function FrequencyBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="space-y-[2px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#6b667a] leading-none truncate mr-2">{label}</span>
        <span className="text-[10px] font-bold text-[#1a1625] leading-none shrink-0">{percent}%</span>
      </div>
      <div className="w-full h-[3px] rounded-full bg-[#eeecfb]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: 'linear-gradient(90deg, #6c63ff, #9b8afb)',
          }}
        />
      </div>
    </div>
  );
}

// ============ Main Component ============

export const TopicoIntelligence: React.FC<TopicoIntelligenceProps> = ({ data, isLoading }) => {
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  const topSubtopicos = data.subtopicosFrequentes.slice(0, 4);
  const maxFreq = Math.max(...topSubtopicos.map((s) => s.frequencia), 1);

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)',
        borderColor: '#eeecfb',
      }}
    >
      {/* O que mais cai */}
      {topSubtopicos.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-[#4f46e5] uppercase tracking-wide mb-2">
            O que mais cai
          </h5>
          <div className="space-y-1.5">
            {topSubtopicos.map((sub) => (
              <FrequencyBar
                key={sub.nome}
                label={sub.nome}
                percent={Math.round((sub.frequencia / maxFreq) * 100)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Editais que cobram */}
      {data.editaisQueCobram.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-[#4f46e5] uppercase tracking-wide mb-1.5">
            Editais que cobram
          </h5>
          <div className="flex flex-wrap gap-1">
            {data.editaisQueCobram.map((edital) => (
              <span
                key={edital.sigla}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-white"
                style={{ backgroundColor: '#6c63ff' }}
                title={edital.nome}
              >
                {edital.sigla}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Legislacao */}
      {data.legislacao.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-[#4f46e5] uppercase tracking-wide mb-1.5">
            Legislacao
          </h5>
          <div className="flex flex-wrap gap-1">
            {data.legislacao.map((lei) => (
              <span
                key={lei.referencia}
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-white text-[9px] font-medium"
                style={{ borderWidth: 1, borderColor: '#eeecfb', color: '#4f46e5' }}
              >
                {lei.referencia}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bancas */}
      {data.bancas.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-[#4f46e5] uppercase tracking-wide mb-1.5">
            Bancas
          </h5>
          <div className="flex flex-wrap gap-1">
            {data.bancas.map((banca) => (
              <span
                key={banca}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ backgroundColor: '#eeecfb', color: '#4f46e5' }}
              >
                {banca}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats line */}
      <div className="pt-1 border-t" style={{ borderColor: '#eeecfb' }}>
        <span className="text-[10px] font-medium" style={{ color: '#9b8afb' }}>
          {data.frequenciaProvas}% das provas
          {' \u00B7 '}
          #{data.rankingEdital.posicao}/{data.rankingEdital.total}
        </span>
      </div>
    </div>
  );
};
