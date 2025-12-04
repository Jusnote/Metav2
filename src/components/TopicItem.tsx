import React, { useState } from 'react';
import { ChevronRight, BookOpen, Clock, Calendar, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { TopicSubtopicInlineEditor } from './TopicSubtopicInlineEditor';
import { QuickSchedulePopover } from './QuickSchedulePopover';
import { TopicScheduleDrawer } from './TopicScheduleDrawer';
import { useTopicProgress } from '../hooks/useHierarchyProgress';
import { useManualSchedule } from '../hooks/useManualSchedule';
import type { Topic } from '../hooks/useUnitsManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopicItemProps {
  topic: Topic;
  unitId: string;
  isExpanded: boolean;
  isSelected: boolean;
  isEditMode: boolean;
  isEditing: boolean;
  hasSubtopics: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (newTitle: string, estimatedDuration?: number) => Promise<void>;
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
}

export const TopicItem: React.FC<TopicItemProps> = ({
  topic,
  unitId,
  isExpanded,
  isSelected,
  isEditMode,
  isEditing,
  hasSubtopics,
  onToggleExpand,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  children
}) => {
  const progress = useTopicProgress(topic);
  const { createManualSchedule } = useManualSchedule();
  const [isMobile, setIsMobile] = useState(false);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);

  // Detectar se é mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = () => {
    if (hasSubtopics || isEditMode) {
      onToggleExpand();
    } else {
      onSelect();
    }
  };

  // Agendar tópico sem subtópicos
  const handleSchedule = async (data: {
    date: Date;
    durationMinutes: number;
    topicId?: string;
    subtopicId?: string;
  }) => {
    await createManualSchedule({
      date: data.date,
      durationMinutes: data.durationMinutes,
      topicId: topic.id,
      subtopicId: undefined,
      title: topic.title,
    });
  };

  // Agendar um subtópico específico (do modal de seleção)
  const handleScheduleSubtopic = async (data: {
    date: Date;
    durationMinutes: number;
    subtopicId: string;
    title: string;
  }) => {
    await createManualSchedule({
      date: data.date,
      durationMinutes: data.durationMinutes,
      topicId: topic.id,
      subtopicId: data.subtopicId,
      title: data.title,
    });
  };

  // Distribuir todos os subtópicos automaticamente
  const handleDistributeAll = async (data: {
    subtopics: any[];
    startDate: Date;
    endDate: Date;
  }) => {
    // TODO: Implementar lógica de distribuição sequencial
    // Por enquanto, vamos agendar um por dia sequencialmente
    let currentDate = new Date(data.startDate);

    for (const subtopic of data.subtopics) {
      await createManualSchedule({
        date: currentDate,
        durationMinutes: subtopic.estimated_duration_minutes || 90,
        topicId: topic.id,
        subtopicId: subtopic.id,
        title: subtopic.title,
      });

      // Próximo dia
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);

      // Se ultrapassou a data final, para
      if (currentDate > data.endDate) break;
    }
  };

  return (
    <div className="mb-1 relative">
      {/* Topic Header - SEM linhas horizontais */}
      <div className="group">
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150 ${
            isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
        >
          {/* Chevron */}
          <div className="shrink-0">
            {hasSubtopics || isEditMode ? (
              <ChevronRight
                className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            ) : (
              <div className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Schedule Button - cresce em hover, empurrando o ícone */}
          {!isEditing && (
            <>
              {/* Tópico COM subtópicos: Abrir drawer unificado */}
              {hasSubtopics ? (
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
                  className="overflow-hidden transition-all duration-200 ease-in-out w-0 opacity-0 group-hover:w-5 group-hover:opacity-100 group-hover:mr-1 shrink-0 p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                  title="Agendar subtópicos"
                >
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
              ) : (
                /* Tópico SEM subtópicos: Agendamento direto */
                <QuickSchedulePopover
                  topicId={topic.id}
                  title={topic.title}
                  estimatedMinutes={topic.estimated_duration_minutes || 120}
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
                    className="overflow-hidden transition-all duration-200 ease-in-out w-0 opacity-0 group-hover:w-5 group-hover:opacity-100 group-hover:mr-1 shrink-0 p-0.5 hover:bg-blue-50 rounded cursor-pointer"
                    title="Agendar estudo"
                  >
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                </QuickSchedulePopover>
              )}
            </>
          )}

          {/* Ícone */}
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
            hasSubtopics ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <BookOpen className={`w-3.5 h-3.5 ${hasSubtopics ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0 text-left">
            {isEditing ? (
              <TopicSubtopicInlineEditor
                value={topic.title}
                estimatedDuration={topic.estimated_duration_minutes || 120}
                isEditing={true}
                onSave={async (newTitle, newDuration) => {
                  await onSave(newTitle, newDuration);
                }}
                onCancel={onCancelEdit}
                className="font-medium text-gray-800 text-sm"
                showDurationInput={true}
                isCalculated={hasSubtopics}
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm truncate">
                    {topic.title}
                  </span>
                  {/* Contagem inline */}
                  {hasSubtopics && topic.subtopics && topic.subtopics.length > 0 && (
                    <span className="text-xs text-gray-400">
                      ({topic.subtopics.length})
                    </span>
                  )}
                  {/* Tempo estimado (discreto) */}
                  {topic.estimated_duration_minutes && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {Math.floor(topic.estimated_duration_minutes / 60)}h{topic.estimated_duration_minutes % 60 > 0 ? ` ${topic.estimated_duration_minutes % 60}m` : ''}
                    </span>
                  )}
                </div>
                {/* Progress inline */}
                {hasSubtopics && progress.total > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-0.5 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className="h-full bg-blue-400 transition-all duration-300"
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
                    title="Editar tópico"
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
                    title="Deletar tópico"
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

      {/* Children (Subtopics) - SEM linha vertical para hierarquia mais limpa */}
      {isExpanded && (hasSubtopics || isEditMode) && (
        <div className="mt-1 ml-5 pl-2">
          <div className="space-y-0.5">
            {children}
          </div>
        </div>
      )}

      {/* Drawer unificado para agendamento de subtópicos */}
      {hasSubtopics && (
        <TopicScheduleDrawer
          open={showScheduleDrawer}
          onOpenChange={setShowScheduleDrawer}
          topicId={topic.id}
          topicTitle={topic.title}
          subtopics={topic.subtopics || []}
          onScheduleSubtopic={handleScheduleSubtopic}
          onDistributeAll={handleDistributeAll}
        />
      )}
    </div>
  );
};
