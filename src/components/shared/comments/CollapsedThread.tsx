'use client';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CollapsedThreadProps {
  replyCount: number;
  expanded: boolean;
  onToggle: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollapsedThread({ replyCount, expanded, onToggle }: CollapsedThreadProps) {
  return (
    <div className="ml-[38px]">
      <button
        type="button"
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <span aria-hidden="true">↳</span>
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-current text-[10px] leading-none"
          aria-hidden="true"
        >
          {expanded ? '−' : '+'}
        </span>
        <span>
          {expanded
            ? 'Ocultar respostas'
            : `Ver ${replyCount} respostas de um comentário removido`}
        </span>
      </button>
    </div>
  );
}
