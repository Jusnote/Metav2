import { Clock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface DayException {
  date: Date;
  hours: number;
  reason?: string;
  diff: number; // Diferença em relação ao padrão
}

interface AvailabilityPreviewProps {
  startDate: Date;
  endDate: Date;
  studyWeekends: boolean;
  weekdayHours: number;
  weekendHours: number;
  totalHours: number;
  weekdayCount: number;
  weekendCount: number;
  exceptions?: DayException[];
  onAdjust?: () => void;
}

export function AvailabilityPreview({
  startDate,
  endDate,
  studyWeekends,
  weekdayHours,
  weekendHours,
  totalHours,
  weekdayCount,
  weekendCount,
  exceptions = [],
  onAdjust,
}: AvailabilityPreviewProps) {
  const MAX_EXCEPTIONS_DISPLAY = 3;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <h4 className="text-sm font-medium text-gray-700">Disponibilidade</h4>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Configuração Global */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Configuração global:</p>
          <div className="space-y-1.5 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">• Seg-Sex:</span>
              <span className="font-medium">
                {weekdayHours}h/dia <span className="text-gray-400">({weekdayCount} dias)</span>
              </span>
            </div>
            {studyWeekends && weekendCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">• Sáb-Dom:</span>
                <span className="font-medium">
                  {weekendHours}h/dia <span className="text-gray-400">({weekendCount} dias)</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Exceções Configuradas */}
        {exceptions.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Exceções configuradas: {exceptions.length} {exceptions.length === 1 ? 'dia' : 'dias'}
            </p>
            <div className="space-y-1 text-sm text-gray-700">
              {exceptions.slice(0, MAX_EXCEPTIONS_DISPLAY).map((exc, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-600">
                    • {format(exc.date, 'dd/MM')}:
                  </span>
                  <span className="font-medium">
                    {exc.hours}h
                    <span className={exc.diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {' '}({exc.diff >= 0 ? '+' : ''}{exc.diff.toFixed(1)}h)
                    </span>
                  </span>
                </div>
              ))}
              {exceptions.length > MAX_EXCEPTIONS_DISPLAY && (
                <p className="text-xs text-gray-500 italic">
                  ... e mais {exceptions.length - MAX_EXCEPTIONS_DISPLAY} {exceptions.length - MAX_EXCEPTIONS_DISPLAY === 1 ? 'dia' : 'dias'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Total Estimado */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total estimado:</span>
            <span className="font-semibold text-gray-900">{totalHours.toFixed(0)}h no período</span>
          </div>
        </div>

        {/* Botão de Ajuste */}
        {onAdjust && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdjust}
            className="w-full mt-2 text-xs"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Ajustar disponibilidade nesta meta
          </Button>
        )}
      </div>
    </div>
  );
}
