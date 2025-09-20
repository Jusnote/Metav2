import React from 'react';
import { Progress } from './ui/progress';
import { CheckCircle, Circle, Lock } from 'lucide-react';

interface StudyProgressIndicatorProps {
  totalSections: number;
  currentSectionIndex: number;
  completedSections: string[];
  isStudyModeEnabled: boolean;
}

export function StudyProgressIndicator({
  totalSections,
  currentSectionIndex,
  completedSections,
  isStudyModeEnabled
}: StudyProgressIndicatorProps) {
  // Só renderizar quando modo estudo estiver ativo
  if (!isStudyModeEnabled || totalSections === 0) {
    return null;
  }
  
  const progressPercentage = (completedSections.length / totalSections) * 100;

  return (
    <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 w-full">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-blue-800">Progresso do Estudo</h4>
        <span className="text-xs text-blue-600">
          {completedSections.length}/{totalSections} seções
        </span>
      </div>
      
      <Progress 
        value={progressPercentage} 
        className="h-2 mb-3"
      />
      
      <div className="flex items-center justify-center gap-1 text-xs">
        {Array.from({ length: totalSections }).map((_, index) => {
          const isCompleted = completedSections.length > index;
          const isCurrent = index === currentSectionIndex;
          const isLocked = index > currentSectionIndex && !isCompleted;
          
          return (
            <div
              key={index}
              className={`flex items-center justify-center w-5 h-5 rounded-full border transition-all ${
                isCompleted
                  ? 'bg-green-100 border-green-500 text-green-700'
                  : isCurrent
                  ? 'bg-blue-100 border-blue-500 text-blue-700 ring-1 ring-blue-200'
                  : isLocked
                  ? 'bg-gray-100 border-gray-300 text-gray-400'
                  : 'bg-white border-gray-300 text-gray-500'
              }`}
              title={`Seção ${index + 1}${
                isCompleted ? ' (concluída)' : 
                isCurrent ? ' (atual)' : 
                isLocked ? ' (bloqueada)' : ''
              }`}
            >
              {isCompleted ? (
                <CheckCircle className="h-2.5 w-2.5" />
              ) : isLocked ? (
                <Lock className="h-2.5 w-2.5" />
              ) : (
                <span className="text-xs font-medium">{index + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
