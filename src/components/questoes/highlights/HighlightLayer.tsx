import React, { useLayoutEffect, useRef, useState } from 'react';
import { resolveAnchor } from './lib/highlight-anchor';
import { rangeRects, trianglePos, type RelRect } from './lib/highlight-render';
import { bgFor } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { Highlight } from './types';

interface Resolved { hl: Highlight; rects: RelRect[]; tri: { left: number; top: number } | null; }

export function HighlightLayer({
  blockRef, highlights, onClickHighlight, onResolvedChange, onHoverHighlight,
  hideMarks, eraseMode, hoveredId,
}: {
  blockRef: React.RefObject<HTMLElement>;
  highlights: Highlight[];
  onClickHighlight: (hl: Highlight, anchorEl: { left: number; top: number }) => void;
  onResolvedChange?: (items: { hl: Highlight; rects: RelRect[] }[]) => void;
  onHoverHighlight?: (hl: Highlight | null) => void;
  /** Olhinho: oculta tudo (fundos, linhas, wash, triângulos). */
  hideMarks?: boolean;
  /** Borracha: contorno tracejado em toda marca; a hovered ganha wash vermelho. */
  eraseMode?: boolean;
  hoveredId?: string | null;
}) {
  const [resolved, setResolved] = useState<Resolved[]>([]);
  const raf = useRef<number>(0);

  useLayoutEffect(() => {
    // O ref do bloco (pai) ainda NÃO está atado quando o layout effect do filho
    // roda no mount — por isso o blockRef é lido dentro do rAF (pós-commit).
    let ro: ResizeObserver | null = null;

    const recompute = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const block = blockRef.current;
        if (!block) return;
        if (!ro) { ro = new ResizeObserver(recompute); ro.observe(block); }
        const next: Resolved[] = [];
        for (const hl of highlights) {
          const range = resolveAnchor(block, { quote: hl.quote, prefix: hl.prefix, suffix: hl.suffix });
          if (!range) continue;
          next.push({ hl, rects: rangeRects(range, block), tri: hl.kind === 'attention' ? trianglePos(range, block) : null });
        }
        setResolved(next);
        onResolvedChange?.(next.map(r => ({ hl: r.hl, rects: r.rects })));
      });
    };

    recompute();
    window.addEventListener('resize', recompute);
    return () => { ro?.disconnect(); window.removeEventListener('resize', recompute); cancelAnimationFrame(raf.current); };
  }, [blockRef, highlights]);

  if (hideMarks) return null;

  return (
    <>
      {/* overlay de baixo (z:0, sob o texto): fundos do plain/attention + triângulo */}
      <div className="qh-overlay" aria-hidden>
        {resolved.map(({ hl, rects, tri }) => (
          <React.Fragment key={hl.id}>
            {(hl.kind === 'plain' || hl.kind === 'attention') && rects.map((r, i) => (
              <span key={i} className="qh-bg" style={{
                left: r.left - 1, top: r.top, width: r.width + 2, height: r.height,
                background: bgFor(hl.color, hl.kind),
              }} />
            ))}
            {tri && (
              <span className="qh-tri" style={{ left: tri.left, top: tri.top }}
                onClick={(e) => onClickHighlight(hl, { left: e.clientX, top: e.clientY })}
                onMouseEnter={() => onHoverHighlight?.(hl)}
                onMouseLeave={() => onHoverHighlight?.(null)}>
                <TriangleIcon color={hl.color} size={13} />
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      {/* overlay de cima (z:2, SOBRE o texto): linhas do sublinhado/tachado, wash do tachado e visual da borracha */}
      <div className="qh-overlay qh-overlay-top" aria-hidden>
        {resolved.map(({ hl, rects }) => (
          <React.Fragment key={hl.id}>
            {hl.kind === 'underline' && rects.map((r, i) => (
              <span key={i} className="qh-line" style={{
                left: r.left - 1, top: r.top + r.height - 2, width: r.width + 2, height: 2,
                background: hl.color,
              }} />
            ))}
            {hl.kind === 'strike' && rects.map((r, i) => (
              <React.Fragment key={i}>
                {/* wash da cor do papel ofusca as letras (~42% de tinta, como o mock) */}
                <span className="qh-wash" style={{
                  left: r.left - 1, top: r.top, width: r.width + 2, height: r.height,
                }} />
                {/* linha a 52% da altura (equivale ao background-position 52% do mock), por cima do wash */}
                <span className="qh-line" style={{
                  left: r.left - 1, top: r.top + (r.height - 2) * 0.52, width: r.width + 2, height: 2,
                  background: hl.color,
                }} />
              </React.Fragment>
            ))}
            {eraseMode && rects.map((r, i) => (
              <span key={`e${i}`} className={`qh-erase${hl.id === hoveredId ? ' qh-erase-hover' : ''}`} style={{
                left: r.left - 1, top: r.top, width: r.width + 2, height: r.height,
              }} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
