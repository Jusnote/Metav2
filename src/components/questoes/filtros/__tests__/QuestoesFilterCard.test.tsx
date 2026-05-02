import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';
import { QuestoesFilterCard } from '../QuestoesFilterCard';

vi.mock('@/hooks/useFiltrosDicionario', () => ({
  useFiltrosDicionario: () => ({
    dicionario: {
      bancas: {},
      orgaos: { stj: 'STJ', trf1: 'TRF1' },
      cargos: { analista: 'Analista' },
      materias: [],
      assuntos: [],
      materia_assuntos: {},
      anos: { min: 2010, max: 2024 },
    },
    loading: false,
  }),
}));

vi.mock('@/hooks/useQuestoesFacets', () => ({
  useQuestoesFacets: () => ({
    facets: { banca: {}, orgao: {}, cargo: {}, ano: {}, materia: {}, assunto: {} },
    isLoading: false,
  }),
}));

function withProviders(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/questoes?view=filtros']}>
        <QuestoesFilterDraftProvider>{node}</QuestoesFilterDraftProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('QuestoesFilterCard', () => {
  it('renderiza chip strip + drawer + picker default (matéria)', () => {
    render(withProviders(<QuestoesFilterCard />));
    expect(screen.getByRole('button', { name: /Matéria/i })).toBeInTheDocument();
    expect(screen.getByTestId('drawer-grid')).toBeInTheDocument();
    expect(screen.getByTestId('picker-materia-assuntos')).toBeInTheDocument();
  });

  it('click em chip Banca troca picker', async () => {
    render(withProviders(<QuestoesFilterCard />));
    fireEvent.click(screen.getByRole('button', { name: /Banca/i }));
    expect(await screen.findByTestId('picker-banca')).toBeInTheDocument();
  });

  it('renderiza placeholder na coluna direita (painel vem em 3c-3)', () => {
    render(withProviders(<QuestoesFilterCard />));
    expect(screen.getByTestId('painel-direito-placeholder')).toBeInTheDocument();
  });
});
