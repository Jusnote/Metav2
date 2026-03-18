"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLeiContent, useLeis, type ViewMode, type LeiArtigo, type RevokedOnlyMap, buildCapituloPathKey } from "@/hooks/useLeiContent";
import type { LeiTreeNode } from "@/components/ui/lei-tree";
import { activeArtigoStore } from "@/stores/activeArtigoStore";

// ============ TIPOS PARA FLAT LIST ============

interface FlatItem {
  id: string;
  type: 'parte' | 'livro' | 'titulo' | 'subtitulo' | 'capitulo' | 'secao' | 'subsecao' | 'artigo';
  level: number;
  name: string;
  artigo?: LeiArtigo;
  artigoIndex?: number;
  parentIds: string[];
  hasChildren: boolean;
  revokedOnlyItems?: LeiArtigo[];
}

// ============ FLATTEN TREE ============

function buildFlatList(artigos: LeiArtigo[], revokedOnlyMap: RevokedOnlyMap): FlatItem[] {
  const items: FlatItem[] = [];
  const addedHeaders = new Map<string, string>();
  const headerItemsById = new Map<string, FlatItem>();
  let idCounter = 0;
  const generateId = () => `item-${idCounter++}`;

  const ensureHeader = (
    type: FlatItem['type'],
    name: string | null,
    level: number,
    parentIds: string[],
    key: string
  ): string | null => {
    if (!name) return null;
    if (!addedHeaders.has(key)) {
      const id = generateId();
      addedHeaders.set(key, id);
      const headerItem: FlatItem = { id, type, level, name, parentIds, hasChildren: true };
      items.push(headerItem);
      headerItemsById.set(id, headerItem);
    }
    return addedHeaders.get(key)!;
  };

  artigos.forEach((artigo, index) => {
    const { parte, livro, titulo, subtitulo, capitulo, secao, subsecao } = artigo.path;
    const parentIds: string[] = [];

    const parteId = ensureHeader('parte', parte, 0, [], `parte:${parte}`);
    if (parteId) parentIds.push(parteId);

    const livroKey = `livro:${parte || ''}_${livro}`;
    const livroId = ensureHeader('livro', livro, parte ? 1 : 0, [...parentIds], livroKey);
    if (livroId) parentIds.push(livroId);

    const tituloKey = `titulo:${parte || ''}_${livro || ''}_${titulo}`;
    const tituloId = ensureHeader('titulo', titulo, parentIds.length, [...parentIds], tituloKey);
    if (tituloId) parentIds.push(tituloId);

    const subtituloKey = `subtitulo:${parte || ''}_${livro || ''}_${titulo || ''}_${subtitulo}`;
    const subtituloId = ensureHeader('subtitulo', subtitulo, parentIds.length, [...parentIds], subtituloKey);
    if (subtituloId) parentIds.push(subtituloId);

    const capituloKey = buildCapituloPathKey({ parte, livro, titulo, subtitulo, capitulo, secao, subsecao });
    const capituloId = ensureHeader('capitulo', capitulo, parentIds.length, [...parentIds], capituloKey);
    if (capituloId) {
      parentIds.push(capituloId);
      const revokedOnly = revokedOnlyMap[capituloKey];
      if (revokedOnly?.length) {
        const header = headerItemsById.get(capituloId);
        if (header) header.revokedOnlyItems = revokedOnly;
      }
    }

    const secaoKey = `secao:${parte || ''}_${livro || ''}_${titulo || ''}_${subtitulo || ''}_${capitulo || ''}_${secao}`;
    const secaoId = ensureHeader('secao', secao, parentIds.length, [...parentIds], secaoKey);
    if (secaoId) parentIds.push(secaoId);

    const subsecaoKey = `subsecao:${parte || ''}_${livro || ''}_${titulo || ''}_${subtitulo || ''}_${capitulo || ''}_${secao || ''}_${subsecao}`;
    const subsecaoId = ensureHeader('subsecao', subsecao, parentIds.length, [...parentIds], subsecaoKey);
    if (subsecaoId) parentIds.push(subsecaoId);

    items.push({
      id: `artigo-${index}`,
      type: 'artigo',
      level: parentIds.length,
      name: `Art. ${artigo.numero}`,
      artigo,
      artigoIndex: index,
      parentIds,
      hasChildren: false
    });
  });

  return items;
}

// ============ PARSE HEADER NAME ============

