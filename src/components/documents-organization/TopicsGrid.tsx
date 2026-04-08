import React from 'react';
import { CheckCircle2, Circle, FileText, HelpCircle, Star, ArrowLeft } from 'lucide-react';
import type { Disciplina, Topico, Subtopico } from '@/hooks/useDisciplinasManager';
import { getDisciplineColor } from './DisciplinesSidebar';

interface TopicsGridProps {
  disciplina: Disciplina;
  disciplinaIndex: number;
  disciplinas?: Disciplina[];
  onTopicoClick: (disciplinaId: string, topico: Topico) => void;
  onSubtopicoClick: (disciplinaId: string, topicoId: string, subtopico: Subtopico) => void;
  onBack?: () => void;
  selectedTopicoId?: string | null;
  selectedSubtopicoId?: string | null;
}

function getMasteryStars(subtopico: Subtopico): number {
  // Simple heuristic: completed = 3 stars, in-progress = 1-2, not-started = 0
  if (subtopico.status === 'completed') return 3;
  if (subtopico.status === 'in-progress') return 2;
  return 0;
}

function getTopicoCompletion(topico: Topico): { completed: number; total: number; status: 'completed' | 'in-progress' | 'not-started' } {
  if (!topico.subtopicos || topico.subtopicos.length === 0) {
    return { completed: 0, total: 0, status: 'not-started' };
  }
  const completed = topico.subtopicos.filter(s => s.status === 'completed').length;
  const total = topico.subtopicos.length;
  const inProgress = topico.subtopicos.some(s => s.status === 'in-progress');

  return {
    completed,
    total,
    status: completed === total ? 'completed' : inProgress || completed > 0 ? 'in-progress' : 'not-started',
  };
}

function StatusIcon({ status }: { status: 'completed' | 'in-progress' | 'not-started' }) {
  if (status === 'completed') {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      </div>
    );
  }
  if (status === 'in-progress') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-blue-400 flex items-center justify-center shrink-0">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-300 shrink-0" />
  );
}

function StarDots({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

export const TopicsGrid: React.FC<TopicsGridProps> = ({
  disciplina,
  disciplinaIndex,
  onTopicoClick,
  onSubtopicoClick,
  onBack,
  selectedTopicoId,
  selectedSubtopicoId,
}) => {
  const color = getDisciplineColor(disciplinaIndex);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {disciplina.nome}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {disciplina.topicos.length} {disciplina.topicos.length === 1 ? 'topico' : 'topicos'}
            </p>
          </div>
        </div>
      </div>

      {/* Topicos list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {disciplina.topicos.map((topico) => {
          const completion = getTopicoCompletion(topico);
          const hasSubtopicos = topico.subtopicos && topico.subtopicos.length > 0;
          const isTopicoSelected = selectedTopicoId === topico.id;

          return (
            <div key={topico.id} className="space-y-2">
              {/* Topico header card */}
              <button
                onClick={() => {
                  if (!hasSubtopicos) {
                    onTopicoClick(disciplina.id, topico);
                  }
                }}
                className={`
                  w-full text-left rounded-xl border px-4 py-3 transition-all duration-200
                  ${!hasSubtopicos ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : 'cursor-default'}
                  ${isTopicoSelected && !hasSubtopicos ? 'border-blue-300 bg-blue-50/50 shadow-sm' : 'border-border bg-card'}
                `}
              >
                <div className="flex items-center gap-3">
                  {!hasSubtopicos && (
                    <StatusIcon status={completion.status} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold text-foreground truncate ${hasSubtopicos ? '' : ''}`}>
                        {topico.nome}
                      </h3>
                    </div>
                    {hasSubtopicos && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {completion.completed}/{completion.total} concluidos
                      </p>
                    )}
                    {!hasSubtopicos && topico.estimated_duration_minutes ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {topico.estimated_duration_minutes >= 60
                          ? `${Math.floor(topico.estimated_duration_minutes / 60)}h ${topico.estimated_duration_minutes % 60 > 0 ? `${topico.estimated_duration_minutes % 60}m` : ''}`
                          : `${topico.estimated_duration_minutes}m`
                        }
                      </p>
                    ) : null}
                  </div>

                  {/* Topico progress ring for topicos with subtopicos */}
                  {hasSubtopicos && completion.total > 0 && (
                    <div className="shrink-0 relative w-8 h-8">
                      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                        <circle
                          cx="16" cy="16" r="12"
                          fill="none" stroke="currentColor"
                          className="text-gray-100"
                          strokeWidth="3"
                        />
                        <circle
                          cx="16" cy="16" r="12"
                          fill="none"
                          stroke={color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${(completion.completed / completion.total) * 75.4} 75.4`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground">
                        {Math.round((completion.completed / completion.total) * 100)}
                      </span>
                    </div>
                  )}
                </div>
              </button>

              {/* Subtopicos */}
              {hasSubtopicos && (
                <div className="ml-3 space-y-1.5">
                  {topico.subtopicos!.map((subtopico) => {
                    const stars = getMasteryStars(subtopico);
                    const isSubSelected = selectedSubtopicoId === subtopico.id;

                    return (
                      <button
                        key={subtopico.id}
                        onClick={() => onSubtopicoClick(disciplina.id, topico.id, subtopico)}
                        className={`
                          w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all duration-200 group
                          ${isSubSelected
                            ? 'bg-accent shadow-sm ring-1 ring-border'
                            : 'hover:bg-accent/60'
                          }
                        `}
                      >
                        <StatusIcon status={subtopico.status} />

                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate group-hover:text-foreground/90">
                            {subtopico.nome}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {subtopico.resumosVinculados > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <FileText className="w-3 h-3" />
                                {subtopico.resumosVinculados}
                              </span>
                            )}
                            {subtopico.questoesVinculadas > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <HelpCircle className="w-3 h-3" />
                                {subtopico.questoesVinculadas}
                              </span>
                            )}
                          </div>
                        </div>

                        {stars > 0 && (
                          <div className="shrink-0">
                            <StarDots count={stars} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {disciplina.topicos.length === 0 && (
          <div className="py-12 text-center">
            <Circle className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum topico nesta disciplina</p>
          </div>
        )}
      </div>
    </div>
  );
};
