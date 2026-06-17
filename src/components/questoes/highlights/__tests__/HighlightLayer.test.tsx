import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HighlightLayer } from '../HighlightLayer';
import type { Highlight, MarkKind } from '../types';

// happy-dom não faz layout: mocka a geometria pra testar o render dos kinds.
const RECT = { left: 10, top: 20, width: 100, height: 20 };
vi.mock('../lib/highlight-anchor', () => ({
  resolveAnchor: vi.fn(() => ({}) as Range),
}));
vi.mock('../lib/highlight-render', () => ({
  rangeRects: vi.fn(() => [{ left: 10, top: 20, width: 100, height: 20 }]),
  trianglePos: vi.fn(() => ({ left: 10, top: 20 })),
  hitTest: vi.fn(() => -1),
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-expect-error stub mínimo pro happy-dom
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

function makeHl(kind: MarkKind, over: Partial<Highlight> = {}): Highlight {
  return {
    id: `hl-${kind}`, questionId: 1, target: 'enunciado', kind, color: '#4F86E0',
    type: null, quote: 'texto', prefix: '', suffix: '', note: null,
    createdAt: '', updatedAt: '', ...over,
  };
}

function Host({ highlights, hideMarks, eraseMode, hoveredId }: {
  highlights: Highlight[]; hideMarks?: boolean; eraseMode?: boolean; hoveredId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <span>texto</span>
      <HighlightLayer blockRef={ref} highlights={highlights} onClickHighlight={() => {}}
        hideMarks={hideMarks} eraseMode={eraseMode} hoveredId={hoveredId} />
    </div>
  );
}

describe('HighlightLayer (marcação v2)', () => {
  it('plain: fundo no overlay de baixo, sem linha/wash', async () => {
    const { container } = render(<Host highlights={[makeHl('plain')]} />);
    await waitFor(() => expect(container.querySelector('.qh-bg')).toBeTruthy());
    expect(container.querySelector('.qh-overlay:not(.qh-overlay-top) .qh-bg')).toBeTruthy();
    expect(container.querySelector('.qh-line')).toBeNull();
    expect(container.querySelector('.qh-wash')).toBeNull();
    expect(container.querySelector('.qh-tri')).toBeNull();
  });

  it('attention: fundo + triângulo', async () => {
    const { container } = render(<Host highlights={[makeHl('attention')]} />);
    await waitFor(() => expect(container.querySelector('.qh-tri')).toBeTruthy());
    expect(container.querySelector('.qh-bg')).toBeTruthy();
  });

  it('underline: sem fundo; linha 2px na base do rect, no overlay de cima', async () => {
    const { container } = render(<Host highlights={[makeHl('underline')]} />);
    await waitFor(() => expect(container.querySelector('.qh-line')).toBeTruthy());
    expect(container.querySelector('.qh-bg')).toBeNull();
    const line = container.querySelector('.qh-overlay-top .qh-line') as HTMLElement;
    expect(line).toBeTruthy();
    expect(parseFloat(line.style.top)).toBeCloseTo(RECT.top + RECT.height - 2);
    expect(line.style.height).toBe('2px');
  });

  it('tachado: wash do papel + linha a 52% da altura, por cima do wash', async () => {
    const { container } = render(<Host highlights={[makeHl('strike')]} />);
    await waitFor(() => expect(container.querySelector('.qh-wash')).toBeTruthy());
    expect(container.querySelector('.qh-bg')).toBeNull();
    const top = container.querySelector('.qh-overlay-top') as HTMLElement;
    const wash = top.querySelector('.qh-wash') as HTMLElement;
    const line = top.querySelector('.qh-line') as HTMLElement;
    expect(wash).toBeTruthy();
    expect(line).toBeTruthy();
    expect(parseFloat(line.style.top)).toBeCloseTo(RECT.top + (RECT.height - 2) * 0.52);
    // linha vem DEPOIS do wash no DOM (mesmo stacking → pinta por cima)
    expect(wash.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hideMarks: não renderiza nada (nem overlays)', async () => {
    const { container } = render(
      <Host highlights={[makeHl('attention'), makeHl('strike', { id: 'hl-2' })]} hideMarks />,
    );
    // dá tempo do rAF rodar; nada deve aparecer
    await new Promise(r => setTimeout(r, 60));
    expect(container.querySelector('.qh-overlay')).toBeNull();
  });

  it('eraseMode: toda marca ganha contorno tracejado; a hovered ganha o wash vermelho', async () => {
    const { container } = render(
      <Host highlights={[makeHl('plain', { id: 'a' }), makeHl('underline', { id: 'b' })]}
        eraseMode hoveredId="b" />,
    );
    await waitFor(() => expect(container.querySelectorAll('.qh-erase')).toHaveLength(2));
    const hovered = container.querySelectorAll('.qh-erase-hover');
    expect(hovered).toHaveLength(1);
  });
});
