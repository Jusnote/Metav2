import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MarkingSidebar } from '../MarkingSidebar';
import { MarkingToolsProvider, useMarkingTools } from '../MarkingToolsContext';
import { DEFAULT_LAST_COLORS, MARK_COLORS } from '../highlights.config';

const hoisted = vi.hoisted(() => ({ count: 0 as number | undefined }));

vi.mock('@/hooks/useHighlightsAll', () => ({
  useHighlightsCount: () => ({ data: hoisted.count }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

/** Sonda: expõe o estado do contexto no DOM pra asserção. */
function Probe() {
  const t = useMarkingTools();
  return (
    <div
      data-testid="probe"
      data-seltool={String(t.selTool)}
      data-mode={t.mode ?? ''}
      data-modecolor={t.modeColor ?? ''}
      data-erase={String(t.erase)}
      data-hide={String(t.hideMarks)}
    />
  );
}

function setup() {
  const utils = render(
    <MarkingToolsProvider>
      <MarkingSidebar />
      <Probe />
    </MarkingToolsProvider>
  );
  return { ...utils, probe: screen.getByTestId('probe') };
}

const setinha = () => screen.getByRole('button', { name: 'Popover ao selecionar' });
const btool = (label: string) => screen.getByRole('button', { name: label });

describe('MarkingSidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hoisted.count = 0;
  });

  it('setinha: acesa no modo seleção; alterna; com caneta ativa volta pra seleção', () => {
    const { probe, container } = setup();
    expect(setinha().className).toContain('on');
    expect(container.querySelector('.qh-bar')!.className).not.toContain('open');

    // liga/desliga o popover (sem caneta)
    fireEvent.click(setinha());
    expect(probe.dataset.seltool).toBe('false');
    expect(setinha().className).not.toContain('on');
    expect(container.querySelector('.qh-bar')!.className).toContain('open'); // bancada expande

    // pega a caneta via accordion e clica na setinha → volta pro modo seleção
    fireEvent.click(btool('Pegadinha'));
    fireEvent.click(within(container.querySelector('.qh-bar-vpick[data-for="peg"]') as HTMLElement)
      .getByRole('button', { name: `Cor ${MARK_COLORS[0]}` }));
    expect(probe.dataset.mode).toBe('peg');
    fireEvent.click(setinha());
    expect(probe.dataset.mode).toBe('');
    expect(probe.dataset.seltool).toBe('true');
    expect(setinha().className).toContain('on');
  });

  it('clicar num tipo abre o accordion (8 cores); escolher cor chama pickPen e acende o botão', () => {
    const { probe, container } = setup();
    fireEvent.click(setinha()); // expande a bancada

    fireEvent.click(btool('Sublinhar'));
    const vpick = container.querySelector('.qh-bar-vpick[data-for="sub"]') as HTMLElement;
    expect(vpick.className).toContain('open');
    expect(within(vpick).getAllByRole('button')).toHaveLength(8);

    fireEvent.click(within(vpick).getByRole('button', { name: `Cor ${MARK_COLORS[6]}` }));
    expect(probe.dataset.mode).toBe('sub');
    expect(probe.dataset.modecolor).toBe(MARK_COLORS[6]);
    expect(btool('Sublinhar').className).toContain('on');
    expect(vpick.className).not.toContain('open'); // recolhe ao escolher

    // tipo ativo: clicar de novo solta a caneta
    fireEvent.click(btool('Sublinhar'));
    expect(probe.dataset.mode).toBe('');
    expect(btool('Sublinhar').className).not.toContain('on');
  });

  it('abrir o accordion de outro tipo fecha o anterior', () => {
    const { container } = setup();
    fireEvent.click(setinha());
    fireEvent.click(btool('Pegadinha'));
    expect(container.querySelector('.qh-bar-vpick[data-for="peg"]')!.className).toContain('open');
    fireEvent.click(btool('Tachar'));
    expect(container.querySelector('.qh-bar-vpick[data-for="peg"]')!.className).not.toContain('open');
    expect(container.querySelector('.qh-bar-vpick[data-for="tax"]')!.className).toContain('open');
  });

  it('borracha e olhinho alternam (com .on)', () => {
    const { probe } = setup();
    fireEvent.click(btool('Borracha'));
    expect(probe.dataset.erase).toBe('true');
    expect(btool('Borracha').className).toContain('on');
    fireEvent.click(btool('Borracha'));
    expect(probe.dataset.erase).toBe('false');

    fireEvent.click(btool('Mostrar/ocultar marcas'));
    expect(probe.dataset.hide).toBe('true');
    expect(btool('Mostrar/ocultar marcas').className).toContain('on');
    fireEvent.click(btool('Mostrar/ocultar marcas'));
    expect(probe.dataset.hide).toBe('false');
  });

  it('badge do caderno: escondida em 0, visível com contagem', () => {
    const { unmount } = setup();
    expect(btool('Caderno de marcas').querySelector('.qh-bar-badge')).toBeNull();
    unmount();

    hoisted.count = 7;
    setup();
    expect(btool('Caderno de marcas').querySelector('.qh-bar-badge')!.textContent).toBe('7');
  });

  it("teclado: '1' sem seleção pega a pegadinha com a última cor", () => {
    const { probe } = setup();
    fireEvent.keyDown(document, { key: '1' });
    expect(probe.dataset.mode).toBe('peg');
    expect(probe.dataset.modecolor).toBe(DEFAULT_LAST_COLORS.peg);
    expect(probe.dataset.seltool).toBe('false');
  });

  it('teclado: E alterna a borracha, H o olhinho, Esc volta pra seleção', () => {
    const { probe } = setup();
    fireEvent.keyDown(document, { key: 'e' });
    expect(probe.dataset.erase).toBe('true');
    fireEvent.keyDown(document, { key: 'h' });
    expect(probe.dataset.hide).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(probe.dataset.erase).toBe('false');
    expect(probe.dataset.seltool).toBe('true');
  });

  it('teclado: ignora quando digitando em input', () => {
    const { probe } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '1' });
    expect(probe.dataset.mode).toBe('');
    input.remove();
  });
});
