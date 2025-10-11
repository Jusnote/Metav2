import * as React from 'react';
import { CheckCircle2, Loader2, XCircle, Cloud } from 'lucide-react';
import { SaveStatus } from '@/types/plate-document';
import { cn } from '@/lib/utils';

interface SaveIndicatorProps {
  status: SaveStatus;
  className?: string;
}

/**
 * Componente para indicar visualmente o status de salvamento
 */
export function SaveIndicator({ status, className }: SaveIndicatorProps) {
  const getStatusDisplay = () => {
    switch (status.type) {
      case 'idle':
        return {
          icon: Cloud,
          text: 'Sincronizado',
          iconClassName: 'text-muted-foreground',
          textClassName: 'text-muted-foreground',
        };

      case 'saving':
        return {
          icon: Loader2,
          text: 'Salvando...',
          iconClassName: 'text-blue-500 animate-spin',
          textClassName: 'text-blue-500',
        };

      case 'saved':
        return {
          icon: CheckCircle2,
          text: 'Salvo',
          iconClassName: 'text-green-500',
          textClassName: 'text-green-500',
        };

      case 'error':
        return {
          icon: XCircle,
          text: 'Erro ao salvar',
          iconClassName: 'text-destructive',
          textClassName: 'text-destructive',
        };
    }
  };

  const { icon: Icon, text, iconClassName, textClassName } = getStatusDisplay();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className={cn('h-4 w-4', iconClassName)} />
      <span className={cn('text-sm font-medium', textClassName)}>
        {text}
      </span>
    </div>
  );
}

/**
 * Versão compacta - apenas ícone
 */
export function SaveIndicatorCompact({ status, className }: SaveIndicatorProps) {
  const getStatusDisplay = () => {
    switch (status.type) {
      case 'idle':
        return {
          icon: Cloud,
          className: 'text-muted-foreground',
          title: 'Sincronizado',
        };

      case 'saving':
        return {
          icon: Loader2,
          className: 'text-blue-500 animate-spin',
          title: 'Salvando...',
        };

      case 'saved':
        return {
          icon: CheckCircle2,
          className: 'text-green-500',
          title: 'Salvo',
        };

      case 'error':
        return {
          icon: XCircle,
          className: 'text-destructive',
          title: status.message || 'Erro ao salvar',
        };
    }
  };

  const { icon: Icon, className: iconClassName, title } = getStatusDisplay();

  return (
    <div className={cn('flex items-center', className)} title={title}>
      <Icon className={cn('h-4 w-4', iconClassName)} />
    </div>
  );
}
