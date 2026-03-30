import { Pin } from 'lucide-react';

export function PinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600">
      <Pin className="h-2.5 w-2.5" />
      Fixado
    </span>
  );
}
