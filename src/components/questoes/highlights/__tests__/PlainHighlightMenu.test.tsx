import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlainHighlightMenu } from '../PlainHighlightMenu';
import { MARK_COLORS } from '../highlights.config';

describe('PlainHighlightMenu', () => {
  it('mostra as 8 cores do mock + lixeira (sem "Virar Atenção")', () => {
    render(<PlainHighlightMenu color={MARK_COLORS[2]} onColor={() => {}} onRemove={() => {}} />);
    MARK_COLORS.forEach(c => expect(screen.getByTestId(`plain-swatch-${c}`)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Remover' })).toBeInTheDocument();
    expect(screen.queryByText(/Virar Atenção/)).toBeNull();
  });

  it('a cor atual ganha o anel (.on)', () => {
    render(<PlainHighlightMenu color={MARK_COLORS[4]} onColor={() => {}} onRemove={() => {}} />);
    expect(screen.getByTestId(`plain-swatch-${MARK_COLORS[4]}`).className).toContain('on');
    expect(screen.getByTestId(`plain-swatch-${MARK_COLORS[0]}`).className).not.toContain('on');
  });

  it('trocar cor chama onColor', () => {
    const onColor = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" onColor={onColor} onRemove={() => {}} />);
    fireEvent.click(screen.getByTestId('plain-swatch-#8B5CF6'));
    expect(onColor).toHaveBeenCalledWith('#8B5CF6');
  });

  it('lixeira chama onRemove', () => {
    const onRemove = vi.fn();
    render(<PlainHighlightMenu color="#F2C231" onColor={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
