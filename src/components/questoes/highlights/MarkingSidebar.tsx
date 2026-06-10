import React, { useEffect, useState } from 'react';
import { useMarkingTools } from './MarkingToolsContext';
import { MARK_COLORS, TOOLS } from './highlights.config';
import { TriangleIcon } from './TriangleIcon';
import { useHighlightsCount } from '@/hooks/useHighlightsAll';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ToolId } from './types';

/**
 * Barra lateral flutuante da marcação v2 (espelho 1:1 do mock aprovado em
 * docs/superpowers/specs/2026-06-10-marcacao-v2-mock.html).
 *
 * Encolhida (selTool on) = setinha acesa + caderno. Expandida = 4 tipos com
 * accordion vertical de cores + borracha + olhinho. Atalhos globais SEM
 * seleção (1-4/E/H/Esc) e cursor-marcador moram aqui (montada 1x por página).
 */

/**
 * Cursor-marcador: marker rotacionado (Lucide highlighter) tingido com a cor
 * da caneta, com halo branco pra ler sobre qualquer texto. O bico do marker
 * fica no canto inferior-esquerdo do viewBox 24×24 → hotspot `4 20`.
 */
function penCursor(color: string): string {
  const paths =
    '<path d="m9 11-6 6v3h9l3-3"/>' +
    '<path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4l8 8Z"/>';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    `<g stroke="#fff" stroke-width="3.6">${paths}</g>` +
    `<g stroke="${color}" stroke-width="2">${paths}</g>` +
    '</svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 4 20`;
}

function HighlighterIcon({ color }: { color: string }) {
  return (
    <svg className="qh-bar-ic15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4l8 8Z" />
    </svg>
  );
}

function UnderlineIcon({ color }: { color: string }) {
  return (
    <svg className="qh-bar-ic15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" aria-hidden>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" x2="20" y1="20" y2="20" />
    </svg>
  );
}

function StrikeIcon({ color }: { color: string }) {
  return (
    <svg className="qh-bar-ic15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" aria-hidden>
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

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function hasTextSelection(): boolean {
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && !!sel.toString().trim();
}

export function MarkingSidebar() {
  const {
    selTool, mode, modeColor, erase, hideMarks, lastCol,
    pickPen, releasePen, toggleSelTool, setErase, toggleHideMarks,
  } = useMarkingTools();
  const { data: count } = useHighlightsCount();
  const isMobile = useIsMobile();

  /** Accordion de cores aberto sob qual ferramenta (null = nenhum). */
  const [vpick, setVpick] = useState<ToolId | null>(null);

  // Atalhos globais SEM seleção (com seleção os atalhos são do card — Task 3).
  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // Esc SEMPRE solta caneta/borracha (mesmo com seleção viva — senão fica preso no modo)
      if (e.key === 'Escape') {
        setVpick(null);
        if (mode || erase) toggleSelTool(); // solta caneta/borracha e religa a seleção
        return;
      }
      if (hasTextSelection()) return;
      if (e.key >= '1' && e.key <= '4') {
        setVpick(null);
        pickPen(TOOLS[Number(e.key) - 1].id); // última cor da ferramenta
        return;
      }
      // E colide com a seleção de alternativa por teclado (A-E): só vale com o foco FORA de um card
      if ((e.key === 'e' || e.key === 'E') && !document.activeElement?.closest('article[data-question-id]')) {
        setVpick(null); setErase(!erase); return;
      }
      if (e.key === 'h' || e.key === 'H') { toggleHideMarks(); return; }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobile, erase, mode, pickPen, setErase, toggleHideMarks, toggleSelTool]);

  // Clique fora fecha o accordion de cores (mesma regra do mock).
  useEffect(() => {
    if (vpick === null) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && (t.closest('.qh-bar-vpick') || t.closest('.qh-bar-btool'))) return;
      setVpick(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [vpick]);

  // Caneta ativa = cursor-marcador nos blocos markáveis; borracha = pointer.
  useEffect(() => {
    if (!mode && !erase) return;
    const style = document.createElement('style');
    style.setAttribute('data-qh-pen-cursor', '');
    style.textContent = mode && modeColor
      ? `.qh-host > *:not(.qh-overlay){ cursor: ${penCursor(modeColor)}, text; }`
      : `.qh-host > *:not(.qh-overlay){ cursor: pointer; }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [mode, modeColor, erase]);

  if (isMobile) return null; // desktop-only por ora

  const onToolClick = (tool: ToolId) => {
    if (mode === tool) { setVpick(null); releasePen(); return; } // tipo ativo: clica de novo = solta
    setVpick(v => (v === tool ? null : tool)); // expande as cores embaixo; escolher = ativa a caneta
  };

  return (
    <nav className={`qh-bar${!selTool ? ' open' : ''}`} aria-label="Ferramentas de marcação">
      {/* setinha: com caneta/borracha → volta pro modo seleção; senão liga/desliga o popover */}
      <button
        type="button"
        className={`qh-bar-tool${selTool && !mode && !erase ? ' on' : ''}`}
        aria-label="Popover ao selecionar"
        onClick={() => { setVpick(null); toggleSelTool(); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 3.5 12.5 21l1.8-7 7-1.8L4 3.5Z" />
        </svg>
        <span className="qh-bar-tip" aria-hidden>Popover ao selecionar — clique pra ligar/desligar<small>Esc</small></span>
      </button>

      {/* bancada: encolhida no modo seleção; expande ao desmarcar a setinha */}
      <div className="qh-bar-toolset">
        <span className="qh-bar-div" />
        {TOOLS.map((tool, i) => (
          <React.Fragment key={tool.id}>
            <button
              type="button"
              className={`qh-bar-tool qh-bar-btool${mode === tool.id ? ' on' : ''}`}
              aria-label={tool.label}
              title={tool.label}
              onClick={() => onToolClick(tool.id)}
            >
              {toolIcon(tool.id, lastCol)}
              <span className="qh-bar-tip" aria-hidden>{tool.label}<small>{i + 1}</small></span>
            </button>
            {/* accordion vertical de cores sob o tipo clicado; recolhe ao escolher */}
            <span className={`qh-bar-vpick${vpick === tool.id ? ' open' : ''}`} data-for={tool.id}>
              {MARK_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className="d"
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                  onClick={() => { setVpick(null); pickPen(tool.id, c); }}
                />
              ))}
            </span>
          </React.Fragment>
        ))}
        <span className="qh-bar-div" />
        <button
          type="button"
          className={`qh-bar-tool qh-bar-eraser${erase ? ' on' : ''}`}
          aria-label="Borracha"
          onClick={() => { setVpick(null); setErase(!erase); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
          <span className="qh-bar-tip" aria-hidden>Borracha<small>E</small></span>
        </button>
        <button
          type="button"
          className={`qh-bar-tool${hideMarks ? ' on' : ''}`}
          aria-label="Mostrar/ocultar marcas"
          onClick={toggleHideMarks}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="qh-bar-tip" aria-hidden>Mostrar/ocultar marcas<small>H</small></span>
        </button>
      </div>

      <span className="qh-bar-div" />
      {/* caderno: porta do futuro Caderno de marcas (clique = no-op por ora) */}
      <button
        type="button"
        className="qh-bar-tool"
        aria-label="Caderno de marcas"
        title="Caderno de marcas — em breve"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
        {(count ?? 0) > 0 && <span className="qh-bar-badge">{count}</span>}
        <span className="qh-bar-tip" aria-hidden>Caderno de marcas</span>
      </button>
    </nav>
  );
}
