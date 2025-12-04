import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import type { DayConflict } from '@/lib/schedule-distribution';

interface PreviewItem {
  id: string;
  title: string;
  estimatedMinutes: number;
  type: 'topic' | 'subtopic';
}

interface ManualItem {
  scheduled_date: string;
  estimated_duration: number;
  title: string;
}

interface GoalPreviewSummaryProps {
  scenario: 'normal' | 'tight' | 'relaxed' | 'impossible';
  isValid: boolean;
  warnings: string[];
  conflicts: DayConflict[];
  days: number;
  itemCount: number;
  totalHours: number;
  totalMinutes: number;
  availableMinutes: number;
  utilizationPercentage: number;
  items: PreviewItem[];
  manualItems: ManualItem[];
  enableFSRS?: boolean;
}

export function GoalPreviewSummary({
  scenario,
  isValid,
  warnings,
  conflicts,
  days,
  itemCount,
  totalHours,
  totalMinutes,
  availableMinutes,
  utilizationPercentage,
  items,
  manualItems,
  enableFSRS = false,
}: GoalPreviewSummaryProps) {
  // Cores e ícones por cenário
  const scenarioConfig = {
    impossible: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
      textMuted: 'text-red-700',
      icon: AlertCircle,
      label: '❌ Impossível',
      progressColor: 'bg-red-500',
    },
    tight: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
      textMuted: 'text-yellow-700',
      icon: AlertTriangle,
      label: '⚠️ Apertado',
      progressColor: 'bg-yellow-500',
    },
    relaxed: {
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      text: 'text-blue-900',
      textMuted: 'text-blue-700',
      icon: Info,
      label: '✨ Folgado',
      progressColor: 'bg-blue-500',
    },
    normal: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
      textMuted: 'text-green-700',
      icon: CheckCircle2,
      label: '✅ Normal',
      progressColor: 'bg-green-500',
    },
  };

  const config = scenarioConfig[scenario];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg p-4 space-y-4 ${config.bg} border ${config.border}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${config.text}`} />
        <h4 className={`font-semibold text-sm ${config.text}`}>
          📊 Preview da Meta - {config.label}
        </h4>
      </div>

      {/* Estatísticas principais */}
      <div className={`text-sm space-y-2 ${config.text}`}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs opacity-70">Duração</p>
            <p className="font-semibold">{days} dias</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Itens</p>
            <p className="font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Tempo estimado</p>
            <p className="font-semibold">{totalHours}h ({totalMinutes} min)</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Capacidade</p>
            <p className="font-semibold">{Math.round(availableMinutes / 60)}h ({availableMinutes} min)</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs opacity-70">
            <span>Utilização</span>
            <span>{utilizationPercentage}%</span>
          </div>
          <Progress
            value={Math.min(utilizationPercentage, 100)}
            className="h-2"
          />
        </div>
      </div>

      {/* Lista de itens selecionados */}
      {items.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs font-semibold ${config.text}`}>
            Itens selecionados:
          </p>
          <div className={`text-xs space-y-1 ${config.textMuted} max-h-32 overflow-y-auto`}>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.type === 'subtopic' ? '  └─ ' : '• '}
                  {item.title}
                </span>
                <span className="opacity-70">
                  {Math.floor(item.estimatedMinutes / 60)}h{item.estimatedMinutes % 60 > 0 ? `${item.estimatedMinutes % 60}m` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflitos detectados */}
      {conflicts.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <p className="font-semibold mb-1">⚠️ {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''} detectado{conflicts.length > 1 ? 's' : ''}:</p>
            <ul className="space-y-0.5 ml-4 list-disc">
              {conflicts.slice(0, 3).map((conflict, i) => {
                const formatTime = (minutes: number) => {
                  const hours = Math.floor(minutes / 60);
                  const mins = minutes % 60;
                  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
                };

                return (
                  <li key={i}>
                    {conflict.date}: {formatTime(conflict.requiredMinutes)} necessário,
                    apenas {formatTime(conflict.availableMinutes)} disponível
                    (+{conflict.overloadPercentage}% sobrecarga)
                  </li>
                );
              })}
              {conflicts.length > 3 && (
                <li className="opacity-70">... e mais {conflicts.length - 3} conflitos</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Avisos */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning, index) => (
            <p
              key={index}
              className={`text-xs ${config.textMuted}`}
            >
              • {warning}
            </p>
          ))}
        </div>
      )}

      {/* FSRS info */}
      {enableFSRS && isValid && (
        <p className="text-xs opacity-80 mt-2 pt-2 border-t border-current/20">
          ✨ Com FSRS, as revisões serão otimizadas baseado na sua performance
        </p>
      )}
    </div>
  );
}
