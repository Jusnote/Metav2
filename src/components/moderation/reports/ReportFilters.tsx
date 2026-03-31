'use client';

import { cn } from '@/lib/utils';

interface ReportFiltersProps {
  status: string | undefined;
  onStatusChange: (status: string | undefined) => void;
}

const STATUSES = [
  { value: undefined, label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'dismissed', label: 'Descartados' },
];

export function ReportFilters({ status, onStatusChange }: ReportFiltersProps) {
  return (
    <div className="flex gap-1">
      {STATUSES.map((s) => (
        <button
          key={s.label}
          onClick={() => onStatusChange(s.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
            status === s.value
              ? 'bg-violet-100 text-violet-700'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
