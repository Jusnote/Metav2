"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useCadernos } from "@/hooks/useCadernos";
import { useCadernoViews } from "@/hooks/useCadernoViews";
import type { CadernoItem, ContextChainItem, CadernoSavedView, CadernoFilters } from "@/types/caderno";

// ============ Context Type ============

interface CadernosContextType {
  // Items
  items: CadernoItem[];
  isLoading: boolean;
  saveProvision: (item: {
    lei_id: string;
    artigo_numero: string;
    provision_slug: string;
    provision_role: string;
    provision_text: string;
    lei_sigla: string | null;
    lei_nome: string | null;
    artigo_contexto: string | null;
    context_chain: ContextChainItem[];
  }) => Promise<boolean>;
  unsaveProvision: (slug: string) => Promise<boolean>;
  toggleSave: (item: {
    lei_id: string;
    artigo_numero: string;
    provision_slug: string;
    provision_role: string;
    provision_text: string;
    lei_sigla: string | null;
    lei_nome: string | null;
    artigo_contexto: string | null;
    context_chain: ContextChainItem[];
  }) => Promise<boolean>;
  updateNote: (provisionSlug: string, note: string) => Promise<boolean>;
  isSaved: (slug: string) => boolean;
  getLeis: () => { id: string; sigla: string; nome: string }[];
  getAllMarkers: () => string[];
  addMarker: (provisionSlug: string, marker: string) => Promise<boolean>;
  removeMarker: (provisionSlug: string, marker: string) => Promise<boolean>;
  refresh: () => void;

  // Saved Views ("Ilusão dos Múltiplos Cadernos")
  savedViews: CadernoSavedView[];
  pinView: (params: {
    title: string;
    color: string;
    icon?: string;
    filters: CadernoFilters;
  }) => Promise<CadernoSavedView | null>;
  unpinView: (viewId: string) => Promise<boolean>;
  updateView: (viewId: string, updates: Partial<Pick<CadernoSavedView, 'title' | 'color' | 'icon'>>) => Promise<boolean>;
  isPinned: (filters: CadernoFilters) => string | null;
}

// ============ Context ============

const CadernosContext = createContext<CadernosContextType | null>(null);

// ============ Provider ============

export function CadernosProvider({ children }: { children: React.ReactNode }) {
  const hook = useCadernos();
  const viewsHook = useCadernoViews();

  const contextValue = useMemo<CadernosContextType>(() => ({
    items: hook.items,
    isLoading: hook.isLoading,
    saveProvision: hook.saveProvision,
    unsaveProvision: hook.unsaveProvision,
    toggleSave: hook.toggleSave,
    updateNote: hook.updateNote,
    isSaved: hook.isSaved,
    getLeis: hook.getLeis,
    getAllMarkers: hook.getAllMarkers,
    addMarker: hook.addMarker,
    removeMarker: hook.removeMarker,
    refresh: hook.refresh,

    savedViews: viewsHook.views,
    pinView: viewsHook.pinView,
    unpinView: viewsHook.unpinView,
    updateView: viewsHook.updateView,
    isPinned: viewsHook.isPinned,
  }), [hook.items, hook.isLoading, hook.saveProvision, hook.unsaveProvision,
    hook.toggleSave, hook.updateNote, hook.isSaved, hook.getLeis, hook.getAllMarkers,
    hook.addMarker, hook.removeMarker, hook.refresh,
    viewsHook.views, viewsHook.pinView, viewsHook.unpinView,
    viewsHook.updateView, viewsHook.isPinned]);

  return (
    <CadernosContext.Provider value={contextValue}>
      {children}
    </CadernosContext.Provider>
  );
}

// ============ Hooks ============

export function useCadernosContext() {
  const ctx = useContext(CadernosContext);
  if (!ctx) throw new Error("useCadernosContext must be used within CadernosProvider");
  return ctx;
}

export function useCadernosOptional() {
  return useContext(CadernosContext);
}
