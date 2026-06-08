import React, { useState } from 'react';
import { COLORS, MARK_TYPES, typeLabel } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { Highlight, MarkTypeId } from './types';

const PencilIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);

function TypeLabel({ highlight }: { highlight: Highlight }) {
  return (
    <span className="qh-tlabel">
      <span className="qh-tri-sm"><TriangleIcon color={highlight.color} size={13} /></span>
      <span className="qh-tt">{typeLabel(highlight.type)}</span>
    </span>
  );
}

export interface HighlightBalloonProps {
  highlight: Highlight;
  mode: 'read' | 'edit';
  onEdit: () => void;
  onChange: (patch: Partial<Pick<Highlight, 'type' | 'color' | 'note'>>) => void;
  onRemove: () => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Balão único, ancorado na marca (abre pra baixo): no hover mostra a nota (leitura);
 * o lápis vira modo edição (textarea + tipo + cor), "fixado" enquanto se escreve.
 */
export function HighlightBalloon({
  highlight, mode, onEdit, onChange, onRemove, onClose, onMouseEnter, onMouseLeave,
}: HighlightBalloonProps) {
  const [draft, setDraft] = useState(highlight.note ?? '');
  const [ddOpen, setDdOpen] = useState(false);

  function commitAndClose() {
    if (draft.trim() !== (highlight.note ?? '')) onChange({ note: draft.trim() });
    onClose();
  }

  const shell = (children: React.ReactNode) => (
    <div className="qh-pop qh-balloon" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );

  if (mode === 'read') {
    return shell(
      <div className="b-read">
        <div className="rh">
          <TypeLabel highlight={highlight} />
          <button type="button" className="pen" aria-label="Editar" onClick={onEdit}><PencilIcon /></button>
        </div>
        <div className={highlight.note ? 'txt' : 'empty'}>
          {highlight.note || 'Sem anotação ainda — clique no lápis pra escrever.'}
        </div>
      </div>
    );
  }

  return shell(
    <div className="b-edit">
      <div className="eh">
        <div className={`qh-edd ${ddOpen ? 'open' : ''}`}>
          <button type="button" className="b" onClick={() => setDdOpen(o => !o)}>
            <TypeLabel highlight={highlight} /><span className="car">▾</span>
          </button>
          <div className="m" aria-hidden={!ddOpen}>
            {MARK_TYPES.map(t => (
              <button key={t.id} type="button" tabIndex={ddOpen ? 0 : -1}
                onClick={() => { onChange({ type: t.id as MarkTypeId }); setDdOpen(false); }}>{t.label}</button>
            ))}
          </div>
        </div>
        <span className="sp">
          <button type="button" className="ic del" aria-label="Remover" onMouseDown={(e) => e.preventDefault()} onClick={onRemove}><TrashIcon /></button>
          <button type="button" className="ic" aria-label="Fechar" onClick={commitAndClose}>✕</button>
        </span>
      </div>
      <textarea placeholder="Escreva a pegadinha… por que cai aqui?" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim() !== (highlight.note ?? '')) onChange({ note: draft.trim() }); }}
        autoFocus />
      <div className="ef">
        <span className="colors">
          {COLORS.map(c => (
            <button key={c} type="button" data-testid={`bln-swatch-${c}`} aria-label={`Cor ${c}`}
              className={`qh-dot ${c === highlight.color ? 'on' : ''}`} style={{ background: c }}
              onClick={() => onChange({ color: c })} />
          ))}
        </span>
        <button type="button" className="save" onClick={commitAndClose}>Salvar</button>
      </div>
    </div>
  );
}
