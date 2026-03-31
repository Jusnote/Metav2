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
    <div className="ml-10">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
      >
        <span aria-hidden="true">↳</span>
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-current text-[10px] leading-none transition-transform"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(0deg)' }}
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
