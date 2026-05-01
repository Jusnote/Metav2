import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CargoFlatSearchView } from '../CargoFlatSearchView';

const dicionario = {
  bancas: {}, orgaos: {},
  cargos: {
    juiz: 'Juiz Federal',
    analista: 'Analista Judiciário',
    tecnico: 'Técnico Judiciário',
  },
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('CargoFlatSearchView', () => {
  it('renderiza header e back button', () => {
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={[]}
        facetsCargo={{}}
        onToggleFlatCargo={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/buscar cargo/i)).toBeInTheDocument();
    expect(screen.getByText(/voltar/i)).toBeInTheDocument();
  });

  it('search filtra cargos', () => {
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={[]}
        facetsCargo={{}}
        onToggleFlatCargo={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar cargo/i), { target: { value: 'Juiz' } });
    expect(screen.getByText('Juiz Federal')).toBeInTheDocument();
    expect(screen.queryByText('Analista Judiciário')).not.toBeInTheDocument();
  });

  it('toggle chama onToggleFlatCargo', () => {
    const onToggle = vi.fn();
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={[]}
        facetsCargo={{ 'Juiz Federal': 100 }}
        onToggleFlatCargo={onToggle}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Juiz Federal'));
    expect(onToggle).toHaveBeenCalledWith('Juiz Federal');
  });

  it('cargo selecionado aparece checked', () => {
    render(
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={['Juiz Federal']}
        facetsCargo={{}}
        onToggleFlatCargo={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const button = screen.getByText('Juiz Federal').closest('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
