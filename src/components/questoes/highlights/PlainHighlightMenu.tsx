import React from 'react';
import { COLORS } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';

export interface PlainHighlightMenuProps {
  color: string;
  position: { left: number; top: number };
  onColor: (c: string) => void;
  onPromote: () => void;
  onRemove: () => void;
}

export function PlainHighlightMenu({ color, position, onColor, onPromote, onRemove }: PlainHighlightMenuProps) {
  return (
    <div className="qh-pop qh-plain" style={{ left: position.left, top: position.top }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="qh-crow">
        {COLORS.map(c => (
          <button key={c} type="button" data-testid={`plain-swatch-${c}`} aria-label={`Cor ${c}`}
            className={`qh-dot ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(c)} />
        ))}
      </div>
      <div className="qh-acts">
        <button type="button" className="att" onClick={onPromote}><TriangleIcon color="#E0484D" size={14} /> Virar Atenção</button>
        <button type="button" className="rm" onClick={onRemove}>🗑 Remover</button>
      </div>
    </div>
  );
}
