import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltroRecentes } from '../useFiltroRecentes';

describe('useFiltroRecentes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('inicia vazio quando não há histórico', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    expect(result.current.items).toEqual([]);
  });

  it('push adiciona item no topo', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    act(() => result.current.push({ value: 'Cespe', label: 'Cespe' }));
    expect(result.current.items[0]).toMatchObject({ value: 'Cespe', label: 'Cespe' });
  });

  it('dedup: mesmo valor sobe pro topo, não duplica', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    act(() => {
      result.current.push({ value: 'Cespe', label: 'Cespe' });
      result.current.push({ value: 'FCC', label: 'FCC' });
      result.current.push({ value: 'Cespe', label: 'Cespe' });
    });
    expect(result.current.items.map(i => i.value)).toEqual(['Cespe', 'FCC']);
  });

  it('limita a 5 itens (top mais recentes)', () => {
    const { result } = renderHook(() => useFiltroRecentes('banca'));
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.push({ value: `B${i}`, label: `Banca ${i}` });
      }
    });
    expect(result.current.items.length).toBe(5);
    expect(result.current.items[0].value).toBe('B9');
    expect(result.current.items[4].value).toBe('B5');
  });

  it('persiste em localStorage com chave por field', () => {
    const { result } = renderHook(() => useFiltroRecentes('ano'));
    act(() => result.current.push({ value: '2024', label: '2024' }));
    const stored = localStorage.getItem('filtros_recentes_ano');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)[0].value).toBe('2024');
  });

  it('isolamento entre fields: banca não vaza pra ano', () => {
    const { result: bancaHook } = renderHook(() => useFiltroRecentes('banca'));
    const { result: anoHook } = renderHook(() => useFiltroRecentes('ano'));
    act(() => bancaHook.current.push({ value: 'Cespe', label: 'Cespe' }));
    expect(anoHook.current.items).toEqual([]);
  });
});
