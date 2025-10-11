import React from 'react';
import { ChevronRight, Edit3, Trash2, Package } from 'lucide-react';
import { InlineEditor } from './InlineEditor';
import type { Unit } from '../hooks/useUnitsManager';

interface UnitItemProps {
  unit: Unit;
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
  unit,
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
  const hasTopics = unit.topics.length > 0;

  return (
    <div className="mb-4">
      {/* Unit Header - Container Fino */}
      <div className="group relative">
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-100 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
        >
          {/* Chevron */}
          <div className="shrink-0">
            {hasTopics || isEditMode ? (
              <ChevronRight
                className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>

          {/* Ícone da Unidade */}
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0 shadow-sm">
            <Package className="w-4 h-4 text-white" />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0 text-left">
            {isEditing ? (
              <InlineEditor
                value={unit.title}
                isEditing={true}
                onSave={onSave}
                onCancel={onCancelEdit}
                className="font-semibold text-gray-900 text-sm"
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm truncate">
                    {unit.title}
                  </span>
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
                className="p-1.5 hover:bg-blue-100 rounded-md transition-colors"
                title="Editar unidade"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 hover:bg-red-100 rounded-md transition-colors"
                title="Deletar unidade"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
              </button>
            </div>
          )}
        </button>
      </div>

      {/* Children (Topics) - SEM linha vertical para hierarquia mais limpa */}
      {isExpanded && (hasTopics || isEditMode) && (
        <div className="mt-2 ml-5 pl-3">
          <div className="space-y-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
