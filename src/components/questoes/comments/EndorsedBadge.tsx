import { Crown } from 'lucide-react';

interface EndorsedBadgeProps {
  endorsedBy?: string;
}

export function EndorsedBadge({ endorsedBy }: EndorsedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
      <Crown className="h-2.5 w-2.5" />
      {endorsedBy ? `Endossado por ${endorsedBy}` : 'Endossado'}
    </span>
  );
}
