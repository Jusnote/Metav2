import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuestoesFilterPicker } from '../QuestoesFilterPicker';
import { MemoryRouter } from 'react-router-dom';
import {
  QuestoesFilterDraftProvider,
  useQuestoesFilterDraft,
} from '@/contexts/QuestoesFilterDraftContext';

function withProviders(node: React.ReactNode, route = '/questoes') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <QuestoesFilterDraftProvider>{node}</QuestoesFilterDraftProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** Probe que expõe pendentes em data-attributes pra inspeção em testes. */
function PendentesProbe() {
  const { pendentes } = useQuestoesFilterDraft();
  return (
    <div
      data-testid="pendentes-probe"
      data-orgaos={JSON.stringify(pendentes.orgaos)}
      data-cargos={JSON.stringify(pendentes.cargos)}
      data-pairs={JSON.stringify(pendentes.org_cargo_pairs ?? [])}
    />
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

describe('OrgaoCargoPickerAdapter — hidratação de pendentes (B1)', () => {
  it('NÃO sobrescreve pendentes.orgaos pré-existentes no mount', () => {
    // Deep-link simulado: ?orgaos=STJ → pendentes.orgaos = ['STJ']
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="orgao_cargo" />
          <PendentesProbe />
        </>,
        '/questoes?orgaos=STJ',
      ),
    );

    const probe = screen.getByTestId('pendentes-probe');
    // Após o primeiro paint, pendentes.orgaos deve continuar ['STJ'] —
    // antes do fix B1, o useEffect de mount escrevia [] e zerava.
    expect(probe.getAttribute('data-orgaos')).toBe(JSON.stringify(['STJ']));
  });

  it('preserva pendentes.cargos pré-existentes no mount', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="orgao_cargo" />
          <PendentesProbe />
        </>,
        '/questoes?cargos=Analista',
      ),
    );

    const probe = screen.getByTestId('pendentes-probe');
    expect(probe.getAttribute('data-cargos')).toBe(JSON.stringify(['Analista']));
  });
});
