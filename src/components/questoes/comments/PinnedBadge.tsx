import { Pin } from 'lucide-react';

export function PinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
      <Pin className="h-2.5 w-2.5" />
      FIXADO
    </span>
  );
}
