import React from 'react';
import { cn } from '@/lib/utils';

interface AddButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle';
}

export const AddButton: React.FC<AddButtonProps> = ({
  onClick,
  label,
  className = '',
  size = 'sm',
  variant = 'subtle'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 p-0.5',
    md: 'w-5 h-5 p-1',
    lg: 'w-6 h-6 p-1.5'
  };

  const variantClasses = {
    default: 'bg-blue-500 hover:bg-blue-600 text-white',
    subtle: 'bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-300'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      title={label}
    >
      <svg 
        className="w-full h-full" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        strokeWidth={2.5}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M12 4v16m8-8H4" 
        />
      </svg>
    </button>
  );
};

// Componente específico para adicionar unidades
export const AddUnitButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <AddButton
    onClick={onClick}
    label="Adicionar nova unidade"
    size="md"
    variant="default"
    className="ml-2"
  />
);

// Componente específico para adicionar tópicos
export const AddTopicButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <AddButton
    onClick={onClick}
    label="Adicionar novo tópico"
    size="sm"
    variant="subtle"
    className="ml-1"
  />
);

// Componente específico para adicionar subtópicos
export const AddSubtopicButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <AddButton
    onClick={onClick}
    label="Adicionar novo subtópico"
    size="sm"
    variant="subtle"
    className="ml-1"
  />
);