'use client';

import type { LegislativeAnnotation } from '@/types/lei-import';
import { cn } from '@/lib/utils';

const TIPO_LABELS: Record<string, string> = {
  redacao: 'Redacao alterada',
  inclusao: 'Incluido',
  revogacao: 'Revogado',
  vide: 'Vide',
  vigencia: 'Vigencia',
  regulamento: 'Regulamento',
  producao_efeito: 'Producao de efeito',
  veto: 'Vetado',
  acrescimo: 'Acrescimo',
  alteracao: 'Alteracao',
  supressao: 'Supressao',
  renumeracao: 'Renumeracao',
  promulgacao: 'Promulgacao',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  redacao: 'text-orange-400',
  inclusao: 'text-green-400',
  revogacao: 'text-red-400',
  vide: 'text-blue-400',
  vigencia: 'text-yellow-400',
  regulamento: 'text-purple-400',
  veto: 'text-red-500',
  acrescimo: 'text-emerald-400',
  alteracao: 'text-blue-400',
  supressao: 'text-rose-400',
  renumeracao: 'text-cyan-400',
  promulgacao: 'text-indigo-400',
  outro: 'text-gray-400',
};

interface LeiAnotacaoTooltipProps {
  annotations: LegislativeAnnotation[];
  className?: string;
}

export function LeiAnotacaoTooltip({ annotations, className }: LeiAnotacaoTooltipProps) {
  if (annotations.length === 0) return null;

  return (
    <div className={cn(
      'p-3 rounded-lg border border-orange-500/20 bg-orange-50 dark:bg-orange-950/20',
      'max-w-sm shadow-lg',
      className
    )}>
      <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">
        Historico Legislativo
      </div>
      <ul className="space-y-1">
        {annotations.map((a, i) => (
          <li key={i} className="text-xs leading-relaxed">
            <span className={cn('font-medium', TIPO_COLORS[a.tipo] || 'text-gray-400')}>
              {TIPO_LABELS[a.tipo] || a.tipo}
            </span>
            {a.lei_referenciada && (
              <span className="text-muted-foreground"> — Lei {a.lei_referenciada}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
