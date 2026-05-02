import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarregarLink } from '../CarregarLink';

describe('CarregarLink', () => {
  it('renderiza texto "Carregar ↑"', () => {
    render(<CarregarLink />);
    expect(screen.getByText(/Carregar/)).toBeInTheDocument();
  });

  it('tem aria-disabled=true', () => {
    render(<CarregarLink />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('tem tooltip "em breve"', () => {
    render(<CarregarLink />);
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringMatching(/em breve/i));
  });

  it('click NÃO dispara nada (disabled)', () => {
    const onClick = vi.fn();
    render(<CarregarLink onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
