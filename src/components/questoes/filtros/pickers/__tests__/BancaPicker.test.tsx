import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BancaPicker } from '../BancaPicker';

const dicionario = {
  bancas: { cespe: 'Cespe', fcc: 'FCC', fgv: 'FGV', cesgranrio: 'Cesgranrio' },
  orgaos: {}, cargos: {},
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};
const facets = { Cespe: 1234, FCC: 567, FGV: 89 };

describe('BancaPicker', () => {
  it('renderiza header e search', () => {
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Bancas/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('renderiza lista alfabética com counts', () => {
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Cespe')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('chama onChange ao marcar item', () => {
    const onChange = vi.fn();
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Cespe'));
    expect(onChange).toHaveBeenCalledWith(['Cespe']);
  });

  it('search filtra a lista', () => {
    render(
      <BancaPicker
        dicionario={dicionario}
        facets={facets}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/buscar/i);
    fireEvent.change(input, { target: { value: 'cesp' } });
    expect(screen.queryByText('FCC')).not.toBeInTheDocument();
    expect(screen.getByText('Cespe')).toBeInTheDocument();
  });
});