function parseHeaderName(name: string): { badge: string; description: string } {
  const patterns = [
    /^(PARTE\s+\w+)$/i,
    /^(LIVRO\s+[IVXLCDM\d]+(?:-[A-Z])?)\s*-\s*(.+)$/i,
    /^(TÍTUL?O\s+(?:[IVXLCDM\d]+|único)(?:-[A-Z])?)\s*-\s*(.+)$/i,
    /^(SUBTÍTUL?O\s+[IVXLCDM\d]+(?:-[A-Z])?)\s*-\s*(.+)$/i,
    /^(CAPÍTUL?O\s+(?:[IVXLCDM\d]+|único)(?:-[A-Z])?)\s*-\s*(.+)$/i,
    /^(Se[çc][ãa]o\s+(?:[IVXLCDM\d]+|única?)(?:-[A-Z])?)\s*-\s*(.+)$/i,
    /^(Subse[çc][ãa]o\s+[IVXLCDM\d]+(?:-[A-Z])?)\s*-\s*(.+)$/i,
    /^(LIVRO\s+[IVXLCDM\d]+(?:-[A-Z])?)\s+(.+)$/i,
    /^(TÍTUL?O\s+[IVXLCDM\d]+(?:-[A-Z])?)\s+(.+)$/i,
    /^(SUBTÍTUL?O\s+[IVXLCDM\d]+(?:-[A-Z])?)\s+(.+)$/i,
    /^(CAPÍTUL?O\s+[IVXLCDM\d]+(?:-[A-Z])?)\s+(.+)$/i,
    /^(Se[çc][ãa]o\s+[IVXLCDM\d]+(?:-[A-Z])?)\s+(.+)$/i,
    /^(Subse[çc][ãa]o\s+[IVXLCDM\d]+(?:-[A-Z])?)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return { badge: match[1].toUpperCase(), description: match[2] };
    }
  }
  return { badge: name, description: '' };
}

// ============ BUILD LEI TREE (STABLE — no isActive) ============

