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

vi.mock('@/hooks/useQuestoesCount', () => ({
  useQuestoesCount: () => ({
    count: 0,
    loading: false,
    error: null,
    cached: false,
    tookMs: null,
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
    expect(screen.getByRole('button', { name: /Disciplina/i })).toBeInTheDocument();
    expect(screen.getByTestId('drawer-grid')).toBeInTheDocument();
    expect(screen.getByTestId('picker-materia-assuntos')).toBeInTheDocument();
  });

  it('click em chip Banca troca picker', async () => {
    render(withProviders(<QuestoesFilterCard />));
    fireEvent.click(screen.getByRole('button', { name: /Banca/i }));
    expect(await screen.findByTestId('picker-banca')).toBeInTheDocument();
  });

  it('renderiza painel direito real (header FILTROS ATIVOS)', () => {
    render(withProviders(<QuestoesFilterCard />));
    expect(screen.getByText(/FILTROS ATIVOS · 0/i)).toBeInTheDocument();
  });

  it('renderiza empty state quando sem filtros', () => {
    render(withProviders(<QuestoesFilterCard />));
    expect(screen.getByText('Nenhum filtro selecionado.')).toBeInTheDocument();
  });

  it('renderiza botão Aplicar filtros desabilitado quando vazio', () => {
    render(withProviders(<QuestoesFilterCard />));
    const btn = screen.getByRole('button', { name: /Aplicar filtros/ });
    expect(btn).toBeDisabled();
  });
});
