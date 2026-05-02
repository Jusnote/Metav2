import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';
import { EMPTY_FILTERS } from '@/lib/questoes/filter-serialization';

function wrapper(initialEntries: string[] = ['/']) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QuestoesFilterDraftProvider>{children}</QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}

describe('useFiltrosPendentes — fora do provider', () => {
  it('lança erro descritivo', () => {
    expect(() => renderHook(() => useFiltrosPendentes())).toThrow(
      /must be used within QuestoesFilterDraftProvider/,
    );
  });
});

describe('aplicados (hidratação da URL)', () => {
  it('URL vazia → aplicados = EMPTY_FILTERS', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });
    expect(result.current.aplicados.bancas).toEqual([]);
    expect(result.current.aplicados.anos).toEqual([]);
    expect(result.current.aplicados.materias).toEqual([]);
    expect(result.current.aplicados.assuntos).toEqual([]);
    expect(result.current.aplicados.orgaos).toEqual([]);
    expect(result.current.aplicados.cargos).toEqual([]);
    expect(result.current.aplicados.areas_concurso).toEqual([]);
    expect(result.current.aplicados.especialidades).toEqual([]);
    expect(result.current.aplicados.tipos).toEqual([]);
    expect(result.current.aplicados.formatos).toEqual([]);
  });

  it('URL com bancas=cespe → aplicados.bancas = ["cespe"]', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    expect(result.current.aplicados.bancas).toEqual(['cespe']);
  });

  it('URL com anulada=false → aplicados.visibility_anuladas = "esconder"', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?anulada=false']),
    });
    expect(result.current.aplicados.visibility_anuladas).toBe('esconder');
  });
});

describe('setPendentes', () => {
  it('atualiza pendentes sem afetar aplicados', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.aplicados.bancas).toEqual([]);
  });

  it('pendentes inicia igual a aplicados na montagem', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.aplicados.bancas).toEqual(['cespe']);
  });
});
