import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnoPicker } from '../AnoPicker';

const dicionario = {
  bancas: {}, orgaos: {}, cargos: {},
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('AnoPicker', () => {
  it('renderiza anos descendentes', () => {
    render(<AnoPicker dicionario={dicionario} facets={{}} selected={[]} onChange={vi.fn()} />);
    const items = screen.getAllByRole('button').filter(b => /^\d{4}$/.test(b.textContent || ''));
    expect(items.map(i => i.textContent)).toEqual(
      Array.from({ length: 15 }, (_, i) => String(2024 - i))
    );
  });

  it('agrupa por década', () => {
    render(<AnoPicker dicionario={dicionario} facets={{}} selected={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/2020s/i)).toBeInTheDocument();
    expect(screen.getByText(/2010s/i)).toBeInTheDocument();
  });

  it('toggle envia number array', () => {
    const onChange = vi.fn();
    render(<AnoPicker dicionario={dicionario} facets={{}} selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('2024'));
    expect(onChange).toHaveBeenCalledWith([2024]);
  });
});
