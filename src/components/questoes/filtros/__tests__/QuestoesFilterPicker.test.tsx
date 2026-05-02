import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestoesFilterPicker } from '../QuestoesFilterPicker';
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';

function withProviders(node: React.ReactNode, route = '/questoes') {
  return (
    <MemoryRouter initialEntries={[route]}>
      <QuestoesFilterDraftProvider>{node}</QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}

describe('QuestoesFilterPicker — dispatch por chip', () => {
  it('activeChip="materia_assuntos" → renderiza MateriaAssuntos', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="materia_assuntos" />));
    expect(screen.getByTestId('picker-materia-assuntos')).toBeInTheDocument();
  });

  it('activeChip="banca" → renderiza Banca', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="banca" />));
    expect(screen.getByTestId('picker-banca')).toBeInTheDocument();
  });

  it('activeChip="orgao_cargo" → renderiza OrgaoCargo', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="orgao_cargo" />));
    expect(screen.getByTestId('picker-orgao-cargo')).toBeInTheDocument();
  });

  it('activeChip="ano" → renderiza Ano', () => {
    render(withProviders(<QuestoesFilterPicker activeChip="ano" />));
    expect(screen.getByTestId('picker-ano')).toBeInTheDocument();
  });
});

describe('animação fade entre chips', () => {
  it('renderiza sob AnimatePresence (motion wrapper presente)', () => {
    const { container } = render(
      withProviders(<QuestoesFilterPicker activeChip="banca" />),
    );
    const wrapper = container.querySelector('[data-testid="picker-fade-wrapper"]');
    expect(wrapper).toBeInTheDocument();
  });
});
