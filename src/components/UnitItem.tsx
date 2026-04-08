import React from 'react';
import { ChevronRight, Edit3, Trash2, Package, Clock } from 'lucide-react';
import { InlineEditor } from './InlineEditor';
import type { Disciplina } from '../hooks/useDisciplinasManager';

interface UnitItemProps {
  disciplina: Disciplina;
  isExpanded: boolean;
  isEditMode: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
}

export const UnitItem: React.FC<UnitItemProps> = ({
  disciplina,
  isExpanded,
  isEditMode,
  isEditing,
  onToggleExpand,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  children
}) => {
  const hasTopicos = disciplina.topicos.length > 0;

  // Calculate total duration for the disciplina
  const calculateDisciplinaDuration = (): number => {
    return disciplina.topicos.reduce((total, topico) => {
      // If topico has subtopicos, sum their durations
      if (topico.subtopicos && topico.subtopicos.length > 0) {
        return total + topico.subtopicos.reduce((subtotal, subtopico) => {
          return subtotal + (subtopico.estimated_duration_minutes || 90);
        }, 0);
      }
      // If topico has no subtopicos, use its manual duration
      return total + (topico.estimated_duration_minutes || 120);
    }, 0);
  };

  const totalDuration = calculateDisciplinaDuration();

  return (
    <div className="mb-4">
      {/* Disciplina Header - Container Fino */}
      <div className="group relative">
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-100/40 hover:bg-zinc-100/60 transition-all duration-200"
        >
          {/* Chevron */}
          <div className="shrink-0">
            {hasTopicos || isEditMode ? (
              <ChevronRight
                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>

          {/* Icone da Disciplina */}
          <div className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
            <Package className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          </div>

          {/* Conteudo */}
          <div className="flex-1 min-w-0 text-left">
            {isEditing ? (
              <InlineEditor
                value={disciplina.nome}
                isEditing={true}
                onSave={onSave}
                onCancel={onCancelEdit}
                className="font-semibold text-gray-900 text-sm"
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm truncate">
                    {disciplina.nome}
                  </span>
                  {/* Tempo total estimado (discreto) */}
                  {totalDuration > 0 && (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-0.5 font-medium tabular-nums">
                      <Clock className="w-3 h-3" />
                      {Math.floor(totalDuration / 60)}h{totalDuration % 60 > 0 ? ` ${totalDuration % 60}m` : ''}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          {isEditMode && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 hover:bg-zinc-200/60 rounded-md transition-colors"
                title="Editar disciplina"
              >
                <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 hover:bg-red-100 rounded-md transition-colors"
                title="Deletar disciplina"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
              </button>
            </div>
          )}
        </button>
      </div>

      {/* Children (Topicos) */}
      {isExpanded && (hasTopicos || isEditMode) && (
        <div className="mt-1.5 ml-2 pl-3 border-l border-zinc-200/40 dark:border-zinc-700/40">
          <div className="space-y-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
