import React, { useLayoutEffect, useRef, useState } from 'react';
import { resolveAnchor } from './lib/highlight-anchor';
import { rangeRects, trianglePos, type RelRect } from './lib/highlight-render';
import { bgFor } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { Highlight } from './types';

interface Resolved { hl: Highlight; rects: RelRect[]; tri: { left: number; top: number } | null; }

export function HighlightLayer({
  blockRef, highlights, onClickHighlight,
}: {
  blockRef: React.RefObject<HTMLElement>;
  highlights: Highlight[];
  onClickHighlight: (hl: Highlight, anchorEl: { left: number; top: number }) => void;
}) {
  const [resolved, setResolved] = useState<Resolved[]>([]);
  const raf = useRef<number>(0);

  useLayoutEffect(() => {
    const block = blockRef.current;
    if (!block) return;

    const recompute = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const next: Resolved[] = [];
        for (const hl of highlights) {
          const range = resolveAnchor(block, { quote: hl.quote, prefix: hl.prefix, suffix: hl.suffix });
          if (!range) continue;
          next.push({ hl, rects: rangeRects(range, block), tri: hl.kind === 'attention' ? trianglePos(range, block) : null });
        }
        setResolved(next);
      });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(block);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); cancelAnimationFrame(raf.current); };
  }, [blockRef, highlights]);

  return (
    <div className="qh-overlay" aria-hidden>
      {resolved.map(({ hl, rects, tri }) => (
        <React.Fragment key={hl.id}>
          {rects.map((r, i) => (
            <span key={i} className="qh-bg" style={{
              left: r.left - 2, top: r.top, width: r.width + 4, height: r.height,
              background: bgFor(hl.color, hl.kind),
            }} />
          ))}
          {tri && (
            <span className="qh-tri" style={{ left: tri.left, top: tri.top }}
              onClick={() => onClickHighlight(hl, tri)}>
              <TriangleIcon color={hl.color} size={13} />
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
