import { Star } from 'lucide-react';

interface EndorsedBadgeProps {
  endorsedBy?: string;
}

export function EndorsedBadge({ endorsedBy }: EndorsedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
      <Star className="h-2.5 w-2.5 fill-amber-600" />
      {endorsedBy ? `Endossado por ${endorsedBy}` : 'Endossado'}
    </span>
  );
}
