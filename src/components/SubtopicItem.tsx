import React, { useState } from 'react';
import { FileText, Check, Clock, Calendar, Edit3, Trash2, MoreVertical } from 'lucide-react';
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
      {/* SEM linhas horizontais */}
      <div className="flex items-center gap-2">
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
              className={`overflow-hidden transition-all duration-200 ease-in-out shrink-0 p-0.5 hover:bg-blue-50 rounded ${
                showScheduleButton ? 'w-5 opacity-100 mr-1' : 'w-0 opacity-0'
              }`}
              title="Agendar estudo"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
            </button>
          </QuickSchedulePopover>
        )}

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(!isCompleted);
          }}
          className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-green-500 border-green-500 hover:bg-green-600'
              : 'border-gray-300 hover:border-green-400'
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
          className={`flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-all duration-150 ${
            isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
        >
          {/* Ícone */}
          <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center shrink-0">
            <FileText className="w-3 h-3 text-gray-600" />
          </div>

          {/* Título e Badges */}
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
                className="text-gray-700 text-xs"
                showDurationInput={true}
                isCalculated={false}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs truncate flex-1 text-left ${
                    isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'
                  }`}
                >
                  {subtopic.title}
                </span>
                {/* Tempo estimado (discreto) */}
                {subtopic.estimated_duration_minutes && (
                  <span className="text-xs text-gray-400 flex items-center gap-0.5 shrink-0">
                    <Clock className="w-3 h-3" />
                    {Math.floor(subtopic.estimated_duration_minutes / 60)}h{subtopic.estimated_duration_minutes % 60 > 0 ? ` ${subtopic.estimated_duration_minutes % 60}m` : ''}
                  </span>
                )}
                {/* Badges minimalistas */}
                {(counts.documents > 0 || counts.flashcards > 0 || counts.questions > 0) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {counts.documents > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                        {counts.documents}
                      </span>
                    )}
                    {counts.flashcards > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                        {counts.flashcards}
                      </span>
                    )}
                    {counts.questions > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                        {counts.questions}
                      </span>
                    )}
                  </div>
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
