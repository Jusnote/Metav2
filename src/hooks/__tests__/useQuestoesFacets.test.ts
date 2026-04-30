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
  it('retorna facets vazios e loading=false quando filtros vazios', () => {
    const { result } = renderHook(() => useQuestoesFacets({}));
    expect(result.current.loading).toBe(false);
    expect(result.current.facets).toEqual({});
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
