import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestoesFilterEmptyState } from '../QuestoesFilterEmptyState';

describe('QuestoesFilterEmptyState', () => {
  it('renderiza mensagem padrão', () => {
    render(<QuestoesFilterEmptyState />);
    expect(screen.getByText('Nenhum filtro selecionado.')).toBeInTheDocument();
  });

  it('texto centralizado em wrapper com altura mínima', () => {
    const { container } = render(<QuestoesFilterEmptyState />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/items-center|justify-center/);
  });
});
