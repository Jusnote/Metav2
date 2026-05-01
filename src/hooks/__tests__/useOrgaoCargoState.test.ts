import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrgaoCargoState, EMPTY_STATE } from '../useOrgaoCargoState';

describe('useOrgaoCargoState', () => {
  it('inicia vazio', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    expect(result.current.state).toEqual(EMPTY_STATE);
  });

  it('addOrgaoAll marca órgão como "all"', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => result.current.actions.addOrgaoAll('TRF1'));
    expect(result.current.state.orgaos.get('TRF1')).toBe('all');
  });

  it('addPair adiciona cargo específico ao órgão', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => result.current.actions.addPair('TRF1', 'Juiz Federal'));
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Juiz Federal']);
  });

  it('addOrgaoAll remove pairs existentes daquele órgão (mutex)', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.addPair('TRF1', 'Analista');
      result.current.actions.addOrgaoAll('TRF1');
    });
    expect(result.current.state.orgaos.get('TRF1')).toBe('all');
  });

  it('addPair em órgão "all" substitui (mutex)', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addOrgaoAll('TRF1');
      result.current.actions.addPair('TRF1', 'Juiz Federal');
    });
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Juiz Federal']);
  });

  it('addPair acumula múltiplos cargos no mesmo órgão', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.addPair('TRF1', 'Analista');
    });
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Juiz Federal', 'Analista']);
  });

  it('removePair remove um cargo, mantém órgão se outros cargos restam', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.addPair('TRF1', 'Analista');
      result.current.actions.removePair('TRF1', 'Juiz Federal');
    });
    expect(result.current.state.orgaos.get('TRF1')).toEqual(['Analista']);
  });

  it('removePair com último cargo remove o órgão do Map', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addPair('TRF1', 'Juiz Federal');
      result.current.actions.removePair('TRF1', 'Juiz Federal');
    });
    expect(result.current.state.orgaos.has('TRF1')).toBe(false);
  });

  it('removeOrgao remove órgão completamente (qualquer modo)', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addOrgaoAll('TRF1');
      result.current.actions.removeOrgao('TRF1');
    });
    expect(result.current.state.orgaos.has('TRF1')).toBe(false);
  });

  it('addFlatCargo adiciona cargo sem órgão', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => result.current.actions.addFlatCargo('Juiz Federal'));
    expect(result.current.state.flatCargos).toEqual(['Juiz Federal']);
  });

  it('addFlatCargo dedup', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addFlatCargo('Juiz Federal');
      result.current.actions.addFlatCargo('Juiz Federal');
    });
    expect(result.current.state.flatCargos).toEqual(['Juiz Federal']);
  });

  it('removeFlatCargo remove o cargo', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addFlatCargo('Juiz Federal');
      result.current.actions.removeFlatCargo('Juiz Federal');
    });
    expect(result.current.state.flatCargos).toEqual([]);
  });

  it('reset zera tudo', () => {
    const { result } = renderHook(() => useOrgaoCargoState());
    act(() => {
      result.current.actions.addOrgaoAll('TRF1');
      result.current.actions.addPair('STJ', 'Ministro');
      result.current.actions.addFlatCargo('Juiz Federal');
      result.current.actions.reset();
    });
    expect(result.current.state).toEqual(EMPTY_STATE);
  });
});
