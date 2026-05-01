import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgaoCargoPicker } from '../OrgaoCargoPicker';

const dicionario = {
  bancas: {},
  orgaos: { trf1: 'TRF1', stj: 'STJ', tj: 'TJ' },
  cargos: { juiz: 'Juiz', analista: 'Analista' },
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('OrgaoCargoPicker', () => {
  it('mostra 2 seções com counts próprios', () => {
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        facetsOrgao={{ TRF1: 100 }}
        facetsCargo={{ Juiz: 50 }}
        selectedOrgaos={[]} selectedCargos={[]}
        onChangeOrgaos={vi.fn()} onChangeCargos={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /^Órgãos$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Cargos$/i })).toBeInTheDocument();
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.getByText('Juiz')).toBeInTheDocument();
  });

  it('toggle órgão chama callback de órgãos', () => {
    const onO = vi.fn();
    render(
      <OrgaoCargoPicker
        dicionario={dicionario}
        selectedOrgaos={[]} selectedCargos={[]}
        onChangeOrgaos={onO} onChangeCargos={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    expect(onO).toHaveBeenCalledWith(['TRF1']);
  });
});
