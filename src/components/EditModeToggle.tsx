import React from 'react';
import { Button } from '@/components/ui/button';
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
    <Button
      onClick={onToggle}
      variant={isEditMode ? 'default' : 'outline-solid'}
      size="sm"
      className={`flex items-center gap-2 transition-all duration-200 ${className}`}
    >
      {isEditMode ? (
        <>
          <Eye className="w-4 h-4" />
          Sair do Modo Edição
        </>
      ) : (
        <>
          <Edit3 className="w-4 h-4" />
          Modo Edição
        </>
      )}
    </Button>
  );
};

export default EditModeToggle;