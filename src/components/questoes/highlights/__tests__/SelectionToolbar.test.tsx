import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, createEvent } from '@testing-library/react';
import { SelectionToolbar, type SelectionToolbarProps } from '../SelectionToolbar';
import { DEFAULT_LAST_COLORS, MARK_COLORS } from '../highlights.config';

function setup(over: Partial<SelectionToolbarProps> = {}) {
  const onPick = vi.fn();
  const utils = render(
    <SelectionToolbar lastKind="peg" lastCol={DEFAULT_LAST_COLORS} pendingTool={null} onPick={onPick} {...over} />
  );
  return { onPick, ...utils };
}

describe('SelectionToolbar', () => {
  it('renderiza os 4 ícones com title (label + atalho)', () => {
    setup();
    ['Pegadinha (A)', 'Grifar (G)', 'Sublinhar (S)', 'Tachar (T)'].forEach(t =>
      expect(screen.getByTitle(t)).toBeInTheDocument());
  });

  it('clique no ícone chama onPick(tool) sem cor (usa a última da ferramenta)', () => {
    const { onPick } = setup();
    fireEvent.click(screen.getByTitle('Grifar (G)'));
    expect(onPick).toHaveBeenCalledWith('comum');
  });

  it('clique numa bolinha da paleta chama onPick(tool, cor)', () => {
    const { onPick } = setup();
    fireEvent.click(within(screen.getByTestId('cpick-tax')).getByRole('button', { name: `Cor ${MARK_COLORS[5]}` }));
    expect(onPick).toHaveBeenCalledWith('tax', MARK_COLORS[5]);
  });

  it('pendingTool força a paleta aberta e numerada (open+nums, data-n 1-8) e marca o botão', () => {
    setup({ pendingTool: 'sub' });
    const pal = screen.getByTestId('cpick-sub');
    expect(pal.className).toContain('open');
    expect(pal.className).toContain('nums');
    const dots = within(pal).getAllByRole('button');
    expect(dots).toHaveLength(8);
    expect(dots[0]).toHaveAttribute('data-n', '1');
    expect(dots[7]).toHaveAttribute('data-n', '8');
    expect(screen.getByTitle('Sublinhar (S)').className).toContain('sel');
    expect(screen.getByTestId('cpick-peg').className).not.toContain('open');
  });

  it('.last destaca o último tipo usado', () => {
    setup({ lastKind: 'tax' });
    expect(screen.getByTitle('Tachar (T)').className).toContain('last');
    expect(screen.getByTitle('Pegadinha (A)').className ?? '').not.toContain('last');
  });

  it('mousedown no popover é prevenido (não colapsa a seleção)', () => {
    const { container } = setup();
    const pop = container.querySelector('.qh-selpop') as HTMLElement;
    const ev = createEvent.mouseDown(pop);
    fireEvent(pop, ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
