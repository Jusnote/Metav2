import React from 'react';
import { Edit3, Trash2, FileText, Check } from 'lucide-react';
import { InlineEditor } from './InlineEditor';
import { useMaterialCounts } from '../hooks/useMaterialCounts';
import type { Subtopic } from '../hooks/useUnitsManager';

interface SubtopicItemProps {
  subtopic: Subtopic;
  unitId: string;
  topicId: string;
  isSelected: boolean;
  isEditMode: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleComplete: (completed: boolean) => Promise<void>;
}

export const SubtopicItem: React.FC<SubtopicItemProps> = ({
  subtopic,
  isSelected,
  isEditMode,
  isEditing,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleComplete
}) => {
  const { counts } = useMaterialCounts(subtopic.id);
  const isCompleted = subtopic.status === 'completed';

  return (
    <div className="mb-0.5 relative group">
      {/* SEM linhas horizontais */}
      <div className="flex items-center gap-2">
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
          onClick={onSelect}
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
              <InlineEditor
                value={subtopic.title}
                isEditing={true}
                onSave={onSave}
                onCancel={onCancelEdit}
                className="text-gray-700 text-xs"
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

        {/* Action Buttons */}
        {isEditMode && !isEditing && (
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
      </div>
    </div>
  );
};
