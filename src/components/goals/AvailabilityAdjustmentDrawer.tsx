import { useState, useMemo } from 'react';
import { Calendar, Clock, X, Info } from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { DayExceptionModal } from '@/components/DayExceptionModal';
import type { StudyConfig, DayException } from '@/contexts/StudyConfigContext';

interface AvailabilityAdjustmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Date;
  endDate: Date;
  studyWeekends: boolean;
  onExceptionChange?: () => void;
  // Funções passadas via props em vez de hook separado
  config: StudyConfig | null;
  getDailyHours: (date: Date) => number;
  getDayException: (date: Date) => DayException | null;
  setDayException: (date: Date, hours: number, reason?: string) => Promise<void>;
  removeDayException: (date: Date) => Promise<void>;
}

export function AvailabilityAdjustmentDrawer({
  open,
  onOpenChange,
  startDate,
  endDate,
  studyWeekends,
  onExceptionChange,
  config,
  getDailyHours,
  getDayException,
  setDayException,
  removeDayException,
}: AvailabilityAdjustmentDrawerProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Forçar re-render do calendário

  // Gerar todos os dias do período
  const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });

  // Agrupar dias por mês para melhor visualização
  const daysByMonth = daysInPeriod.reduce((acc, day) => {
    const monthKey = format(day, 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(day);
    return acc;
  }, {} as Record<string, Date[]>);

  const handleDayClick = (day: Date) => {
    const dayOfWeek = getDay(day);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Se não estuda fins de semana e clicou num fim de semana, avisar
    if (isWeekend && !studyWeekends) {
      return; // Não permitir clicar
    }

    setSelectedDay(day);
    setShowExceptionModal(true);
  };

  const handleSaveException = async (hours: number, reason?: string) => {
    if (!selectedDay) return;
    console.log('🔴 [AvailabilityDrawer] handleSaveException CALLED', { hours, reason });
    await setDayException(selectedDay, hours, reason);
    console.log('🔴 [AvailabilityDrawer] setDayException completed');
    setShowExceptionModal(false);
    setSelectedDay(null);
    // Forçar atualização do calendário no drawer
    setRefreshTrigger(prev => prev + 1);
    // Notificar o componente pai que a exceção mudou
    console.log('🔴 [AvailabilityDrawer] Calling onExceptionChange callback');
    onExceptionChange?.();
    console.log('🔴 [AvailabilityDrawer] handleSaveException COMPLETED');
  };

  const handleRemoveException = async () => {
    if (!selectedDay) return;
    await removeDayException(selectedDay);
    setShowExceptionModal(false);
    setSelectedDay(null);
    // Forçar atualização do calendário no drawer
    setRefreshTrigger(prev => prev + 1);
    // Notificar o componente pai que a exceção foi removida
    onExceptionChange?.();
  };

  // Memoizar estilos dos dias para forçar recálculo quando exceções mudam
  const dayStyles = useMemo(() => {
    const styles = new Map<string, string>();
    daysInPeriod.forEach(day => {
      const dayOfWeek = getDay(day);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const hasException = !!getDayException(day);

      if (isWeekend && !studyWeekends) {
        styles.set(day.toISOString(), 'bg-gray-100 text-gray-400 cursor-not-allowed');
      } else if (hasException) {
        styles.set(day.toISOString(), 'bg-blue-100 text-blue-900 border-2 border-blue-400 cursor-pointer hover:bg-blue-200');
      } else {
        styles.set(day.toISOString(), 'bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer border border-gray-200');
      }
    });
    return styles;
  }, [daysInPeriod, getDayException, studyWeekends, refreshTrigger]);

  const getDayStyle = (day: Date) => {
    return dayStyles.get(day.toISOString()) || 'bg-gray-50 text-gray-700';
  };

  // Memoizar labels dos dias para forçar recálculo quando exceções mudam
  const dayLabels = useMemo(() => {
    const labels = new Map<string, string>();
    daysInPeriod.forEach(day => {
      const hasException = getDayException(day);
      if (hasException) {
        labels.set(day.toISOString(), `${hasException.hours}h${hasException.reason ? ` - ${hasException.reason}` : ''}`);
        return;
      }

      const dayOfWeek = getDay(day);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend && !studyWeekends) {
        labels.set(day.toISOString(), 'Não estuda');
        return;
      }

      const dailyHours = getDailyHours(day);
      labels.set(day.toISOString(), `${dailyHours}h`);
    });
    return labels;
  }, [daysInPeriod, getDayException, getDailyHours, studyWeekends, refreshTrigger]);

  const getDayLabel = (day: Date) => {
    return dayLabels.get(day.toISOString()) || '0h';
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Ajustar Disponibilidade
            </SheetTitle>
            <SheetDescription>
              Período: {format(startDate, 'dd/MM/yyyy')} até {format(endDate, 'dd/MM/yyyy')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Informação */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-blue-900">
                  <p className="font-medium">Como funciona:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Clique em um dia para definir horas personalizadas</li>
                    <li>Dias em <span className="font-semibold text-blue-700">azul</span> têm exceções configuradas</li>
                    <li>As mudanças afetam a disponibilidade total da meta</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Calendários por mês */}
            <div className="space-y-6">
              {Object.entries(daysByMonth).map(([monthKey, days]) => {
                const firstDayOfMonth = days[0];
                const monthStart = startOfMonth(firstDayOfMonth);
                const monthEnd = endOfMonth(firstDayOfMonth);
                const firstDayWeekday = getDay(monthStart);

                return (
                  <div key={monthKey} className="space-y-3">
                    {/* Mês/Ano */}
                    <h3 className="font-semibold text-gray-900">
                      {format(firstDayOfMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h3>

                    {/* Grid do calendário */}
                    <div className="grid grid-cols-7 gap-2">
                      {/* Header dos dias da semana */}
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                          {day}
                        </div>
                      ))}

                      {/* Espaços vazios antes do primeiro dia */}
                      {Array.from({ length: firstDayWeekday }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}

                      {/* Dias do mês */}
                      {eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
                        const isInPeriod = day >= startDate && day <= endDate;

                        if (!isInPeriod) {
                          return (
                            <div
                              key={day.toISOString()}
                              className="aspect-square flex flex-col items-center justify-center rounded-md bg-gray-50 text-gray-300 text-xs"
                            >
                              <span>{format(day, 'd')}</span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => handleDayClick(day)}
                            className={`aspect-square flex flex-col items-center justify-center rounded-md text-xs transition-all ${getDayStyle(day)}`}
                            title={getDayLabel(day)}
                          >
                            <span className="font-semibold">{format(day, 'd')}</span>
                            <span className="text-[10px] mt-0.5">{getDayLabel(day)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Legenda:</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-50 border border-gray-200" />
                  <span className="text-gray-600">Padrão (configuração global)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 border-2 border-blue-400" />
                  <span className="text-gray-600">Exceção configurada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-100" />
                  <span className="text-gray-400">Não incluído no período</span>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de exceção */}
      {selectedDay && (
        <DayExceptionModal
          open={showExceptionModal}
          onOpenChange={setShowExceptionModal}
          date={selectedDay}
          currentHours={getDailyHours(selectedDay)}
          defaultHours={(() => {
            const dayOfWeek = getDay(selectedDay);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            if (isWeekend) {
              return config?.weekend_hours ?? 5;
            }
            return config?.weekday_hours ?? 3;
          })()}
          hasException={!!getDayException(selectedDay)}
          onSave={handleSaveException}
          onRemove={handleRemoveException}
        />
      )}
    </>
  );
}
