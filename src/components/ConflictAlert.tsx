import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConflictInfo } from '@/hooks/useConflictDetection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConflictAlertProps {
  conflict: ConflictInfo;
  date: Date;
  onIncreaseAvailability?: () => void;
  className?: string;
}

export function ConflictAlert({
  conflict,
  date,
  onIncreaseAvailability,
  className = '',
}: ConflictAlertProps) {
  if (!conflict.hasConflict) return null;

  const dateFormatted = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <Alert variant="destructive" className={`${className} border-red-300 bg-red-50`}>
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="ml-2 space-y-3">
        <div className="text-sm text-red-900">
          <p className="font-semibold mb-2">❌ Conflito detectado!</p>
          <p className="mb-1">
            <span className="font-medium">{dateFormatted}</span> tem apenas{' '}
            <span className="font-bold">{conflict.availableHours}h disponíveis</span>.
          </p>
          <div className="space-y-1 text-xs">
            <p>
              • Já agendado: <span className="font-medium">{conflict.scheduledHours.toFixed(1)}h</span>
            </p>
            <p>
              • Novo item: <span className="font-medium">{conflict.newItemHours.toFixed(1)}h</span>
            </p>
            <p>
              • Total: <span className="font-bold text-red-700">{conflict.totalAfterSchedule.toFixed(1)}h</span>
            </p>
            <p className="text-red-700 font-medium pt-1">
              ⚠️ Ultrapassaria em {conflict.overloadHours.toFixed(1)}h
            </p>
          </div>
        </div>

        {onIncreaseAvailability && (
          <div className="pt-2 border-t border-red-200">
            <p className="text-xs text-red-800 mb-2">
              💡 <span className="font-medium">Sugestão:</span> Aumente a disponibilidade para{' '}
              <span className="font-bold">{conflict.suggestedAvailability}h</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onIncreaseAvailability}
              className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
            >
              Aumentar disponibilidade para {conflict.suggestedAvailability}h
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
