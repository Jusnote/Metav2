import React, { useState } from 'react';
import { ChevronRight, BookOpen, Clock, Calendar, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { TopicSubtopicInlineEditor } from './TopicSubtopicInlineEditor';
import { QuickSchedulePopover } from './QuickSchedulePopover';
import { TopicScheduleDrawer } from './TopicScheduleDrawer';
import { useTopicoProgress } from '../hooks/useHierarchyProgress';
import { useManualSchedule } from '../hooks/useManualSchedule';
import type { Topico } from '../hooks/useDisciplinasManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopicItemProps {
  topico: Topico;
  disciplinaId: string;
  isExpanded: boolean;
  isSelected: boolean;
  isEditMode: boolean;
  isEditing: boolean;
  hasSubtopicos: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (newTitle: string, estimatedDuration?: number) => Promise<void>;
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
}

export const TopicItem: React.FC<TopicItemProps> = ({
  topico,
  disciplinaId,
  isExpanded,
  isSelected,
  isEditMode,
  isEditing,
  hasSubtopicos,
  onToggleExpand,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  children
}) => {
  const progress = useTopicoProgress(topico);
  const { createManualSchedule } = useManualSchedule();
  const [isMobile, setIsMobile] = useState(false);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);

  // Detectar se e mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = () => {
    if (hasSubtopicos || isEditMode) {
      onToggleExpand();
    } else {
      onSelect();
    }
  };

  // Agendar topico sem subtopicos
  const handleSchedule = async (data: {
    date: Date;
    durationMinutes: number;
    topicoId?: string;
    subtopicoId?: string;
  }) => {
    await createManualSchedule({
      date: data.date,
      durationMinutes: data.durationMinutes,
      topicoId: topico.id,
      subtopicoId: undefined,
      title: topico.nome,
    });
  };

  // Agendar um subtopico especifico (do modal de selecao)
  const handleScheduleSubtopico = async (data: {
    date: Date;
    durationMinutes: number;
    subtopicId: string;
    title: string;
  }) => {
    await createManualSchedule({
      date: data.date,
      durationMinutes: data.durationMinutes,
      topicoId: topico.id,
      subtopicoId: data.subtopicId,
      title: data.title,
    });
  };

  // Distribuir todos os subtopicos automaticamente
  const handleDistributeAll = async (data: {
    subtopics: any[];
    startDate: Date;
    endDate: Date;
  }) => {
    // TODO: Implementar logica de distribuicao sequencial
    // Por enquanto, vamos agendar um por dia sequencialmente
    let currentDate = new Date(data.startDate);

    for (const subtopico of data.subtopics) {
      await createManualSchedule({
        date: currentDate,
        durationMinutes: subtopico.estimated_duration_minutes || 90,
        topicoId: topico.id,
        subtopicoId: subtopico.id,
        title: subtopico.nome,
      });

      // Proximo dia
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);

      // Se ultrapassou a data final, para
      if (currentDate > data.endDate) break;
    }
  };

  return (
    <div className="mb-1 relative">
      {/* Topico Header - SEM linhas horizontais */}
      <div className="group">
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150 border-l-2 ${
            isSelected ? 'bg-zinc-200/50 border-[#2563EB] font-medium' : 'border-transparent hover:bg-zinc-100/40'
          }`}
        >
          {/* Chevron */}
          <div className="shrink-0">
            {hasSubtopicos || isEditMode ? (
              <ChevronRight
                className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            ) : (
              <div className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Schedule Button - cresce em hover, empurrando o icone */}
          {!isEditing && (
            <>
              {/* Topico COM subtopicos: Abrir drawer unificado */}
              {hasSubtopicos ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowScheduleDrawer(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      setShowScheduleDrawer(true);
                    }
                  }}
                  className="overflow-hidden transition-all duration-200 ease-in-out w-0 opacity-0 group-hover:w-5 group-hover:opacity-100 group-hover:mr-1 shrink-0 p-0.5 hover:bg-zinc-100/50 rounded cursor-pointer"
                  title="Agendar subtopicos"
                >
                  <Calendar className="w-4 h-4 text-zinc-500" />
                </div>
              ) : (
                /* Topico SEM subtopicos: Agendamento direto */
                <QuickSchedulePopover
                  topicoId={topico.id}
                  title={topico.nome}
                  estimatedMinutes={topico.estimated_duration_minutes || 120}
                  onSchedule={handleSchedule}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                      }
                    }}
                    className="overflow-hidden transition-all duration-200 ease-in-out w-0 opacity-0 group-hover:w-5 group-hover:opacity-100 group-hover:mr-1 shrink-0 p-0.5 hover:bg-zinc-100/50 rounded cursor-pointer"
                    title="Agendar estudo"
                  >
                    <Calendar className="w-4 h-4 text-zinc-500" />
                  </div>
                </QuickSchedulePopover>
              )}
            </>
          )}

          {/* Icone */}
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
            hasSubtopicos ? 'bg-zinc-200 dark:bg-zinc-700' : 'bg-gray-100'
          }`}>
            <BookOpen className={`w-3.5 h-3.5 ${hasSubtopicos ? 'text-zinc-500' : 'text-gray-600'}`} />
          </div>

          {/* Conteudo */}
          <div className="flex-1 min-w-0 text-left">
            {isEditing ? (
              <TopicSubtopicInlineEditor
                value={topico.nome}
                estimatedDuration={topico.estimated_duration_minutes || 120}
                isEditing={true}
                onSave={async (newTitle, newDuration) => {
                  await onSave(newTitle, newDuration);
                }}
                onCancel={onCancelEdit}
                className="font-medium text-gray-800 text-sm"
                showDurationInput={true}
                isCalculated={hasSubtopicos}
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm truncate">
                    {topico.nome}
                  </span>
                  {/* Contagem inline */}
                  {hasSubtopicos && topico.subtopicos && topico.subtopicos.length > 0 && (
                    <span className="text-xs text-gray-400">
                      ({topico.subtopicos.length})
                    </span>
                  )}
                  {/* Tempo estimado (discreto) */}
                  {topico.estimated_duration_minutes && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {Math.floor(topico.estimated_duration_minutes / 60)}h{topico.estimated_duration_minutes % 60 > 0 ? ` ${topico.estimated_duration_minutes % 60}m` : ''}
                    </span>
                  )}
                </div>
                {/* Progress inline */}
                {hasSubtopicos && progress.total > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-0.5 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className="h-full bg-zinc-500 transition-all duration-300"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Edit/Delete Buttons (Edit Mode only) */}
          {!isEditing && isEditMode && (
            <>
              {/* Desktop: Hover buttons */}
              {!isMobile && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onEdit();
                      }
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                    title="Editar topico"
                  >
                    <Edit3 className="w-3 h-3 text-gray-600" />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onDelete();
                      }
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-colors cursor-pointer"
                    title="Deletar topico"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </div>
                </div>
              )}

              {/* Mobile: Dropdown menu */}
              {isMobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                        }
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0 cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </button>
      </div>

      {/* Children (Subtopicos) */}
      {isExpanded && (hasSubtopicos || isEditMode) && (
        <div className="mt-1 ml-2 pl-3 border-l border-zinc-200/30 dark:border-zinc-700/30">
          <div className="space-y-0.5">
            {children}
          </div>
        </div>
      )}

      {/* Drawer unificado para agendamento de subtopicos */}
      {hasSubtopicos && (
        <TopicScheduleDrawer
          open={showScheduleDrawer}
          onOpenChange={setShowScheduleDrawer}
          topicoId={topico.id}
          topicoTitle={topico.nome}
          subtopics={topico.subtopicos || []}
          onScheduleSubtopico={handleScheduleSubtopico}
          onDistributeAll={handleDistributeAll}
        />
      )}
    </div>
  );
};
