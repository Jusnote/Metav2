import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Info, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TimeEstimateInputProps {
  value: number; // minutos
  onChange: (minutes: number) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

const PRESETS = [
  { label: 'Rápido', minutes: 45, description: '30-60min' },
  { label: 'Médio', minutes: 90, description: '1h-2h' },
  { label: 'Longo', minutes: 150, description: '2h-3h' },
  { label: 'Muito Longo', minutes: 240, description: '4h+' },
];

export function TimeEstimateInput({
  value,
  onChange,
  label = 'Tempo estimado de conclusão',
  error,
  disabled = false,
}: TimeEstimateInputProps) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  const handleHoursChange = (h: number) => {
    const newHours = Math.max(0, Math.min(10, h)); // Max 10h
    onChange(newHours * 60 + minutes);
  };

  const handleMinutesChange = (m: number) => {
    const newMinutes = Math.max(0, Math.min(59, m)); // Max 59min
    onChange(hours * 60 + newMinutes);
  };

  const formatTotalTime = () => {
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}min`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}min`;
  };

  return (
    <div className="space-y-3">
      {/* Label com tooltip */}
      <div className="flex items-center gap-2">
        <Label htmlFor="time-estimate" className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          {label}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              Tempo total estimado incluindo leitura, criação/estudo de flashcards e resolução de questões.
              <br />
              <br />
              <strong>Parte 1 (60%)</strong>: Leitura + Flashcards
              <br />
              <strong>Parte 2 (40%)</strong>: Questões
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Inputs de horas e minutos */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            id="hours-input"
            type="number"
            min="0"
            max="10"
            value={hours}
            onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
            placeholder="0"
            disabled={disabled}
            className="text-center"
          />
          <span className="text-xs text-muted-foreground mt-1 block text-center">
            horas
          </span>
        </div>

        <span className="text-2xl text-muted-foreground font-semibold mb-5">:</span>

        <div className="flex-1">
          <Input
            id="minutes-input"
            type="number"
            min="0"
            max="59"
            step="5"
            value={minutes}
            onChange={(e) => handleMinutesChange(parseInt(e.target.value) || 0)}
            placeholder="0"
            disabled={disabled}
            className="text-center"
          />
          <span className="text-xs text-muted-foreground mt-1 block text-center">
            minutos
          </span>
        </div>
      </div>

      {/* Presets rápidos */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Presets rápidos:</Label>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((preset) => (
            <Tooltip key={preset.label}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={value === preset.minutes ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChange(preset.minutes)}
                  disabled={disabled}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{preset.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Total formatado */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md border">
        <span className="text-sm text-muted-foreground">Tempo total:</span>
        <span className="text-sm font-semibold text-foreground">
          {formatTotalTime()} ({value} minutos)
        </span>
      </div>

      {/* Divisão Parte 1 / Parte 2 */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
          <div className="font-medium text-blue-700 dark:text-blue-400">
            📖 Parte 1 (60%)
          </div>
          <div className="text-blue-600 dark:text-blue-500 mt-1">
            {Math.ceil(value * 0.6)}min
          </div>
          <div className="text-[10px] text-blue-600/70 dark:text-blue-500/70 mt-0.5">
            Leitura + Flashcards
          </div>
        </div>

        <div className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded-md border border-purple-200 dark:border-purple-900">
          <div className="font-medium text-purple-700 dark:text-purple-400">
            ❓ Parte 2 (40%)
          </div>
          <div className="text-purple-600 dark:text-purple-500 mt-1">
            {Math.ceil(value * 0.4)}min
          </div>
          <div className="text-[10px] text-purple-600/70 dark:text-purple-500/70 mt-0.5">
            Questões
          </div>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
