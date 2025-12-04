import { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { ConflictAlert } from '@/components/ConflictAlert';
import { useStudyConfig } from '@/contexts/StudyConfigContext';
import { DayExceptionModal } from '@/components/DayExceptionModal';

interface QuickSchedulePopoverProps {
  children: React.ReactNode;
  topicId?: string;
  subtopicId?: string;
  title: string;
  estimatedMinutes?: number;
  onSchedule: (data: {
    date: Date;
    durationMinutes: number;
    topicId?: string;
    subtopicId?: string;
  }) => void;
}

export function QuickSchedulePopover({
  children,
  topicId,
  subtopicId,
  title,
  estimatedMinutes = 90,
  onSchedule,
}: QuickSchedulePopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [duration, setDuration] = useState(estimatedMinutes);
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  const { checkConflict } = useConflictDetection();
  const { getDailyHours, setDayException, getDayException } = useStudyConfig();

  // Calcular conflito usando useMemo (evita loop infinito)
  const conflictInfo = useMemo(() => {
    if (!selectedDate) return null;
    return checkConflict(selectedDate, duration);
  }, [selectedDate, duration, checkConflict]);

  const handleSchedule = () => {
    if (!selectedDate) return;

    // Se não tem conflito, agendar diretamente
    if (!conflictInfo?.hasConflict) {
      onSchedule({
        date: selectedDate,
        durationMinutes: duration,
        topicId,
        subtopicId,
      });

      setOpen(false);
      setSelectedDate(undefined);
      setDuration(estimatedMinutes);
    }
    // Se tem conflito, não faz nada (usuário precisa resolver via botão de aumentar disponibilidade)
  };

  const handleIncreaseAvailability = () => {
    setShowExceptionModal(true);
  };

  const handleSaveException = async (hours: number, reason?: string) => {
    if (!selectedDate) return;

    await setDayException(selectedDate, hours, reason);
    setShowExceptionModal(false);

    // Aguardar próximo render para re-calcular conflito (conflictInfo será atualizado automaticamente via useMemo)
    // Se resolveu o conflito, agendar automaticamente
    setTimeout(() => {
      const newConflict = checkConflict(selectedDate, duration);
      if (!newConflict.hasConflict) {
        handleSchedule();
      }
    }, 100);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">Agendar: {title}</h4>
            <p className="text-xs text-gray-500">Escolha a data e duração do estudo</p>
          </div>

          {/* Calendar */}
          <div className="border rounded-md">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
          </div>

          {/* Selected Date Display */}
          {selectedDate && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-md">
              <CalendarIcon className="h-4 w-4" />
              <span>{format(selectedDate, "PPP", { locale: ptBR })}</span>
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm">
              <Clock className="h-3 w-3 inline mr-1" />
              Duração estimada
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || estimatedMinutes)}
                className="w-24"
              />
              <span className="text-sm text-gray-500">
                minutos ({Math.floor(duration / 60)}h{duration % 60 > 0 ? `${duration % 60}m` : ''})
              </span>
            </div>
          </div>

          {/* Conflict Alert */}
          {selectedDate && conflictInfo?.hasConflict && (
            <ConflictAlert
              conflict={conflictInfo}
              date={selectedDate}
              onIncreaseAvailability={handleIncreaseAvailability}
            />
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSchedule}
              disabled={!selectedDate || conflictInfo?.hasConflict}
              className="flex-1"
            >
              Agendar
            </Button>
          </div>
        </div>
      </PopoverContent>

      {/* Exception Modal */}
      {selectedDate && (
        <DayExceptionModal
          open={showExceptionModal}
          onOpenChange={setShowExceptionModal}
          date={selectedDate}
          currentHours={getDailyHours(selectedDate)}
          defaultHours={getDailyHours(selectedDate)}
          hasException={!!getDayException(selectedDate)}
          onSave={handleSaveException}
          onRemove={async () => {
            // Não implementado aqui pois estamos aumentando, não removendo
          }}
        />
      )}
    </Popover>
  );
}
