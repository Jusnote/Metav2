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
import { Label } from '@/components/ui/label';
// import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, Calendar, Clock } from 'lucide-react';
import type { Subtopic } from '@/hooks/useUnitsManager';
import { addDays } from 'date-fns';

interface DistributionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicTitle: string;
  subtopics: Subtopic[];
  onDistribute: (data: {
    subtopics: Subtopic[];
    startDate: Date;
    endDate: Date;
  }) => Promise<void>;
}

export function DistributionWizard({
  open,
  onOpenChange,
  topicTitle,
  subtopics,
  onDistribute,
}: DistributionWizardProps) {
  const [isDistributing, setIsDistributing] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  const totalMinutes = subtopics.reduce(
    (sum, sub) => sum + (sub.estimated_duration_minutes || 90),
    0
  );
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  const handleDistribute = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    // Validar datas passadas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange.from < today) {
      alert('A data inicial não pode ser no passado');
      return;
    }

    if (dateRange.to < dateRange.from) {
      alert('A data final deve ser maior que a data inicial');
      return;
    }

    setIsDistributing(true);
    try {
      await onDistribute({
        subtopics,
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error distributing subtopics:', error);
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Distribuir subtópicos automaticamente</DialogTitle>
          <DialogDescription>
            Agendar todos os {subtopics.length} subtópicos de "{topicTitle}" em sequência
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">Total de subtópicos:</span>
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
          </div>

          {/* Date Range Picker */}
          <div className="space-y-2">
            <Label htmlFor="date-range">
              <Calendar className="w-4 h-4 inline mr-1" />
              Período de agendamento
            </Label>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => setDateRange(range as { from: Date; to: Date } | undefined)}
            />
            <p className="text-xs text-gray-500">
              Os subtópicos serão distribuídos sequencialmente neste período
            </p>
          </div>

          {/* Subtopics List (preview) */}
          <div className="space-y-2">
            <Label>Subtópicos que serão agendados:</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
              {subtopics.map((sub, index) => (
                <div key={sub.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-gray-700">
                    {index + 1}. {sub.title}
                  </span>
                  <span className="text-gray-500">
                    {Math.floor((sub.estimated_duration_minutes || 90) / 60)}h
                    {(sub.estimated_duration_minutes || 90) % 60 > 0 ?
                      `${(sub.estimated_duration_minutes || 90) % 60}m` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={!dateRange?.from || !dateRange?.to || isDistributing}
          >
            {isDistributing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Distribuir e Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
