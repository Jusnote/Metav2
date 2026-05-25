'use client';

import type { Lei } from '@/types/lei-api';

interface Props {
  lei: Lei;
  isSelected: boolean;
  isCurrent: boolean;
  totalArtigos: number | null;
  pctEstudado: number | null;
  onClick: () => void;
}

export function LawRow({ lei, isSelected, isCurrent, totalArtigos, pctEstudado, onClick }: Props) {
  const shortName = lei.apelido ?? lei.titulo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full text-left px-2.5 py-2 -mx-2.5 rounded-md transition-colors ' +
        (isSelected ? 'bg-n-accent-soft' : 'hover:bg-n-rule-2')
      }
    >
      <div className="flex items-baseline gap-2">
        <span
          className={
            'text-[13px] truncate ' +
            (isSelected ? 'text-n-accent font-semibold' : 'text-n-ink font-medium')
          }
        >
          {shortName}
        </span>
        {isCurrent && (
          <span className="text-n-accent text-[7px] shrink-0" aria-label="lei aberta">●</span>
        )}
      </div>
      <div className="text-[11px] text-n-ink-3 mt-0.5 font-n-mono truncate">
        {totalArtigos !== null ? `${totalArtigos} art.` : '— art.'}
        {' · '}
        {pctEstudado !== null ? `${pctEstudado}% estudados` : '—%'}
      </div>
    </button>
  );
}
