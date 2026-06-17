import React from 'react';
import { MARK_COLORS } from './highlights.config';

/**
 * Mini-menu da marca sem balão (plain/underline/strike), aberto no clique:
 * uma fileira com as 8 cores do mock (a atual com anel) + lixeira — igual ao
 * `.cmenu` do mock aprovado. (O "Virar Atenção" do layout antigo saiu.)
 */
export interface PlainHighlightMenuProps {
  color: string;
  onColor: (c: string) => void;
  onRemove: () => void;
}

export function PlainHighlightMenu({ color, onColor, onRemove }: PlainHighlightMenuProps) {
  return (
    <div className="qh-pop qh-cmenu" onMouseDown={(e) => e.stopPropagation()}>
      {MARK_COLORS.map(c => (
        <button
          key={c}
          type="button"
          data-testid={`plain-swatch-${c}`}
          aria-label={`Cor ${c}`}
          className={`d${c === color ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => onColor(c)}
        />
      ))}
      <button type="button" className="rm" aria-label="Remover" title="Remover" onClick={onRemove}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </div>
  );
}
