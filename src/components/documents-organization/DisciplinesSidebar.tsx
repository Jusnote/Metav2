import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { Disciplina } from '@/hooks/useDisciplinasManager';

// Palette of discipline border colors
const DISCIPLINE_COLORS = [
  '#2563EB', // blue
  '#7C3AED', // violet
  '#059669', // emerald
  '#D97706', // amber
  '#DC2626', // red
  '#0891B2', // cyan
  '#C026D3', // fuchsia
  '#4F46E5', // indigo
  '#EA580C', // orange
  '#65A30D', // lime
];

export function getDisciplineColor(index: number): string {
  return DISCIPLINE_COLORS[index % DISCIPLINE_COLORS.length];
}

interface DisciplinesSidebarProps {
  disciplinas: Disciplina[];
  selectedDisciplinaId: string | null;
  onSelectDisciplina: (disciplinaId: string) => void;
  onBack?: () => void;
  className?: string;
}

export const DisciplinesSidebar: React.FC<DisciplinesSidebarProps> = ({
  disciplinas,
  selectedDisciplinaId,
  onSelectDisciplina,
  className = '',
}) => {
  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Disciplinas
        </h2>
      </div>

      {/* Discipline list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {disciplinas.map((disciplina, index) => {
          const color = getDisciplineColor(index);
          const isSelected = selectedDisciplinaId === disciplina.id;
          const topicoCount = disciplina.topicos.length;

          // Calculate total estimated time across all topicos/subtopicos
          const totalMinutes = disciplina.topicos.reduce((acc, topico) => {
            if (topico.subtopicos && topico.subtopicos.length > 0) {
              return acc + topico.subtopicos.reduce((sub, st) => sub + (st.estimated_duration_minutes || 0), 0);
            }
            return acc + (topico.estimated_duration_minutes || 0);
          }, 0);
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const timeLabel = totalMinutes > 0
            ? hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`
            : '';

          // Calculate completion progress
          const allSubtopicos = disciplina.topicos.flatMap(t => t.subtopicos || []);
          const completedCount = allSubtopicos.filter(s => s.status === 'completed').length;
          const totalItems = allSubtopicos.length || disciplina.topicos.length;
          const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

          return (
            <button
              key={disciplina.id}
              onClick={() => onSelectDisciplina(disciplina.id)}
              className={`
                group w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left
                transition-all duration-200 relative
                ${isSelected
                  ? 'bg-accent/80 shadow-sm'
                  : 'hover:bg-accent/40'
                }
              `}
            >
              {/* Colored left border */}
              <div
                className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all duration-200 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                }`}
                style={{ backgroundColor: color }}
              />

              {/* Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{
                  backgroundColor: `${color}18`,
                }}
              >
                <BookOpen
                  className="w-4 h-4"
                  style={{ color }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate transition-colors ${
                  isSelected ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
                }`}>
                  {disciplina.nome}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    {topicoCount} {topicoCount === 1 ? 'topico' : 'topicos'}
                  </span>
                  {timeLabel && (
                    <>
                      <span className="text-muted-foreground/40 text-[10px]">&#183;</span>
                      <span className="text-[11px] text-muted-foreground">{timeLabel}</span>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                {totalItems > 0 && (
                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: color,
                        opacity: progressPercent > 0 ? 1 : 0,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Arrow */}
              <ChevronRight className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                isSelected
                  ? 'text-foreground/60 translate-x-0'
                  : 'text-muted-foreground/30 -translate-x-1 group-hover:translate-x-0 group-hover:text-muted-foreground/60'
              }`} />
            </button>
          );
        })}

        {disciplinas.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma disciplina</p>
          </div>
        )}
      </div>
    </div>
  );
};
