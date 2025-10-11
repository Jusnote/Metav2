import React from 'react';
import { ChevronRight, Edit3, Trash2, BookOpen } from 'lucide-react';
import { InlineEditor } from './InlineEditor';
import { useTopicProgress } from '../hooks/useHierarchyProgress';
import type { Topic } from '../hooks/useUnitsManager';

interface TopicItemProps {
  topic: Topic;
  isExpanded: boolean;
  isSelected: boolean;
  isEditMode: boolean;
  isEditing: boolean;
  hasSubtopics: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
}

export const TopicItem: React.FC<TopicItemProps> = ({
  topic,
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

  const handleClick = () => {
    if (hasSubtopics || isEditMode) {
      onToggleExpand();
    } else {
      onSelect();
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

          {/* Ícone */}
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
            hasSubtopics ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <BookOpen className={`w-3.5 h-3.5 ${hasSubtopics ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0 text-left">
            {isEditing ? (
              <InlineEditor
                value={topic.title}
                isEditing={true}
                onSave={onSave}
                onCancel={onCancelEdit}
                className="font-medium text-gray-800 text-sm"
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

          {/* Action Buttons */}
          {isEditMode && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
                title="Editar tópico"
              >
                <Edit3 className="w-3 h-3 text-gray-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Deletar tópico"
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </button>
            </div>
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
    </div>
  );
};
