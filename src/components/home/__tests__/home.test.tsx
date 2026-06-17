import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import HomePage from '@/views/HomePage';

const navSpy = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      user_metadata: { full_name: 'Aldemir' },
      email: 'aldemir@example.com',
    },
    session: null,
    loading: false,
    signOut: vi.fn(),
    isAuthenticated: true,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navSpy };
});

function setup() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </TooltipProvider>
  );
}

describe('HomePage (Home v4)', () => {
  it('renderiza a saudação com o nome do usuário', () => {
    setup();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Olá, Aldemir.');
  });

  it('renderiza as 6 fileiras do mock', () => {
    setup();
    // hero (card Nível + Sequência)
    expect(screen.getByText('Nível 12')).toBeInTheDocument();
    expect(screen.getByText('14 dias')).toBeInTheDocument();
    // CTA
    expect(screen.getByText('Continuar de onde parou')).toBeInTheDocument();
    // constância + pontos de atenção
    expect(screen.getByText('Constância · 12 semanas')).toBeInTheDocument();
    expect(screen.getByText('Pontos de atenção')).toBeInTheDocument();
    // stats
    expect(screen.getByText('Desempenho geral')).toBeInTheDocument();
    expect(screen.getByText('Evolução')).toBeInTheDocument();
    expect(screen.getByText('Hoje')).toBeInTheDocument();
    // medalhas + atividade
    expect(screen.getByText('Quadro de conquistas')).toBeInTheDocument();
    expect(screen.getByText('Atividade recente')).toBeInTheDocument();
    // sparkline
    expect(screen.getByText('Últimos 14 dias')).toBeInTheDocument();
  });

  it('renderiza 5 medalhas no quadro de conquistas', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.mgrid .mi')).toHaveLength(5);
    // 3 desbloqueadas (metálicas) + 2 travadas
    expect(container.querySelectorAll('.mgrid .mi.bronze')).toHaveLength(3);
    expect(container.querySelectorAll('.mgrid .mi.lk')).toHaveLength(2);
  });

  it('heatmap de constância tem 84 células (12 semanas × 7 dias)', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.minihm i')).toHaveLength(84);
  });

  it('botão Retomar navega pra /questoes', () => {
    setup();
    navSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Retomar/ }));
    expect(navSpy).toHaveBeenCalledWith('/questoes');
  });

  it('"Ver todas →" abre o dialog de medalhas existente', () => {
    setup();
    fireEvent.click(screen.getByText('Ver todas →'));
    expect(screen.getByText('Todas as medalhas')).toBeInTheDocument();
    expect(screen.getByText('3 de 14 conquistadas.')).toBeInTheDocument();
  });
});
