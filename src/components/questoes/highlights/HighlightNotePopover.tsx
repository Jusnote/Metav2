import React, { useState } from 'react';
import { COLORS, MARK_TYPES, typeLabel } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { Highlight, MarkTypeId } from './types';

export interface HighlightNotePopoverProps {
  highlight: Highlight;
  position: { left: number; top: number };
  onChange: (patch: Partial<Pick<Highlight, 'type' | 'color' | 'note'>>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function HighlightNotePopover({ highlight, position, onChange, onRemove, onClose }: HighlightNotePopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(highlight.note ?? '');

  function commitNote() {
    if (draft.trim() !== (highlight.note ?? '')) onChange({ note: draft.trim() });
  }

  return (
    <div className="qh-pop qh-note" style={{ left: position.left, top: position.top }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="qh-nh">
        <span className="qh-mk"><TriangleIcon color={highlight.color} size={17} /></span>
        <div className={`qh-dd ${open ? 'open' : ''}`}>
          <button type="button" className="qh-ddbtn" onClick={() => setOpen(o => !o)}>
            {typeLabel(highlight.type)} <span className="car">▾</span>
          </button>
          <div className="qh-ddmenu" aria-hidden={!open}>
            {MARK_TYPES.map(t => (
              <button key={t.id} type="button" tabIndex={open ? 0 : -1} onClick={() => { onChange({ type: t.id as MarkTypeId }); setOpen(false); }}>{t.label}</button>
            ))}
          </div>
        </div>
        <button type="button" className="qh-trash" aria-label="Remover" onClick={onRemove}>🗑</button>
      </div>
      <textarea placeholder="Anote o porquê…" value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={commitNote} autoFocus />
      <div className="qh-divln" />
      <div className="qh-crow">
        {COLORS.map(c => (
          <button key={c} type="button" data-testid={`note-swatch-${c}`} aria-label={`Cor ${c}`}
            className={`qh-dot ${c === highlight.color ? 'on' : ''}`} style={{ background: c }}
            onClick={() => onChange({ color: c })} />
        ))}
      </div>
    </div>
  );
}
