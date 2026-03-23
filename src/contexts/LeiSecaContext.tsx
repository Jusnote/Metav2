"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLeis, useLei, useDispositivos } from "@/hooks/useLeiApi";
import type { Lei, Dispositivo } from "@/types/lei-api";
import { activeArtigoStore } from "@/stores/activeArtigoStore";

// ============ FOCUSED PROVISION ============

export interface FocusedProvision {
  slug: string;
  role: string;
  text: string;
  nodePos: number;
}

export type CompanionTab = 'dispositivo' | 'ia';

// ============ CONTEXT TYPE ============

interface LeiSecaContextType {
  // Data (from API)
  leis: Lei[];
  currentLeiId: string;
  currentLei: Lei | null;
  dispositivos: Dispositivo[];
  totalDispositivos: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: any;

  // Navigation
  handleLeiChange: (id: string) => void;
  loadMore: () => void;
  hasMore: boolean;

  // UI State
  leiSecaMode: boolean;
  toggleLeiSecaMode: () => void;
  showRevogados: boolean;
  toggleRevogados: () => void;
  immersiveMode: boolean;
  toggleImmersiveMode: () => void;

  // Study companion
  focusedProvision: FocusedProvision | null;
  setFocusedProvision: (provision: FocusedProvision | null) => void;
  companionTab: CompanionTab;
  setCompanionTab: (tab: CompanionTab) => void;
  companionOpen: boolean;
  setCompanionOpen: (open: boolean) => void;
  aiSelectedText: string;
  setAiSelectedText: (text: string) => void;

  // Note input bar
  noteBarProvision: FocusedProvision | null;
  openNoteBar: (provision: FocusedProvision) => void;
  closeNoteBar: () => void;
}

// ============ CONTEXT ============

const LeiSecaContext = createContext<LeiSecaContextType | null>(null);

export function LeiSecaProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isLeiSecaRoute = location.pathname.startsWith('/lei-seca');

  // If not on lei-seca route, just provide null context (consumers must check)
  if (!isLeiSecaRoute) {
    return <>{children}</>;
  }

  return <LeiSecaProviderInner>{children}</LeiSecaProviderInner>;
}

function LeiSecaProviderInner({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Parse params from pathname: /lei-seca/:leiId/:slug
  const pathParts = location.pathname.split('/').filter(Boolean);
  const paramLeiId = pathParts[0] === 'lei-seca' ? pathParts[1] : undefined;

  // API hooks
  const { leis, isLoading: leisLoading } = useLeis();
  const currentLeiId = paramLeiId || (leis.length > 0 ? leis[0].id : '');
  const { lei: currentLei, isLoading: leiLoading } = useLei(currentLeiId || null);

  // UI toggles
  const [leiSecaMode, setLeiSecaMode] = useState(false);
  const [showRevogados, setShowRevogados] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);

  // Dispositivos with pagination — pass showRevogados
  const { dispositivos, totalCount, loadMore, hasMore, isLoading: dispLoading, isLoadingMore } =
    useDispositivos(currentLeiId || null, showRevogados);

  // Study Companion Panel state
  const [focusedProvision, setFocusedProvision] = useState<FocusedProvision | null>(null);
  const [companionTab, setCompanionTab] = useState<CompanionTab>('dispositivo');
  const [companionOpen, setCompanionOpen] = useState(() => {
    try { return localStorage.getItem('lei-companion-open') === 'true'; } catch { return false; }
  });
  const [aiSelectedText, setAiSelectedText] = useState('');

  // Note input bar state
  const [noteBarProvision, setNoteBarProvision] = useState<FocusedProvision | null>(null);
  const openNoteBar = useCallback((provision: FocusedProvision) => setNoteBarProvision(provision), []);
  const closeNoteBar = useCallback(() => setNoteBarProvision(null), []);

  // Persist companion open state
  useEffect(() => {
    try { localStorage.setItem('lei-companion-open', String(companionOpen)); } catch {}
  }, [companionOpen]);

  // Navigation
  const handleLeiChange = useCallback((newLeiId: string) => {
    navigate(`/lei-seca/${newLeiId}`);
    activeArtigoStore.reset();
  }, [navigate]);

  // Toggles
  const toggleLeiSecaMode = useCallback(() => setLeiSecaMode(prev => !prev), []);
  const toggleRevogados = useCallback(() => setShowRevogados(prev => !prev), []);
  const toggleImmersiveMode = useCallback(() => setImmersiveMode(prev => !prev), []);

  const isLoading = leisLoading || leiLoading || dispLoading;

  const value = useMemo<LeiSecaContextType>(() => ({
    leis,
    currentLeiId,
    currentLei,
    dispositivos,
    totalDispositivos: totalCount,
    isLoading,
    isLoadingMore,
    error: null,
    handleLeiChange,
    loadMore,
    hasMore,
    leiSecaMode,
    toggleLeiSecaMode,
    showRevogados,
    toggleRevogados,
    immersiveMode,
    toggleImmersiveMode,
    focusedProvision,
    setFocusedProvision,
    companionTab,
    setCompanionTab,
    companionOpen,
    setCompanionOpen,
    aiSelectedText,
    setAiSelectedText,
    noteBarProvision,
    openNoteBar,
    closeNoteBar,
  }), [
    leis, currentLeiId, currentLei, dispositivos, totalCount,
    isLoading, isLoadingMore, handleLeiChange, loadMore, hasMore,
    leiSecaMode, toggleLeiSecaMode, showRevogados, toggleRevogados,
    immersiveMode, toggleImmersiveMode,
    focusedProvision, companionTab, companionOpen, aiSelectedText,
    noteBarProvision, openNoteBar, closeNoteBar,
  ]);

  return <LeiSecaContext.Provider value={value}>{children}</LeiSecaContext.Provider>;
}

export function useLeiSeca(): LeiSecaContextType {
  const context = useContext(LeiSecaContext);
  if (!context) {
    throw new Error("useLeiSeca must be used within a LeiSecaProvider");
  }
  return context;
}

export function useLeiSecaOptional(): LeiSecaContextType | null {
  return useContext(LeiSecaContext);
}
