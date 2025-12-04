import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react';

interface DayExceptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  currentHours: number;
  defaultHours: number;
  onSave: (hours: number, reason?: string) => void;
  onRemove?: () => void;
  hasException: boolean;
}

export function DayExceptionModal({
  open,
  onOpenChange,
  date,
  currentHours,
  defaultHours,
  onSave,
  onRemove,
  hasException,
}: DayExceptionModalProps) {
  const [hours, setHours] = useState(currentHours);
  const [reason, setReason] = useState('');

  const handleSave = () => {
    onSave(hours, reason || undefined);
    onOpenChange(false);
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            Disponibilidade Personalizada
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Disponibilidade atual */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Disponibilidade padrão:</span>
              <span className="font-medium text-slate-900">{defaultHours}h</span>
            </div>
            {hasException && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-600">Atual (customizada):</span>
                <span className="font-medium text-blue-600">{currentHours}h 📌</span>
              </div>
            )}
          </div>

          {/* Slider de horas */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-normal text-slate-900">Nova Disponibilidade</Label>
              <p className="text-sm text-slate-500 mt-1">Defina quantas horas você terá disponível neste dia</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Horas disponíveis</span>
                <span className="text-lg font-medium text-slate-900">{hours}h</span>
              </div>
              <Slider
                value={[hours]}
                onValueChange={(v) => setHours(v[0])}
                min={0}
                max={12}
                step={0.5}
                className="w-full"
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>0h (Indisponível)</span>
                <span>12h</span>
              </div>
            </div>
          </div>

          {/* Motivo (opcional) */}
          <div className="space-y-2">
            <Label className="text-sm font-normal text-slate-700">Motivo (opcional)</Label>
            <Input
              placeholder="Ex: Folga, Reunião, Evento familiar..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-slate-200"
            />
          </div>

          {/* Preview do impacto */}
          {hours !== defaultHours && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                {hours > defaultHours ? (
                  <>
                    <strong>+{(hours - defaultHours).toFixed(1)}h</strong> a mais que o padrão
                  </>
                ) : hours < defaultHours && hours > 0 ? (
                  <>
                    <strong>-{(defaultHours - hours).toFixed(1)}h</strong> a menos que o padrão
                  </>
                ) : (
                  <>Dia marcado como <strong>indisponível</strong></>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {hasException && onRemove && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                className="text-slate-600 hover:text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Restaurar Padrão
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {hasException ? 'Atualizar' : 'Aplicar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
