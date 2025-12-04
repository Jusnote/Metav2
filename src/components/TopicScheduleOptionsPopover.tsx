import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, ListChecks } from 'lucide-react';

interface TopicScheduleOptionsPopoverProps {
  children: React.ReactNode;
  topicTitle: string;
  subtopicCount: number;
  onScheduleAll: () => void;
  onSelectSubtopics: () => void;
}

export function TopicScheduleOptionsPopover({
  children,
  topicTitle,
  subtopicCount,
  onScheduleAll,
  onSelectSubtopics,
}: TopicScheduleOptionsPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">Agendar: {topicTitle}</h4>
            <p className="text-xs text-gray-500">
              Este tópico possui {subtopicCount} subtópico{subtopicCount > 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-2">
            {/* Option 1: Agendar todos */}
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                onScheduleAll();
              }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Agendar todos os subtópicos
            </Button>

            {/* Option 2: Escolher subtópicos */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                onSelectSubtopics();
              }}
            >
              <ListChecks className="w-4 h-4 mr-2" />
              Escolher subtópicos...
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            💡 "Agendar todos" distribui automaticamente os subtópicos em dias sequenciais
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
