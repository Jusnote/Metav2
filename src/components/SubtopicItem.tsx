import React, { useState } from 'react';
import { Check, Calendar, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { TopicSubtopicInlineEditor } from './TopicSubtopicInlineEditor';
import { QuickSchedulePopover } from './QuickSchedulePopover';
import { useMaterialCounts } from '../hooks/useMaterialCounts';
import { useManualSchedule } from '../hooks/useManualSchedule';
import type { Subtopic } from '../hooks/useUnitsManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SubtopicItemProps {
  subtopic: Subtopic;
  unitId: string;
  topicId: string;
  isSelected: boolean;
  isEditMode: boolean;
  isEditing: boolean;
  showScheduleButton?: boolean;
  onToggleScheduleButton?: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (newTitle: string, estimatedDuration?: number) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleComplete: (completed: boolean) => Promise<void>;
}

export const SubtopicItem: React.FC<SubtopicItemProps> = ({
  subtopic,
  unitId,
  topicId,
  isSelected,
  isEditMode,
  isEditing,
  showScheduleButton = false,
  onToggleScheduleButton,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleComplete
}) => {
  const { counts } = useMaterialCounts(subtopic.id);
  const { createManualSchedule } = useManualSchedule();
  const [isMobile, setIsMobile] = useState(false);
  const isCompleted = subtopic.status === 'completed';

  // Detectar se é mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSchedule = async (data: {
    date: Date;
    durationMinutes: number;
    topicId?: string;
    subtopicId?: string;
  }) => {
    await createManualSchedule({
      date: data.date,
      durationMinutes: data.durationMinutes,
      topicId,
      subtopicId: subtopic.id,
      title: subtopic.title,
    });
  };

  return (
    <div className="mb-0.5 relative">
      <div className="group flex items-center gap-1">
        {/* Schedule Button - cresce ao clicar no item, empurrando o checkbox */}
        {!isEditing && (
          <QuickSchedulePopover
            topicId={topicId}
            subtopicId={subtopic.id}
            title={subtopic.title}
            estimatedMinutes={subtopic.estimated_duration_minutes || 90}
            onSchedule={handleSchedule}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className={`overflow-hidden transition-all duration-200 ease-in-out shrink-0 p-0.5 hover:bg-zinc-100/50 rounded ${
                showScheduleButton ? 'w-5 opacity-100' : 'w-0 opacity-0'
              }`}
              title="Agendar estudo"
            >
              <Calendar className="w-4 h-4 text-zinc-500" />
            </button>
          </QuickSchedulePopover>
        )}

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(!isCompleted);
          }}
          className={`shrink-0 w-4 h-4 rounded-[3.5px] border-[1.5px] flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-[#2563EB] border-[#2563EB] animate-check-bounce'
              : 'border-zinc-300 dark:border-zinc-600 hover:border-[#2563EB]/60'
          }`}
          title={isCompleted ? 'Marcar como não concluído' : 'Marcar como concluído'}
        >
          {isCompleted && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <button
          onClick={() => {
            onSelect();
            if (onToggleScheduleButton) {
              onToggleScheduleButton();
            }
          }}
          className={`flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-all duration-150 border-l-2 ${
            isSelected ? 'bg-zinc-200/50 border-[#2563EB]' : 'border-transparent hover:bg-zinc-100/40'
          }`}
        >
          {/* Título e Relevância */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <TopicSubtopicInlineEditor
                value={subtopic.title}
                estimatedDuration={subtopic.estimated_duration_minutes || 90}
                isEditing={true}
                onSave={async (newTitle, newDuration) => {
                  await onSave(newTitle, newDuration);
                }}
                onCancel={onCancelEdit}
                className="text-zinc-700 text-xs"
                showDurationInput={true}
                isCalculated={false}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] truncate flex-1 text-left ${
                    isCompleted ? 'text-zinc-400/50 line-through' : 'text-zinc-700'
                  }`}
                >
                  {subtopic.title}
                </span>
                {/* Estrelas de relevância (3 estrelas) */}
                {!isCompleted && (
                  <span className="flex items-center gap-px shrink-0" title="Relevância para a prova">
                    {[1, 2, 3].map((star) => {
                      const relevance = (subtopic as any).relevance ?? 2;
                      return (
                        <svg
                          key={star}
                          className={`w-2.5 h-2.5 ${star <= relevance ? 'text-[#2563EB]' : 'text-zinc-200 dark:text-zinc-700'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      );
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </button>

        {/* Edit/Delete Buttons (Edit Mode only) */}
        {!isEditing && isEditMode && (
          <>
            {/* Desktop: Hover buttons */}
            {!isMobile && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Editar subtópico"
                >
                  <Edit3 className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                  title="Deletar subtópico"
                >
                  <Trash2 className="w-3 h-3 text-red-600" />
                </button>
              </div>
            )}

            {/* Mobile: Dropdown menu */}
            {isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600" />
                  </button>
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
      </div>
    </div>
  );
};
