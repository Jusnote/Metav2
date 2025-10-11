import React from 'react';
import { FileText, CreditCard, HelpCircle } from 'lucide-react';

type MaterialType = 'documents' | 'flashcards' | 'questions';

interface MaterialBadgeProps {
  type: MaterialType;
  count: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
}

export const MaterialBadge: React.FC<MaterialBadgeProps> = ({
  type,
  count,
  size = 'sm',
  showIcon = true,
  showLabel = false
}) => {
  const config = {
    documents: {
      icon: FileText,
      label: 'docs',
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-300'
    },
    flashcards: {
      icon: CreditCard,
      label: 'cards',
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-300'
    },
    questions: {
      icon: HelpCircle,
      label: 'quest',
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-300'
    }
  };

  const { icon: Icon, label, bgColor, textColor, borderColor } = config[type];

  const sizeClasses = {
    sm: {
      container: 'px-1.5 py-0.5 text-xs',
      icon: 'w-2.5 h-2.5',
      gap: 'gap-0.5'
    },
    md: {
      container: 'px-2 py-1 text-sm',
      icon: 'w-3 h-3',
      gap: 'gap-1'
    },
    lg: {
      container: 'px-2.5 py-1.5 text-base',
      icon: 'w-4 h-4',
      gap: 'gap-1.5'
    }
  };

  const { container, icon, gap } = sizeClasses[size];

  if (count === 0) return null;

  return (
    <div
      className={`inline-flex items-center ${gap} ${container} ${bgColor} ${textColor} ${borderColor} border rounded-full font-semibold`}
      title={`${count} ${type === 'documents' ? 'documento(s)' : type === 'flashcards' ? 'flashcard(s)' : 'questão(ões)'}`}
    >
      {showIcon && <Icon className={icon} />}
      <span>{count}</span>
      {showLabel && <span className="opacity-75">{label}</span>}
    </div>
  );
};

interface MaterialBadgesGroupProps {
  documents: number;
  flashcards: number;
  questions: number;
  size?: 'sm' | 'md' | 'lg';
  showIcons?: boolean;
  showLabels?: boolean;
}

export const MaterialBadgesGroup: React.FC<MaterialBadgesGroupProps> = ({
  documents,
  flashcards,
  questions,
  size = 'sm',
  showIcons = true,
  showLabels = false
}) => {
  const hasAny = documents > 0 || flashcards > 0 || questions > 0;

  if (!hasAny) return null;

  return (
    <div className="inline-flex items-center gap-1">
      {documents > 0 && (
        <MaterialBadge
          type="documents"
          count={documents}
          size={size}
          showIcon={showIcons}
          showLabel={showLabels}
        />
      )}
      {flashcards > 0 && (
        <MaterialBadge
          type="flashcards"
          count={flashcards}
          size={size}
          showIcon={showIcons}
          showLabel={showLabels}
        />
      )}
      {questions > 0 && (
        <MaterialBadge
          type="questions"
          count={questions}
          size={size}
          showIcon={showIcons}
          showLabel={showLabels}
        />
      )}
    </div>
  );
};
