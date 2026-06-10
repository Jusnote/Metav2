import React from 'react';
import { MARK_COLORS, TOOLS } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import type { ToolId } from './types';

/**
 * Popover de seleção da marcação v2 (espelho do mock aprovado em
 * docs/superpowers/specs/2026-06-10-marcacao-v2-mock.html): SÓ ícones
 * △ |sep| marca-texto |sep| sublinhar |sep| tachar, cada um seguido da sua
 * paleta de 8 cores que desliza no hover (e abre numerada no fluxo de
 * teclado 1-4 → 1-8, via `pendingTool`).
 *
 * Clique no ícone = última cor da ferramenta; clique numa bolinha = cor
 * explícita. `.last` destaca o último tipo usado.
 *
 * CRÍTICO: preventDefault no mousedown do container — senão o clique colapsa
 * a seleção e não sobra nada pra marcar.
 */

/* Ícones tingidos com a última cor da ferramenta (mesmos paths do mock). */
function HighlighterIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4l8 8Z" />
    </svg>
  );
}

function UnderlineIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" aria-hidden>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" x2="20" y1="20" y2="20" />
    </svg>
  );
}

function StrikeIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" aria-hidden>
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <line x1="4" x2="20" y1="12" y2="12" />
    </svg>
  );
}

function toolIcon(tool: ToolId, lastCol: Record<ToolId, string>) {
  switch (tool) {
    case 'peg': return <TriangleIcon color={lastCol.peg} size={14} />;
    case 'comum': return <HighlighterIcon color={lastCol.comum} />;
    case 'sub': return <UnderlineIcon color={lastCol.sub} />;
    case 'tax': return <StrikeIcon color={lastCol.tax} />;
  }
}

export interface SelectionToolbarProps {
  /** Última ferramenta usada (ganha o destaque `.last`). */
  lastKind: ToolId;
  /** Última cor por ferramenta (tinge os ícones). */
  lastCol: Record<ToolId, string>;
  /** Fluxo numérico: paleta desta ferramenta forçada aberta e numerada (1-8). */
  pendingTool: ToolId | null;
  /** Sem cor = última cor da ferramenta. */
  onPick: (tool: ToolId, color?: string) => void;
}

export function SelectionToolbar({ lastKind, lastCol, pendingTool, onPick }: SelectionToolbarProps) {
  return (
    <div className="qh-pop qh-selpop" onMouseDown={(e) => e.preventDefault()}>
      {TOOLS.map((tool, i) => (
        <React.Fragment key={tool.id}>
          {i > 0 && <span className="sep" aria-hidden />}
          <button
            type="button"
            title={`${tool.label} (${tool.key})`}
            className={[
              tool.id === lastKind ? 'last' : '',
              tool.id === pendingTool ? 'sel' : '',
            ].filter(Boolean).join(' ') || undefined}
            onClick={() => onPick(tool.id)}
          >
            {toolIcon(tool.id, lastCol)}
          </button>
          {/* paleta: desliza no hover do botão; aberta+numerada no fluxo de teclado */}
          <span
            className={`qh-cpick${tool.id === pendingTool ? ' open nums' : ''}`}
            data-testid={`cpick-${tool.id}`}
          >
            {MARK_COLORS.map((c, n) => (
              <button
                key={c}
                type="button"
                className="d"
                data-n={n + 1}
                aria-label={`Cor ${c}`}
                style={{ background: c }}
                onClick={() => onPick(tool.id, c)}
              />
            ))}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
