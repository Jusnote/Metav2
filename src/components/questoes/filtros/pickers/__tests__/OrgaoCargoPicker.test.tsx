import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrgaoCargoPicker } from '../OrgaoCargoPicker';
import { EMPTY_STATE } from '@/hooks/useOrgaoCargoState';

const dicionario = {
  bancas: {},
  orgaos: { trf1: 'TRF1', stj: 'STJ' },
  cargos: { juiz: 'Juiz Federal' },
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

const noopActions = {
  addOrgaoAll: vi.fn(), addPair: vi.fn(), removePair: vi.fn(),
  removeOrgao: vi.fn(), addFlatCargo: vi.fn(), removeFlatCargo: vi.fn(),
  reset: vi.fn(),
};

describe('OrgaoCargoPicker shell', () => {
  it('modo inicial = list', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{}}
      />,
    );
    expect(screen.getByRole('heading', { name: /Instituições/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar instituição/i)).toBeInTheDocument();
  });

  it('clicar em órgão → drilldown', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{ 'Juiz Federal': 100 }}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    expect(screen.getByText(/marcar todos/i)).toBeInTheDocument();
    expect(screen.getByText('Juiz Federal')).toBeInTheDocument();
  });

  it('clicar "Buscar cargo direto" → flat-search', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{}}
      />,
    );
    fireEvent.click(screen.getByText(/buscar cargo direto/i));
    expect(screen.getByText(/buscar cargo direto/i)).toBeInTheDocument();
  });

  it('voltar do drilldown → list', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={noopActions}
        facetsCargo={{}}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    fireEvent.click(screen.getByLabelText(/voltar/i));
    expect(screen.getByPlaceholderText(/buscar instituição/i)).toBeInTheDocument();
  });

  it('marcar todos chama actions.addOrgaoAll', () => {
    const actions = { ...noopActions, addOrgaoAll: vi.fn() };
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        state={EMPTY_STATE}
        actions={actions}
        facetsCargo={{}}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    fireEvent.click(screen.getByText(/marcar todos/i));
    expect(actions.addOrgaoAll).toHaveBeenCalledWith('TRF1');
  });
});
