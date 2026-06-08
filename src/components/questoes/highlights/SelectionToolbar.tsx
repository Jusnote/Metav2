import React, { useState } from 'react';
import { QUICK_COLORS } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { MarkKind } from './types';

export interface SelectionToolbarProps {
  onPick: (color: string, kind: MarkKind) => void;
  defaultKind?: MarkKind;
}

export function SelectionToolbar({ onPick, defaultKind = 'attention' }: SelectionToolbarProps) {
  const [kind, setKind] = useState<MarkKind>(defaultKind);
  return (
    <div
      className="qh-pop qh-selpop"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="qh-seg" role="group" aria-label="Tipo de marca">
        <button type="button" aria-pressed={kind === 'attention'} className={kind === 'attention' ? 'on' : ''} onClick={() => setKind('attention')}>
          <TriangleIcon color="#E0484D" size={13} /> Atenção
        </button>
        <button type="button" aria-pressed={kind === 'plain'} className={kind === 'plain' ? 'on' : ''} onClick={() => setKind('plain')}>
          Grifo comum
        </button>
      </div>
      <div className="qh-crow">
        {QUICK_COLORS.map((c) => (
          <button key={c} type="button" data-testid={`swatch-${c}`} aria-label={`Cor ${c}`}
            className="qh-dot" style={{ background: c }} onClick={() => onPick(c, kind)} />
        ))}
      </div>
    </div>
  );
}
