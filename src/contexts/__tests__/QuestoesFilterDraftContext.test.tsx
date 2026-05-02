import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

function useProbeWithLocation() {
  const draft = useFiltrosPendentes();
  const location = useLocation();
  return { draft, location };
}

beforeEach(() => {
  sessionStorage.clear();
});

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

describe('isDirty', () => {
  it('false quando pendentes = aplicados na montagem', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('true após setPendentes que muda valor', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('false quando pendentes volta a ser igual a aplicados', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['fgv'],
      });
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.isDirty).toBe(false);
  });
});

describe('apply()', () => {
  it('escreve pendentes na URL e zera isDirty', () => {
    const { result } = renderHook(() => useProbeWithLocation(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.draft.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(result.current.draft.isDirty).toBe(true);

    act(() => {
      result.current.draft.apply();
    });

    expect(result.current.location.search).toContain('bancas=cespe');
    expect(result.current.draft.isDirty).toBe(false);
    expect(result.current.draft.aplicados.bancas).toEqual(['cespe']);
  });

  it('apply preserva search param `view` se existir', () => {
    const { result, rerender } = renderHook(() => useProbeWithLocation(), {
      wrapper: wrapper(['/questoes?view=filtros']),
    });

    act(() => {
      result.current.draft.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });

    act(() => {
      result.current.draft.apply();
    });

    rerender();

    expect(result.current.location.search).toContain('view=filtros');
    expect(result.current.location.search).toContain('bancas=cespe');
  });
});

describe('reset()', () => {
  it('reverte pendentes pra aplicados', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['fgv'],
      });
    });
    expect(result.current.pendentes.bancas).toEqual(['fgv']);
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.isDirty).toBe(false);
  });

  it('limpa sessionStorage após reset()', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(sessionStorage.getItem('questoes_filter_draft')).not.toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(sessionStorage.getItem('questoes_filter_draft')).toBeNull();
  });
});

describe('sessionStorage persistence', () => {
  const STORAGE_KEY = 'questoes_filter_draft';

  it('persiste pendentes em setPendentes', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });

    const stored = sessionStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.bancas).toEqual(['cespe']);
  });

  it('hidrata pendentes do sessionStorage na montagem (URL ainda vazia)', () => {
    const stored = { ...EMPTY_FILTERS, bancas: ['fgv'] };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    expect(result.current.pendentes.bancas).toEqual(['fgv']);
    expect(result.current.aplicados.bancas).toEqual([]);
    expect(result.current.isDirty).toBe(true);
  });

  it('URL params têm prioridade sobre sessionStorage (deep link)', () => {
    const stored = { ...EMPTY_FILTERS, bancas: ['fgv'] };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes?bancas=cespe']),
    });

    expect(result.current.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.aplicados.bancas).toEqual(['cespe']);
    expect(result.current.isDirty).toBe(false);
  });

  it('limpa sessionStorage após apply()', () => {
    const { result } = renderHook(() => useFiltrosPendentes(), {
      wrapper: wrapper(['/questoes']),
    });

    act(() => {
      result.current.setPendentes({
        ...EMPTY_FILTERS,
        bancas: ['cespe'],
      });
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    act(() => {
      result.current.apply();
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

import { useNavigate } from 'react-router-dom';

function useProbeWithNav() {
  const draft = useFiltrosPendentes();
  const navigate = useNavigate();
  return { draft, navigate };
}

describe('navegação externa (back/forward)', () => {
  it('aplicados muda quando URL muda; pendentes acompanha se não estiver dirty', () => {
    const { result } = renderHook(() => useProbeWithNav(), {
      wrapper: wrapper(['/questoes']),
    });

    expect(result.current.draft.aplicados.bancas).toEqual([]);

    act(() => {
      result.current.navigate('/questoes?bancas=cespe');
    });

    expect(result.current.draft.aplicados.bancas).toEqual(['cespe']);
    expect(result.current.draft.pendentes.bancas).toEqual(['cespe']);
    expect(result.current.draft.isDirty).toBe(false);
  });
});
