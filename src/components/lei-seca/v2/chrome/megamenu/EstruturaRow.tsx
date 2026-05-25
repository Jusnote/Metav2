'use client';

import type { EstruturaNode } from '@/lib/lei-seca/derive-estrutura';

interface Props {
  node: EstruturaNode;
  isActive: boolean;
  isFirst: boolean;
  onClick: () => void;
}

type Modo = 'divisor' | 'header' | 'navegavel';

function modoFromNode(node: EstruturaNode): Modo {
  if (node.tipo === 'PARTE' || node.tipo === 'LIVRO') return 'divisor';
  if (node.artigosDiretos === 0 && node.totalArtigos > 0) return 'header';
  return 'navegavel';
}

// Estilo do rótulo (descricao) por tipo. Usado nos modos navegável e header.
const ROTULO_STYLE: Record<string, string> = {
  TITULO: 'text-[10.5px] font-medium uppercase tracking-[0.08em] text-n-ink-2',
  CAPITULO: 'text-[10.5px] font-medium text-n-ink-3',
  SECAO: 'text-[10px] text-n-ink-3',
  SUBSECAO: 'text-[10px] italic text-n-ink-3',
};

const TITULO_STYLE: Record<string, string> = {
  TITULO: 'text-[12.5px] font-medium text-n-ink',
  CAPITULO: 'text-[12.5px] text-n-ink',
  SECAO: 'text-[12px] text-n-ink-2',
  SUBSECAO: 'text-[11.5px] text-n-ink-2 italic',
};

const ROTULO_DEFAULT = 'text-[10.5px] text-n-ink-3';
const TITULO_DEFAULT = 'text-[12.5px] text-n-ink';

export function EstruturaRow({ node, isActive, isFirst, onClick }: Props) {
  const modo = modoFromNode(node);
  const disabled = node.primeiroArtigoId === null;

  // ------ DIVISOR (PARTE / LIVRO) ------
  if (modo === 'divisor') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={
          'w-full text-left px-2.5 py-2 -mx-2.5 rounded-md transition-colors ' +
          (isFirst ? 'mt-1 ' : 'mt-5 ') +
          (disabled ? 'cursor-default ' : 'hover:bg-n-rule-2 ')
        }
      >
        <div className="flex items-center gap-3">
          <span
            className={
              'font-n-mono text-[11px] font-bold uppercase tracking-[0.16em] ' +
              (isActive ? 'text-n-accent' : 'text-n-ink')
            }
          >
            {node.descricao}
          </span>
          <span className="flex-1 h-px bg-n-rule" />
          {node.subtitulo && (
            <span className="text-[10.5px] text-n-ink-3 font-n-mono uppercase tracking-[0.06em]">
              {node.subtitulo}
            </span>
          )}
        </div>
      </button>
    );
  }

  // ------ HEADER (TÍTULO/CAPÍTULO sem artigos diretos, só agrupa filhos) ------
  if (modo === 'header') {
    const rotuloStyle = ROTULO_STYLE[node.tipo] ?? ROTULO_DEFAULT;
    const tituloStyle = TITULO_STYLE[node.tipo] ?? TITULO_DEFAULT;
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={
          'w-full text-left px-2.5 py-1.5 -mx-2.5 rounded-md flex items-baseline gap-3 transition-colors ' +
          (isFirst ? '' : 'mt-3 ') +
          (disabled ? 'cursor-default ' : 'hover:bg-n-rule-2 ') +
          (isActive ? 'bg-n-accent-soft' : '')
        }
      >
        <span
          className={
            'font-n-mono shrink-0 whitespace-nowrap ' +
            (isActive ? 'text-n-accent' : rotuloStyle)
          }
        >
          {node.descricao}
        </span>
        {node.subtitulo && (
          <span
            className={
              'truncate ' +
              (isActive ? 'text-n-accent font-semibold text-[12.5px]' : tituloStyle)
            }
          >
            {node.subtitulo}
          </span>
        )}
      </button>
    );
  }

  // ------ NAVEGÁVEL (tem artigos diretos OU é folha sem filhos) ------
  const rotuloStyle = ROTULO_STYLE[node.tipo] ?? ROTULO_DEFAULT;
  const tituloStyle = TITULO_STYLE[node.tipo] ?? TITULO_DEFAULT;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'w-full text-left px-2.5 py-1.5 -mx-2.5 rounded-md flex items-baseline gap-3 transition-colors ' +
        (disabled ? 'cursor-default opacity-60 ' : 'hover:bg-n-rule-2 ') +
        (isActive ? 'bg-n-accent-soft' : '')
      }
    >
      <span
        className={
          'font-n-mono shrink-0 whitespace-nowrap ' +
          (isActive ? 'text-n-accent' : rotuloStyle)
        }
      >
        {node.descricao}
      </span>
      <div className="flex-1 min-w-0">
        {node.subtitulo && (
          <div
            className={
              'truncate ' +
              (isActive ? 'text-n-accent font-semibold text-[12.5px]' : tituloStyle)
            }
          >
            {node.subtitulo}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10.5px] text-n-ink-3 font-n-mono whitespace-nowrap">
          {node.rangeLabel}
        </span>
        <div className="w-9 h-[3px] bg-n-rule-2 rounded-sm relative overflow-hidden">
          <div
            className={'absolute inset-0 ' + (isActive ? 'bg-n-accent' : 'bg-n-ink-3')}
            style={{ width: `${node.pctEstudado}%` }}
          />
        </div>
        <span className="text-[10.5px] text-n-ink-3 font-n-mono w-8 text-right">
          {node.pctEstudado}%
        </span>
      </div>
    </button>
  );
}
