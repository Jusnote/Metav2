import React, { useRef } from 'react';
import { HighlightLayer } from './HighlightLayer';
import { hitTest, type RelRect } from './lib/highlight-render';
import type { Highlight } from './types';

/**
 * Envolve um bloco de HTML sanitizado (enunciado ou alternativa) e torna-o
 * "markável": pinta as marcas via HighlightLayer (overlay, sem mutar o DOM),
 * reporta seleção pra cima (onSelect) e abre a marca clicada (onClickHighlight),
 * tratando clique vs seleção e marca comum vs Atenção.
 */
export function MarkableBlock({
  html, target, highlights, onSelect, onClickHighlight, className, style, hostClassName,
}: {
  html: { __html: string };
  target: string;
  highlights: Highlight[];
  onSelect: (block: HTMLElement, target: string) => void;
  onClickHighlight: (hl: Highlight, at: { left: number; top: number }) => void;
  className?: string;
  style?: React.CSSProperties;
  hostClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const resolved = useRef<{ hl: Highlight; rects: RelRect[] }[]>([]);

  function handleClick(e: React.MouseEvent) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return; // é seleção, não clique
    if (!ref.current) return;
    if ((e.target as HTMLElement).closest('.qh-tri')) return;     // triângulo já trata
    const idx = hitTest({ x: e.clientX, y: e.clientY }, resolved.current.map(r => r.rects), ref.current);
    if (idx >= 0) {
      e.stopPropagation(); // não deixa o clique virar seleção de alternativa
      onClickHighlight(resolved.current[idx].hl, { left: e.clientX, top: e.clientY });
    }
  }

  return (
    <div
      className={`qh-host ${hostClassName ?? ''}`}
      ref={ref}
      onMouseUp={() => ref.current && onSelect(ref.current, target)}
      onClick={handleClick}
    >
      <div className={className} style={style} dangerouslySetInnerHTML={html} />
      <HighlightLayer
        blockRef={ref}
        highlights={highlights}
        onClickHighlight={onClickHighlight}
        onResolvedChange={(items) => { resolved.current = items; }}
      />
    </div>
  );
}
