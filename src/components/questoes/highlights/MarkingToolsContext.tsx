import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LAST_COLORS } from './highlights.config';
import type { ToolId } from './types';

/**
 * Estado das ferramentas de marcação v2 — é DA PÁGINA (barra lateral + lista),
 * não de cada card. A marcação em si continua por card (MarkableBlock/HighlightLayer).
 *
 * selTool = setinha: popover-ao-selecionar ligado. Pegar caneta/borracha desliga.
 * lastCol = memória de cor POR ferramenta. Persistido junto com selTool.
 */

const STORAGE_KEY = 'marking-tools-v1';

export interface MarkingToolsState {
  /** Setinha: popover ao selecionar (modo padrão). */
  selTool: boolean;
  /** Caneta ativa (marca direto na seleção) ou null. */
  mode: ToolId | null;
  /** Cor da caneta ativa (null sem caneta). */
  modeColor: string | null;
  /** Borracha ativa. */
  erase: boolean;
  /** Olhinho: oculta todas as marcas. */
  hideMarks: boolean;
  /** Última cor usada por ferramenta. */
  lastCol: Record<ToolId, string>;
}

export interface MarkingToolsValue extends MarkingToolsState {
  /** Pega a caneta `tool` (cor explícita ou a última usada); sai do modo seleção e da borracha. */
  pickPen: (tool: ToolId, color?: string) => void;
  /** Solta a caneta (mode/modeColor → null). */
  releasePen: () => void;
  /** Setinha: com caneta/borracha → volta pro modo seleção; senão liga/desliga o popover. */
  toggleSelTool: () => void;
  /** Liga/desliga a borracha (ligar solta a caneta e sai do modo seleção). */
  setErase: (on: boolean) => void;
  toggleHideMarks: () => void;
  setLastCol: (tool: ToolId, color: string) => void;
}

const noop = () => {};

/**
 * Valor padrão SEM provider = comportamento atual do app: popover-ao-selecionar
 * ligado, sem caneta/borracha/olhinho, ações no-op. (QuestionCard é usado em
 * lugares que não montam o provider.)
 */
export const DEFAULT_MARKING_TOOLS: MarkingToolsValue = {
  selTool: true,
  mode: null,
  modeColor: null,
  erase: false,
  hideMarks: false,
  lastCol: DEFAULT_LAST_COLORS,
  pickPen: noop,
  releasePen: noop,
  toggleSelTool: noop,
  setErase: noop,
  toggleHideMarks: noop,
  setLastCol: noop,
};

const MarkingToolsContext = createContext<MarkingToolsValue>(DEFAULT_MARKING_TOOLS);

function readPersisted(): { selTool: boolean; lastCol: Record<ToolId, string> } {
  const fallback = { selTool: true, lastCol: { ...DEFAULT_LAST_COLORS } };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{ selTool: boolean; lastCol: Record<ToolId, string> }>;
    return {
      selTool: typeof parsed.selTool === 'boolean' ? parsed.selTool : true,
      lastCol: { ...DEFAULT_LAST_COLORS, ...(parsed.lastCol ?? {}) },
    };
  } catch {
    return fallback;
  }
}

function persist(selTool: boolean, lastCol: Record<ToolId, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ selTool, lastCol }));
  } catch {
    // storage cheio/indisponível: segue sem persistir
  }
}

export function MarkingToolsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MarkingToolsState>(() => {
    const { selTool, lastCol } = readPersisted();
    return { selTool, mode: null, modeColor: null, erase: false, hideMarks: false, lastCol };
  });

  useEffect(() => {
    persist(state.selTool, state.lastCol);
  }, [state.selTool, state.lastCol]);

  const pickPen = useCallback((tool: ToolId, color?: string) => {
    setState(s => {
      const c = color ?? s.lastCol[tool];
      return { ...s, mode: tool, modeColor: c, lastCol: { ...s.lastCol, [tool]: c }, selTool: false, erase: false };
    });
  }, []);

  const releasePen = useCallback(() => {
    setState(s => ({ ...s, mode: null, modeColor: null }));
  }, []);

  const toggleSelTool = useCallback(() => {
    setState(s => (s.mode || s.erase)
      ? { ...s, mode: null, modeColor: null, erase: false, selTool: true }
      : { ...s, selTool: !s.selTool });
  }, []);

  const setErase = useCallback((on: boolean) => {
    setState(s => on
      ? { ...s, erase: true, mode: null, modeColor: null, selTool: false }
      : { ...s, erase: false });
  }, []);

  const toggleHideMarks = useCallback(() => {
    setState(s => ({ ...s, hideMarks: !s.hideMarks }));
  }, []);

  const setLastCol = useCallback((tool: ToolId, color: string) => {
    setState(s => ({ ...s, lastCol: { ...s.lastCol, [tool]: color } }));
  }, []);

  const value = useMemo<MarkingToolsValue>(() => ({
    ...state, pickPen, releasePen, toggleSelTool, setErase, toggleHideMarks, setLastCol,
  }), [state, pickPen, releasePen, toggleSelTool, setErase, toggleHideMarks, setLastCol]);

  return <MarkingToolsContext.Provider value={value}>{children}</MarkingToolsContext.Provider>;
}

export function useMarkingTools(): MarkingToolsValue {
  return useContext(MarkingToolsContext);
}
