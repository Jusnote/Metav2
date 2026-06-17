import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MarkingToolsProvider, useMarkingTools, DEFAULT_MARKING_TOOLS } from '../MarkingToolsContext';
import { DEFAULT_LAST_COLORS } from '../highlights.config';

const KEY = 'marking-tools-v1';
const wrapper = ({ children }: { children: React.ReactNode }) =>
  <MarkingToolsProvider>{children}</MarkingToolsProvider>;

function stored() {
  return JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
}

describe('MarkingToolsContext', () => {
  beforeEach(() => window.localStorage.clear());

  it('estado inicial: selTool ligado, sem caneta/borracha/olhinho, lastCol default', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    expect(result.current.selTool).toBe(true);
    expect(result.current.mode).toBeNull();
    expect(result.current.modeColor).toBeNull();
    expect(result.current.erase).toBe(false);
    expect(result.current.hideMarks).toBe(false);
    expect(result.current.lastCol).toEqual(DEFAULT_LAST_COLORS);
  });

  it('sem provider: valor default (comportamento atual) e ações no-op', () => {
    const { result } = renderHook(() => useMarkingTools());
    expect(result.current.selTool).toBe(true);
    expect(result.current.mode).toBeNull();
    act(() => result.current.pickPen('peg'));
    expect(result.current).toBe(DEFAULT_MARKING_TOOLS); // nada muda
  });

  it('pickPen sem cor usa a última da ferramenta; desliga selTool e borracha', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.setErase(true));
    act(() => result.current.pickPen('sub'));
    expect(result.current.mode).toBe('sub');
    expect(result.current.modeColor).toBe(DEFAULT_LAST_COLORS.sub);
    expect(result.current.selTool).toBe(false);
    expect(result.current.erase).toBe(false);
  });

  it('pickPen com cor explícita atualiza a memória da ferramenta', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.pickPen('comum', '#8B5CF6'));
    expect(result.current.modeColor).toBe('#8B5CF6');
    expect(result.current.lastCol.comum).toBe('#8B5CF6');
    expect(result.current.lastCol.peg).toBe(DEFAULT_LAST_COLORS.peg); // só a ferramenta usada
  });

  it('releasePen solta a caneta sem religar o selTool', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.pickPen('tax'));
    act(() => result.current.releasePen());
    expect(result.current.mode).toBeNull();
    expect(result.current.modeColor).toBeNull();
    expect(result.current.selTool).toBe(false);
  });

  it('toggleSelTool: com caneta → volta pro modo seleção; sem → alterna', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.pickPen('peg'));
    act(() => result.current.toggleSelTool());
    expect(result.current.mode).toBeNull();
    expect(result.current.erase).toBe(false);
    expect(result.current.selTool).toBe(true);
    act(() => result.current.toggleSelTool());
    expect(result.current.selTool).toBe(false);
    act(() => result.current.toggleSelTool());
    expect(result.current.selTool).toBe(true);
  });

  it('toggleSelTool: com borracha → desliga a borracha e religa o selTool', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.setErase(true));
    act(() => result.current.toggleSelTool());
    expect(result.current.erase).toBe(false);
    expect(result.current.selTool).toBe(true);
  });

  it('setErase(true) solta a caneta e sai do modo seleção', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.pickPen('peg'));
    act(() => result.current.setErase(true));
    expect(result.current.erase).toBe(true);
    expect(result.current.mode).toBeNull();
    expect(result.current.modeColor).toBeNull();
    expect(result.current.selTool).toBe(false);
  });

  it('toggleHideMarks alterna o olhinho', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.toggleHideMarks());
    expect(result.current.hideMarks).toBe(true);
    act(() => result.current.toggleHideMarks());
    expect(result.current.hideMarks).toBe(false);
  });

  it('setLastCol troca só a memória, sem ativar caneta', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.setLastCol('tax', '#2BB7A3'));
    expect(result.current.lastCol.tax).toBe('#2BB7A3');
    expect(result.current.mode).toBeNull();
  });

  it('persiste selTool+lastCol no localStorage (marking-tools-v1)', () => {
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    act(() => result.current.pickPen('sub', '#4CAF6E'));
    expect(stored()).toEqual({
      selTool: false,
      lastCol: { ...DEFAULT_LAST_COLORS, sub: '#4CAF6E' },
    });
  });

  it('relê do localStorage ao montar (lastCol e selTool restaurados)', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ selTool: false, lastCol: { comum: '#2BB7A3' } }));
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    expect(result.current.selTool).toBe(false);
    expect(result.current.lastCol.comum).toBe('#2BB7A3');
    expect(result.current.lastCol.peg).toBe(DEFAULT_LAST_COLORS.peg); // merge com defaults
  });

  it('localStorage corrompido não quebra: cai nos defaults', () => {
    window.localStorage.setItem(KEY, '{nope');
    const { result } = renderHook(() => useMarkingTools(), { wrapper });
    expect(result.current.selTool).toBe(true);
    expect(result.current.lastCol).toEqual(DEFAULT_LAST_COLORS);
  });
});
