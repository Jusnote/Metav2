import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { QuickSchedulePopover } from './QuickSchedulePopover';
import { Calendar, Clock, Loader2, CalendarDays, ListChecks } from 'lucide-react';
import type { Subtopic } from '@/hooks/useUnitsManager';
import { addDays } from 'date-fns';

interface TopicScheduleDrawerProps {
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
  onDistributeAll: (data: {
    subtopics: Subtopic[];
    startDate: Date;
    endDate: Date;
  }) => Promise<void>;
}

export function TopicScheduleDrawer({
  open,
  onOpenChange,
  topicId,
  topicTitle,
  subtopics,
  onScheduleSubtopic,
  onDistributeAll,
}: TopicScheduleDrawerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'select'>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>({
    from: new Date(),
    to: addDays(new Date(), subtopics.length),
  });
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  const [isDistributing, setIsDistributing] = useState(false);

  const totalMinutes = subtopics.reduce(
    (sum, sub) => sum + (sub.estimated_duration_minutes || 90),
    0
  );
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  const toggleSubtopic = (subtopicId: string) => {
    const newSelected = new Set(selectedSubtopics);
    if (newSelected.has(subtopicId)) {
      newSelected.delete(subtopicId);
    } else {
      newSelected.add(subtopicId);
    }
    setSelectedSubtopics(newSelected);
  };

  const handleDistribute = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setIsDistributing(true);
    try {
      await onDistributeAll({
        subtopics,
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error distributing:', error);
    } finally {
      setIsDistributing(false);
    }
  };

  const daysCount = dateRange?.from && dateRange?.to
    ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] flex flex-col p-0 sm:max-w-[480px]">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-lg">Agendar: {topicTitle}</SheetTitle>
          <SheetDescription>
            {subtopics.length} subtópico{subtopics.length > 1 ? 's' : ''} • {totalHours}h{totalMins > 0 ? `${totalMins}m` : ''} total
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'select')} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-2">
            <TabsTrigger value="all" className="gap-2">
              <CalendarDays className="w-4 h-4" />
              Agendar Todos
            </TabsTrigger>
            <TabsTrigger value="select" className="gap-2">
              <ListChecks className="w-4 h-4" />
              Escolher
            </TabsTrigger>
          </TabsList>

          {/* Tab: Agendar Todos */}
          <TabsContent value="all" className="flex-1 overflow-y-auto px-6 mt-4 space-y-4">
            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Subtópicos a agendar:</span>
                <span className="font-semibold text-blue-900">{subtopics.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Tempo total estimado:
                </span>
                <span className="font-semibold text-blue-900">
                  {totalHours}h{totalMins > 0 ? ` ${totalMins}m` : ''}
                </span>
              </div>
              {daysCount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                  <span className="text-sm text-blue-700">Distribuição:</span>
                  <span className="font-semibold text-blue-900">
                    ~{Math.ceil(subtopics.length / daysCount)} por dia em {daysCount} dias
                  </span>
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                <Calendar className="w-4 h-4 inline mr-2" />
                Período de distribuição
              </Label>
              <DateRangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range as { from: Date; to: Date } | undefined)}
              />
              <p className="text-xs text-gray-500">
                💡 Os subtópicos serão distribuídos sequencialmente, aproximadamente 1 por dia
              </p>
            </div>

            {/* Preview List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Preview dos subtópicos:
              </Label>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {subtopics.map((sub, index) => (
                  <div key={sub.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-gray-400 shrink-0">{index + 1}.</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-gray-700 truncate cursor-default">{sub.title}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{sub.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                      {Math.floor((sub.estimated_duration_minutes || 90) / 60)}h
                      {(sub.estimated_duration_minutes || 90) % 60 > 0 ?
                        `${(sub.estimated_duration_minutes || 90) % 60}m` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <div className="sticky bottom-0 pt-4 pb-2 bg-white border-t">
              <Button
                onClick={handleDistribute}
                disabled={!dateRange?.from || !dateRange?.to || isDistributing}
                className="w-full h-12 text-base"
                size="lg"
              >
                {isDistributing && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isDistributing ? 'Agendando...' : `Agendar ${subtopics.length} Subtópicos`}
              </Button>
            </div>
          </TabsContent>

          {/* Tab: Escolher */}
          <TabsContent value="select" className="flex-1 overflow-y-auto px-6 mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Selecione os subtópicos</Label>
                <span className="text-xs text-gray-500">
                  {selectedSubtopics.size} de {subtopics.length} selecionado{selectedSubtopics.size !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Clique no ícone 📅 para agendar cada subtópico individualmente
              </p>
            </div>

            {/* Subtopics List */}
            <div className="space-y-2 pb-4">
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-medium truncate cursor-default">{subtopic.title}</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{subtopic.title}</p>
                      </TooltipContent>
                    </Tooltip>
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
                    onSchedule={(data) => onScheduleSubtopic({
                      date: data.date,
                      durationMinutes: data.durationMinutes,
                      subtopicId: subtopic.id,
                      title: subtopic.title,
                    })}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </Button>
                  </QuickSchedulePopover>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