function buildLeiTreeFromFlat(flatList: FlatItem[]): LeiTreeNode[] {
  const nodeMap = new Map<string, LeiTreeNode & { _parentIds: string[] }>();
  const roots: LeiTreeNode[] = [];

  for (const item of flatList) {
    if (item.type === 'artigo') continue;
    const { badge, description } = parseHeaderName(item.name);
    const node: LeiTreeNode & { _parentIds: string[] } = {
      id: item.id,
      type: item.type,
      badge,
      label: item.name,
      sublabel: description || undefined,
      children: [],
      _parentIds: item.parentIds,
    };
    nodeMap.set(item.id, node);
    const directParentId = item.parentIds[item.parentIds.length - 1];
    if (directParentId && nodeMap.has(directParentId)) {
      nodeMap.get(directParentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const item of flatList) {
    if (item.type !== 'artigo') continue;
    const artigo = item.artigo;
    const isRevogado = artigo ? !artigo.vigente : false;

    let previewText = '';
    if (artigo?.texto_plano) {
      let text = artigo.texto_plano;
      const pipeIndex = text.indexOf(' | ');
      if (pipeIndex > -1) text = text.substring(pipeIndex + 3);
      text = text.replace(/^Art\.\s*\d+[º°]?\s*/, '');
      previewText = text.substring(0, 60) + (text.length > 60 ? '...' : '');
    }

    const artigoNode: LeiTreeNode = {
      id: item.id,
      type: 'artigo',
      label: `Art. ${artigo?.numero}º`,
      epigrafe: artigo?.epigrafe || undefined,
      preview: previewText || undefined,
      artigoIndex: item.artigoIndex,
      frequencia: artigo ? Math.floor((parseInt(artigo.numero) * 7) % 150) : 0,
      isFavorite: artigo ? parseInt(artigo.numero) % 5 === 0 : false,
      isRevogado,
      // isActive is now computed locally by ArtigoNode via external store
    };

    const directParentId = item.parentIds[item.parentIds.length - 1];
    if (directParentId && nodeMap.has(directParentId)) {
      nodeMap.get(directParentId)!.children!.push(artigoNode);
    } else {
      roots.push(artigoNode);
    }
  }

  return roots;
}

// ============ CONTEXT ============

// ============ FOCUSED PROVISION ============

export interface FocusedProvision {
  slug: string;
  role: string;
  text: string;
  nodePos: number;
}

export type CompanionTab = 'dispositivo' | 'ia';

interface LeiSecaContextType {
  // Lei data
  leis: ReturnType<typeof useLeis>['leis'];
  leisLoading: boolean;
  currentLeiId: string;
  lei: ReturnType<typeof useLeiContent>['lei'];
  artigos: LeiArtigo[];
  plateContent: any;
  isLoading: boolean;
  error: ReturnType<typeof useLeiContent>['error'];
  totalArtigos: number;
  hasNext: boolean;
  hasPrev: boolean;
  allArtigos: LeiArtigo[];

  // Navigation state
  currentArtigoIndex: number;
  viewMode: ViewMode;
  searchQuery: string;
  expandedSections: Set<string>;

  // Tree data
  leiTreeData: LeiTreeNode[];

  // Current artigo info
  currentLeiInfo: ReturnType<typeof useLeis>['leis'][number] | undefined;
  currentArtigo: LeiArtigo | undefined;

  // Infinite scroll (modo full)
  hasMoreFull: boolean;
  loadMoreFull: () => void;

  // Study Companion Panel
  focusedProvision: FocusedProvision | null;
  setFocusedProvision: (provision: FocusedProvision | null) => void;
  companionTab: CompanionTab;
  setCompanionTab: (tab: CompanionTab) => void;
  companionOpen: boolean;
  setCompanionOpen: (open: boolean) => void;
  aiSelectedText: string;
  setAiSelectedText: (text: string) => void;

  // Note input bar (ephemeral bottom bar)
  noteBarProvision: FocusedProvision | null;
  openNoteBar: (provision: FocusedProvision) => void;
  closeNoteBar: () => void;

  // Actions
  navigateToArtigo: (index: number) => void;
  scrollToArtigoInEditor: (index: number) => void;
  handleLeiChange: (newLeiId: string) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  toggleSection: (sectionId: string) => void;

  // Refs exposed for page-level scroll handling
  pendingScrollRef: React.MutableRefObject<number | null>;
  scrollTrigger: number;
}

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
  const paramSlug = pathParts[0] === 'lei-seca' ? pathParts[2] : undefined;

  const { leis, isLoading: leisLoading } = useLeis();
  const currentLeiId = paramLeiId || 'leidecrimes';

  const [currentArtigoIndex, setCurrentArtigoIndex] = useState(0);
  // visibleArtigoIndex now lives in activeArtigoStore (external, no re-renders)
  const [viewMode, _setViewMode] = useState<ViewMode>('full');
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const pendingScrollRef = useRef<number | null>(null);
  const isInternalNavigation = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Study Companion Panel state
  const [focusedProvision, setFocusedProvision] = useState<FocusedProvision | null>(null);
  const [companionTab, setCompanionTab] = useState<CompanionTab>('dispositivo');
  const [companionOpen, setCompanionOpen] = useState(() => {
    try { return localStorage.getItem('lei-companion-open') === 'true'; } catch { return false; }
  });
  const [aiSelectedText, setAiSelectedText] = useState('');

  // Note input bar state
  const [noteBarProvision, setNoteBarProvision] = useState<FocusedProvision | null>(null);
  const openNoteBar = useCallback((provision: FocusedProvision) => {
    setNoteBarProvision(provision);
  }, []);
  const closeNoteBar = useCallback(() => {
    setNoteBarProvision(null);
  }, []);

  const {
    lei, artigos, plateContent, isLoading, error,
    totalArtigos, hasNext, hasPrev, findArtigoBySlug,
    allArtigos, revokedOnlyMap,
    hasMoreFull, loadMoreFull, ensureArtigoLoaded,
  } = useLeiContent({ leiId: currentLeiId, viewMode, currentArtigoIndex });

  // Flat list (stable per lei)
  const flatList = useMemo(() => {
    if (!allArtigos || allArtigos.length === 0) return [];
    return buildFlatList(allArtigos, revokedOnlyMap);
  }, [allArtigos, revokedOnlyMap]);

  // Tree data — STABLE, computed once per lei. isActive is handled by ArtigoNode via store.
  const leiTreeData = useMemo(() => {
    if (flatList.length === 0) return [];
    return buildLeiTreeFromFlat(flatList);
  }, [flatList]);

  // Pre-computed map: artigoIndex → parentIds (O(1) lookup for auto-expand)
  const artigoParentMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const item of flatList) {
      if (item.type === 'artigo' && item.artigoIndex !== undefined) {
        map.set(item.artigoIndex, item.parentIds);
      }
    }
    return map;
  }, [flatList]);

  // Init expanded sections (only once when flatList first becomes available)
  const expandedInitialized = useRef(false);
  useEffect(() => {
    if (flatList.length > 0 && !expandedInitialized.current) {
      expandedInitialized.current = true;
      const firstLevelHeaders = flatList
        .filter(item => item.type !== 'artigo' && item.level === 0)
        .map(item => item.id);
      setExpandedSections(new Set(firstLevelHeaders));
    }
  }, [flatList]);

  // Search expand
  const normalizeSearchQuery = (query: string) => {
    const normalized = query.replace(/\./g, '');
    return { original: query.toLowerCase(), normalized };
  };

  useEffect(() => {
    if (searchQuery.trim() !== '') {
      const sectionsToExpand = new Set<string>();
      const { original, normalized } = normalizeSearchQuery(searchQuery);
      flatList.forEach(item => {
        if (item.type === 'artigo') {
          const numeroNormalized = (item.artigo?.numero || '').replace(/\./g, '');
          const matches = item.name.toLowerCase().includes(original) ||
            (item.artigo?.numero?.toString() || '').includes(original) ||
            numeroNormalized.includes(normalized) ||
            (item.artigo?.texto_plano?.toLowerCase() || '').includes(original);
          if (matches) {
            item.parentIds.forEach(id => sectionsToExpand.add(id));
          }
        }
      });
      if (sectionsToExpand.size > 0) {
        setExpandedSections(prev => {
          const next = new Set(prev);
          sectionsToExpand.forEach(id => next.add(id));
          return next;
        });
      }
    }
  }, [searchQuery, flatList]);

  // Auto-expand sidebar section via imperative store subscription (debounced 150ms)
  // Does NOT cause provider re-render — subscribes directly to the external store
  useEffect(() => {
    if (viewMode !== 'full') return;

    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = activeArtigoStore.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const idx = activeArtigoStore.getSnapshot();
        const parentIds = artigoParentMap.get(idx);
        if (!parentIds) return;
        setExpandedSections(prev => {
          let changed = false;
          const next = new Set(prev);
          for (const id of parentIds) {
            if (!next.has(id)) { next.add(id); changed = true; }
          }
          return changed ? next : prev;
        });
      }, 150);
    });

    return () => { unsubscribe(); clearTimeout(timer); };
  }, [viewMode, artigoParentMap]);

  // URL slug navigation (internal click vs external: F5, back button, direct link)
  useEffect(() => {
    // Internal navigation (sidebar click, setViewMode) already handled everything
    if (isInternalNavigation.current) {
      isInternalNavigation.current = false;
      return;
    }

    if (paramSlug && allArtigos.length > 0) {
      const found = findArtigoBySlug(paramSlug);
      if (found) {
        setCurrentArtigoIndex(found.index);

        // F5/direct link in full mode: ensure artigo is loaded + scroll to it
        if (viewMode === 'full') {
          ensureArtigoLoaded(found.index);
          activeArtigoStore.setActiveArtigoIndex(found.index);
          pendingScrollRef.current = found.index;
          setScrollTrigger(prev => prev + 1);
        }
      }
    }
  }, [paramSlug, allArtigos, viewMode, findArtigoBySlug, ensureArtigoLoaded]);

  const navigateToArtigo = useCallback((index: number) => {
    setCurrentArtigoIndex(index);
    isInternalNavigation.current = true;
    const artigo = allArtigos[index];
    if (artigo) {
      const artigoSlug = artigo.slug.replace(`${currentLeiId}-`, '');
      navigate(`/lei-seca/${currentLeiId}/${artigoSlug}`, { replace: true });
    }
  }, [allArtigos, currentLeiId, navigate]);

  const handleLeiChange = useCallback((newLeiId: string) => {
    setCurrentArtigoIndex(0);
    activeArtigoStore.reset();
    setExpandedSections(new Set());
    expandedInitialized.current = false;
    navigate(`/lei-seca/${newLeiId}`);
  }, [navigate]);

  const handlePrevious = useCallback(() => {
    if (hasPrev) {
      const step = viewMode === 'full' ? 1 : viewMode;
      navigateToArtigo(Math.max(0, currentArtigoIndex - step));
    }
  }, [hasPrev, viewMode, currentArtigoIndex, navigateToArtigo]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const step = viewMode === 'full' ? 1 : viewMode;
      navigateToArtigo(currentArtigoIndex + step);
    }
  }, [hasNext, viewMode, currentArtigoIndex, navigateToArtigo]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  // Context-preserving view mode switch
  const setViewMode = useCallback((mode: ViewMode) => {
    if (mode === viewMode) return;

    if (mode === 1) {
      // Todos → 1: use currently visible article (sync read from store)
      const visibleIdx = activeArtigoStore.getSnapshot();
      setCurrentArtigoIndex(visibleIdx);
      isInternalNavigation.current = true;
      const artigo = allArtigos[visibleIdx];
      if (artigo) {
        const artigoSlug = artigo.slug.replace(`${currentLeiId}-`, '');
        navigate(`/lei-seca/${currentLeiId}/${artigoSlug}`, { replace: true });
      }
    } else {
      // 1 → Todos: ensure artigo is loaded, then schedule scroll after render
      ensureArtigoLoaded(currentArtigoIndex);
      pendingScrollRef.current = currentArtigoIndex;
      activeArtigoStore.setActiveArtigoIndex(currentArtigoIndex);
    }

    _setViewMode(mode);
  }, [viewMode, currentArtigoIndex, allArtigos, currentLeiId, navigate, ensureArtigoLoaded]);

  // Scroll to artigo in editor DOM (called from sidebar in Todos mode)
  const scrollToArtigoInEditor = useCallback((index: number) => {
    // Ensure artigo is loaded in DOM (expands fullModeCount if needed)
    ensureArtigoLoaded(index);
    pendingScrollRef.current = index;
    activeArtigoStore.setActiveArtigoIndex(index);
    // Mark as internal so URL slug effect doesn't re-trigger
    isInternalNavigation.current = true;
    // Trigger page effect to read pendingScrollRef (since store write doesn't re-render)
    setScrollTrigger(prev => prev + 1);
    // Also update URL
    const artigo = allArtigos[index];
    if (artigo) {
      const artigoSlug = artigo.slug.replace(`${currentLeiId}-`, '');
      navigate(`/lei-seca/${currentLeiId}/${artigoSlug}`, { replace: true });
    }
  }, [allArtigos, currentLeiId, navigate, ensureArtigoLoaded]);

  const currentLeiInfo = useMemo(() => leis.find(l => l.id === currentLeiId), [leis, currentLeiId]);
  const currentArtigo = artigos[0];

  // Persist companion open state
  const handleSetCompanionOpen = useCallback((open: boolean) => {
    setCompanionOpen(open);
    try { localStorage.setItem('lei-companion-open', String(open)); } catch {}
  }, []);

  const contextValue = useMemo<LeiSecaContextType>(() => ({
    leis, leisLoading, currentLeiId, lei, artigos, plateContent,
    isLoading, error, totalArtigos, hasNext, hasPrev, allArtigos,
    currentArtigoIndex, viewMode, searchQuery, expandedSections,
    leiTreeData, currentLeiInfo, currentArtigo,
    hasMoreFull, loadMoreFull,
    focusedProvision, setFocusedProvision,
    companionTab, setCompanionTab,
    companionOpen, setCompanionOpen: handleSetCompanionOpen,
    aiSelectedText, setAiSelectedText,
    noteBarProvision, openNoteBar, closeNoteBar,
    navigateToArtigo, scrollToArtigoInEditor,
    handleLeiChange, handlePrevious, handleNext,
    setViewMode, setSearchQuery, toggleSection,
    pendingScrollRef, scrollTrigger,
  }), [
    leis, leisLoading, currentLeiId, lei, artigos, plateContent,
    isLoading, error, totalArtigos, hasNext, hasPrev, allArtigos,
    currentArtigoIndex, viewMode, searchQuery, expandedSections,
    leiTreeData, currentLeiInfo, currentArtigo,
    hasMoreFull, loadMoreFull,
    focusedProvision, companionTab, companionOpen, handleSetCompanionOpen, aiSelectedText,
    noteBarProvision, openNoteBar, closeNoteBar,
    navigateToArtigo, scrollToArtigoInEditor,
    handleLeiChange, handlePrevious, handleNext,
    setViewMode, setSearchQuery, toggleSection,
    scrollTrigger,
  ]);

  return (
    <LeiSecaContext.Provider value={contextValue}>
      {children}
    </LeiSecaContext.Provider>
  );
}

export function useLeiSeca() {
  const ctx = useContext(LeiSecaContext);
  if (!ctx) throw new Error("useLeiSeca must be used within LeiSecaProvider on a /lei-seca route");
  return ctx;
}

export function useLeiSecaOptional() {
  return useContext(LeiSecaContext);
}
