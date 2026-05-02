import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuestoesFilterPicker } from '../QuestoesFilterPicker';
import { MemoryRouter } from 'react-router-dom';
import {
  QuestoesFilterDraftProvider,
  useQuestoesFilterDraft,
} from '@/contexts/QuestoesFilterDraftContext';

vi.mock('@/hooks/useFiltrosDicionario', () => ({
  useFiltrosDicionario: () => ({
    dicionario: {
      bancas: {},
      orgaos: { stj: 'STJ', trf1: 'TRF1' },
      cargos: { analista: 'Analista' },
      materias: ['Direito Administrativo', 'Direito Civil'],
      assuntos: [],
      materia_assuntos: {
        'Direito Civil': ['Pessoas', 'Contratos'],
      },
      anos: { min: 2010, max: 2024 },
    },
    loading: false,
  }),
}));

vi.mock('@/hooks/useMaterias', () => ({
  useMaterias: () => ({
    data: [
      {
        slug: 'direito-adm',
        nome: 'Direito Administrativo',
        total_nodes: 499,
        total_questoes_classificadas: 12345,
        fontes: ['gran'],
        last_updated: null,
      },
      {
        slug: 'direito-civil',
        nome: 'Direito Civil',
        total_nodes: 0,
        total_questoes_classificadas: 5000,
        fontes: [],
        last_updated: null,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/components/questoes/TaxonomiaTreePicker', () => ({
  TaxonomiaTreePicker: ({ materiaSlug }: { materiaSlug: string }) => (
    <div data-testid="tree">tree:{materiaSlug}</div>
  ),
}));

vi.mock('@/hooks/useQuestoesFacets', () => ({
  useQuestoesFacets: () => ({
    facets: { banca: {}, orgao: {}, cargo: {}, ano: {}, materia: {}, assunto: {} },
    isLoading: false,
  }),
}));

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
      data-materias={JSON.stringify(pendentes.materias)}
      data-assuntos={JSON.stringify(pendentes.assuntos)}
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

  it('selecionar outro órgão preserva o anterior em pendentes.orgaos', () => {
    // Deep-link com STJ já aplicado. Usuário entra no picker e marca TRF1 também
    // (drilldown → "marcar todos"). Esperado: pendentes.orgaos === ['STJ', 'TRF1'].
    // Antes do fix B1 isso falhava porque o adapter sobrescrevia STJ no mount.
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="orgao_cargo" />
          <PendentesProbe />
        </>,
        '/questoes?orgaos=STJ',
      ),
    );

    // Drilldown em TRF1
    fireEvent.click(screen.getByText('TRF1'));
    // Marcar todos os cargos do TRF1 → addOrgaoAll('TRF1')
    fireEvent.click(screen.getByText(/marcar todos/i));

    const probe = screen.getByTestId('pendentes-probe');
    const orgaos = JSON.parse(probe.getAttribute('data-orgaos') ?? '[]');
    expect(orgaos).toEqual(expect.arrayContaining(['STJ', 'TRF1']));
    expect(orgaos).toHaveLength(2);
  });
});

describe('MateriaAssuntosPickerAdapter — lazy-add + umbrella', () => {
  beforeEach(() => {
    // sessionStorage persiste entre tests; o draft provider lê dele no init.
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  });

  it('clicar em matéria na lista NÃO adiciona ao filtro (apenas navega)', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="materia_assuntos" />
          <PendentesProbe />
        </>,
      ),
    );

    // Lista de matérias renderizada — clicar no nome de uma matéria
    fireEvent.click(screen.getByText('Direito Civil'));

    const probe = screen.getByTestId('pendentes-probe');
    // pendentes.materias deve continuar vazio (lazy-add)
    expect(probe.getAttribute('data-materias')).toBe(JSON.stringify([]));
  });

  it('clicar em "Todo o conteúdo →" adiciona matéria ao filtro como umbrella', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="materia_assuntos" />
          <PendentesProbe />
        </>,
      ),
    );

    const links = screen.getAllByText(/Todo o conteúdo →/i);
    // Clica no primeiro link (alguma das matérias da lista alfabética)
    fireEvent.click(links[0]);

    const probe = screen.getByTestId('pendentes-probe');
    const materias = JSON.parse(probe.getAttribute('data-materias') ?? '[]');
    expect(materias.length).toBe(1);
  });

  it('marcar assunto adiciona automaticamente a matéria ao filtro', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="materia_assuntos" />
          <PendentesProbe />
        </>,
      ),
    );

    // Entra na vista de Direito Civil
    fireEvent.click(screen.getByText('Direito Civil'));
    // Marca assunto "Pessoas" (renderizado como label do checkbox)
    fireEvent.click(screen.getByText('Pessoas'));

    const probe = screen.getByTestId('pendentes-probe');
    const materias = JSON.parse(probe.getAttribute('data-materias') ?? '[]');
    const assuntos = JSON.parse(probe.getAttribute('data-assuntos') ?? '[]');
    expect(assuntos).toContain('Pessoas');
    expect(materias).toContain('Direito Civil');
  });

  it('desmarcar último assunto remove matéria do filtro (estado A)', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="materia_assuntos" />
          <PendentesProbe />
        </>,
      ),
    );

    fireEvent.click(screen.getByText('Direito Civil'));
    fireEvent.click(screen.getByText('Pessoas')); // marca
    fireEvent.click(screen.getByText('Pessoas')); // desmarca

    const probe = screen.getByTestId('pendentes-probe');
    const materias = JSON.parse(probe.getAttribute('data-materias') ?? '[]');
    const assuntos = JSON.parse(probe.getAttribute('data-assuntos') ?? '[]');
    expect(assuntos).toEqual([]);
    expect(materias).toEqual([]);
  });

  it('umbrella toggle on (botão "Todo o conteúdo de X") adiciona matéria + limpa específicos', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="materia_assuntos" />
          <PendentesProbe />
        </>,
      ),
    );

    // Entra em Civil, marca "Pessoas" → estado C (específico)
    fireEvent.click(screen.getByText('Direito Civil'));
    fireEvent.click(screen.getByText('Pessoas'));

    let probe = screen.getByTestId('pendentes-probe');
    expect(JSON.parse(probe.getAttribute('data-assuntos') ?? '[]')).toContain(
      'Pessoas',
    );

    // Toggle umbrella on → assuntos limpos, matéria mantida
    const umbrellaBtn = screen.getByRole('button', {
      name: /Todo o conteúdo de Direito Civil/i,
    });
    fireEvent.click(umbrellaBtn);

    probe = screen.getByTestId('pendentes-probe');
    expect(JSON.parse(probe.getAttribute('data-materias') ?? '[]')).toContain(
      'Direito Civil',
    );
    expect(JSON.parse(probe.getAttribute('data-assuntos') ?? '[]')).toEqual([]);
  });

  it('umbrella toggle off remove matéria do filtro', () => {
    render(
      withProviders(
        <>
          <QuestoesFilterPicker activeChip="materia_assuntos" />
          <PendentesProbe />
        </>,
      ),
    );

    fireEvent.click(screen.getByText('Direito Civil'));
    const umbrellaBtn = screen.getByRole('button', {
      name: /Todo o conteúdo de Direito Civil/i,
    });
    fireEvent.click(umbrellaBtn); // on
    fireEvent.click(umbrellaBtn); // off

    const probe = screen.getByTestId('pendentes-probe');
    expect(JSON.parse(probe.getAttribute('data-materias') ?? '[]')).toEqual([]);
  });
});
