import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { TimeEstimateInput } from './goals/TimeEstimateInput';

interface TopicSubtopicInlineEditorProps {
  value: string;
  estimatedDuration: number;
  isEditing: boolean;
  onSave: (newTitle: string, newDuration: number) => Promise<void>;
  onCancel: () => void;
  className?: string;
  showDurationInput: boolean; // false for topics with subtopics (calculated time)
  isCalculated?: boolean; // true if duration is calculated from subtopics
}

export const TopicSubtopicInlineEditor: React.FC<TopicSubtopicInlineEditorProps> = ({
  value,
  estimatedDuration,
  isEditing,
  onSave,
  onCancel,
  className = '',
  showDurationInput,
  isCalculated = false
}) => {
  const [editValue, setEditValue] = useState(value);
  const [editDuration, setEditDuration] = useState(estimatedDuration);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
    setEditDuration(estimatedDuration);
  }, [value, estimatedDuration]);

  const handleSave = async () => {
    if (editValue.trim()) {
      await onSave(editValue.trim(), editDuration);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isEditing) {
    return <span className={className}>{value}</span>;
  }

  return (
    <div className="space-y-2 py-1" onClick={(e) => e.stopPropagation()}>
      {/* Title Input */}
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
          placeholder="Nome..."
        />
        <button
          onClick={handleSave}
          className="p-1 hover:bg-green-100 rounded transition-colors"
          title="Salvar"
        >
          <Check className="w-4 h-4 text-green-600" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-red-100 rounded transition-colors"
          title="Cancelar"
        >
          <X className="w-4 h-4 text-red-600" />
        </button>
      </div>

      {/* Time Input */}
      {showDurationInput && !isCalculated && (
        <div className="pl-0">
          <TimeEstimateInput
            value={editDuration}
            onChange={setEditDuration}
            label=""
            disabled={false}
          />
        </div>
      )}

      {/* Calculated Time Display */}
      {isCalculated && (
        <div className="text-xs text-gray-500 italic pl-2">
          Tempo calculado automaticamente a partir dos subtópicos: {Math.floor(estimatedDuration / 60)}h {estimatedDuration % 60}min
        </div>
      )}
    </div>
  );
};
