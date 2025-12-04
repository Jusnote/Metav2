import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TopicConflict } from '@/lib/schedule-distribution';

interface TopicConflictAccordionProps {
  conflicts: TopicConflict[];
  manualItemsWithoutConflict: Array<{
    scheduled_date: string;
    estimated_duration: number;
    title: string;
  }>;
  onConflictResolutionChange: (conflicts: TopicConflict[]) => void;
}

export function TopicConflictAccordion({
  conflicts,
  manualItemsWithoutConflict,
  onConflictResolutionChange,
}: TopicConflictAccordionProps) {

  if (conflicts.length === 0 && manualItemsWithoutConflict.length === 0) {
    return null;
  }

  const handleConflictActionChange = (conflictIndex: number, action: 'convert' | 'replace' | 'skip') => {
    const updatedConflicts = [...conflicts];
    updatedConflicts[conflictIndex].action = action;
    onConflictResolutionChange(updatedConflicts);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  };

  return (
    <div className="space-y-3">
      {/* Separador */}
      <div className="border-t border-gray-200" />

      {/* Título da seção */}
      <p className="text-sm font-medium text-gray-700">Agendamentos no período</p>

      {/* Lista de conflitos (com select) */}
      {conflicts.map((conflict, index) => (
        <div
          key={`${conflict.topicId}-${conflict.subtopicId}-${index}`}
          className="border-l-2 border-amber-400 bg-amber-50/30 pl-3 py-2 space-y-2"
        >
          <p className="text-xs text-gray-700">
            {conflict.title} · {formatDate(conflict.existingItems[0].scheduled_date)} · {formatDuration(conflict.existingItems[0].estimated_duration)}
          </p>
          <Select
            value={conflict.action}
            onValueChange={(value) => handleConflictActionChange(index, value as 'convert' | 'replace' | 'skip')}
          >
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="convert" className="text-xs">
                Vincular à meta
              </SelectItem>
              <SelectItem value="replace" className="text-xs">
                Substituir por novo agendamento
              </SelectItem>
              <SelectItem value="skip" className="text-xs">
                Excluir da meta
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Itens sem conflito (sem select) */}
      {manualItemsWithoutConflict.map((item, index) => (
        <div key={index} className="pl-3 text-xs text-gray-600">
          {item.title} · {formatDate(item.scheduled_date)} · {formatDuration(item.estimated_duration)}
        </div>
      ))}
    </div>
  );
}
