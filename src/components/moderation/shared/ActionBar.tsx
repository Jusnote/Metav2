'use client';

import { cn } from '@/lib/utils';

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 flex items-center gap-2 border-t border-zinc-100 bg-white px-6 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
