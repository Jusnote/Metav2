'use client';

import { cn } from '@/lib/utils';

type Severity = 'high' | 'medium' | 'resolved';

const SEVERITY_STYLES: Record<Severity, { dot: string; ring: string }> = {
  high: {
    dot: 'bg-red-500',
    ring: 'shadow-[0_0_0_3px_#fef2f2]',
  },
  medium: {
    dot: 'bg-amber-500',
    ring: 'shadow-[0_0_0_3px_#fffbeb]',
  },
  resolved: {
    dot: 'bg-zinc-300',
    ring: '',
  },
};

interface StatusDotProps {
  severity: Severity;
  size?: number;
  className?: string;
}

export function StatusDot({ severity, size = 7, className }: StatusDotProps) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <div
      className={cn(
        'shrink-0 rounded-full',
        styles.dot,
        severity !== 'resolved' && styles.ring,
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
