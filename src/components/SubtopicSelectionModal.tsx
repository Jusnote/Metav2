import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { QuickSchedulePopover } from './QuickSchedulePopover';
import { Calendar, Clock } from 'lucide-react';
import type { Subtopic } from '@/hooks/useUnitsManager';

interface SubtopicSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicTitle: string;
  subtopics: Subtopic[];
  onScheduleSubtopic: (data: {
    date: Date;
    durationMinutes: number;
    subtopicId: string;
    title: string;
  }) => void;
}

export function SubtopicSelectionModal({
  open,
  onOpenChange,
  topicId,
  topicTitle,
  subtopics,
  onScheduleSubtopic,
}: SubtopicSelectionModalProps) {
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());

  const toggleSubtopic = (subtopicId: string) => {
    const newSelected = new Set(selectedSubtopics);
    if (newSelected.has(subtopicId)) {
      newSelected.delete(subtopicId);
    } else {
      newSelected.add(subtopicId);
    }
    setSelectedSubtopics(newSelected);
  };

  const handleSchedule = (subtopicId: string, title: string, estimatedMinutes: number) =>
    (data: { date: Date; durationMinutes: number }) => {
      onScheduleSubtopic({
        date: data.date,
        durationMinutes: data.durationMinutes,
        subtopicId,
        title,
      });
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Agendar subtópicos de: {topicTitle}</DialogTitle>
          <DialogDescription>
            Selecione os subtópicos e clique no ícone 📅 para agendá-los individualmente
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {subtopics.map((subtopic) => (
            <div
              key={subtopic.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
            >
              {/* Checkbox */}
              <Checkbox
                checked={selectedSubtopics.has(subtopic.id)}
                onCheckedChange={() => toggleSubtopic(subtopic.id)}
              />

              {/* Subtopic Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{subtopic.title}</p>
                {subtopic.estimated_duration_minutes && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {Math.floor(subtopic.estimated_duration_minutes / 60)}h
                    {subtopic.estimated_duration_minutes % 60 > 0 ?
                      `${subtopic.estimated_duration_minutes % 60}m` : ''}
                  </p>
                )}
              </div>

              {/* Schedule Button */}
              <QuickSchedulePopover
                topicId={topicId}
                subtopicId={subtopic.id}
                title={subtopic.title}
                estimatedMinutes={subtopic.estimated_duration_minutes || 90}
                onSchedule={handleSchedule(
                  subtopic.id,
                  subtopic.title,
                  subtopic.estimated_duration_minutes || 90
                )}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Calendar className="w-4 h-4 text-blue-600" />
                </Button>
              </QuickSchedulePopover>
            </div>
          ))}
        </div>

        <DialogFooter>
          <p className="text-xs text-gray-500 mr-auto">
            {selectedSubtopics.size} de {subtopics.length} selecionado{selectedSubtopics.size !== 1 ? 's' : ''}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
