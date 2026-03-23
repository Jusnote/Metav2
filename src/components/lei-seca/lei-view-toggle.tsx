'use client';

import { cn } from '@/lib/utils';

interface LeiViewToggleProps {
  mode: 'completo' | 'lei-seca';
  onChange: (mode: 'completo' | 'lei-seca') => void;
  className?: string;
}

export function LeiViewToggle({ mode, onChange, className }: LeiViewToggleProps) {
  return (
    <div className={cn('inline-flex rounded-lg border bg-muted p-0.5', className)}>
      <button
        onClick={() => onChange('completo')}
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md transition-colors',
          mode === 'completo'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Completo
      </button>
      <button
        onClick={() => onChange('lei-seca')}
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md transition-colors',
          mode === 'lei-seca'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Lei Seca
      </button>
    </div>
  );
}
