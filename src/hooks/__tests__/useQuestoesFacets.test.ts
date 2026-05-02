import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuestoesFacets } from '../useQuestoesFacets';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
});

const fakeResponse = {
  facets: {
    banca: { Cespe: 100, FCC: 50 },
    ano: { '2024': 80, '2023': 70 },
    orgao: {},
    cargo: {},
    area_concurso: {},
    especialidade: {},
    tipo: {},
    formato: {},
  },
  took_ms: 12,
  cached: false,
};

describe('useQuestoesFacets', () => {
  it('faz fetch mesmo com filtros vazios (counts globais para estado inicial)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeResponse,
    });
    const { result } = renderHook(() => useQuestoesFacets({}));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 1000 });
    expect(mockFetch).toHaveBeenCalled();
    expect(result.current.facets.banca).toEqual({ Cespe: 100, FCC: 50 });
  });

  it('faz fetch após debounce e popula facets', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeResponse,
    });
    const { result } = renderHook(() => useQuestoesFacets({ bancas: ['Cespe'] }));
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 1000 });
    expect(result.current.facets.banca).toEqual({ Cespe: 100, FCC: 50 });
  });

  it('expõe error quando fetch falha', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    // usar filtro diferente do teste anterior para não bater no cache LRU
    const { result } = renderHook(() => useQuestoesFacets({ anos: [2025] }));
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 1000 });
    expect(result.current.facets).toEqual({});
  });
});

describe('useQuestoesFacets — enabled prop', () => {
  it('enabled: false → não dispara fetch', async () => {
    mockFetch.mockClear();
    renderHook(() => useQuestoesFacets({}, { enabled: false }));
    await new Promise((r) => setTimeout(r, 400));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('enabled: false → retorna estado neutro', () => {
    const { result } = renderHook(() =>
      useQuestoesFacets({}, { enabled: false }),
    );
    expect(result.current.facets).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('default (sem options) → enabled implícito true', async () => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeResponse,
    });
    // usar filtro diferente para não bater no cache
    renderHook(() => useQuestoesFacets({ orgaos: ['TEST_ORG'] }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), { timeout: 1000 });
  });
});
