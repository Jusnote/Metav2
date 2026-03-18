import React from 'react';
import { Edit3, Eye } from 'lucide-react';

interface EditModeToggleProps {
  isEditMode: boolean;
  onToggle: () => void;
  className?: string;
}

export const EditModeToggle: React.FC<EditModeToggleProps> = ({
  isEditMode,
  onToggle,
  className = ''
}) => {
  return (
    <button
      onClick={onToggle}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        isEditMode
          ? 'bg-violet-100 text-violet-700 shadow-sm'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
      } ${className}`}
      title={isEditMode ? 'Sair do modo edição' : 'Modo edição'}
    >
      {isEditMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
    </button>
  );
};

export default EditModeToggle;