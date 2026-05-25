'use client';

interface Props {
  open: boolean;
  onToggle: () => void;
}

export function MenuButton({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="lei-seca-megamenu"
      className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12.5px] text-n-ink-2 border border-n-rule bg-n-surface hover:bg-n-rule-2 hover:text-n-ink transition-colors"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3 5h10M3 8h10M3 11h10" />
      </svg>
      <span>Navegar</span>
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path d="M2 3.5l2.5 2.5L7 3.5" />
      </svg>
    </button>
  );
}
