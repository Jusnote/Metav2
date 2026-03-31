"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { DispositivoList } from "@/components/lei-seca/dispositivos/DispositivoList";
import { LeiToolbar } from "@/components/lei-seca/LeiToolbar";
import { useLeiSeca } from "@/contexts/LeiSecaContext";
import { activeArtigoStore } from "@/stores/activeArtigoStore";
import { leiCommentsStore, useLeiCommentsOpen } from "@/stores/leiCommentsStore";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { useCopyWithReference } from "@/hooks/useCopyWithReference";
import { ReadingProgressBar } from "@/components/lei-seca/ReadingProgressBar";
import { useReadingProgressTracker } from "@/hooks/useReadingProgress";
import { SearchBreadcrumb } from "@/components/lei-seca/SearchBreadcrumb";
import { useActiveArtigoIndex } from "@/stores/activeArtigoStore";
import { useGrifos } from "@/hooks/useGrifos";
import { GrifoPopup } from "@/components/lei-seca/GrifoPopup";
import { grifoPopupStore } from "@/stores/grifoPopupStore";
import type { Grifo, GrifoColor } from "@/types/grifo";

const StudyCompanionPanel = dynamic(
  () =>
    import("@/components/lei-seca/study-companion-panel").then((mod) => ({
      default: mod.StudyCompanionPanel,
    })),
  { ssr: false }
);

const LeiCommentsPanel = dynamic(
  () =>
    import("@/components/lei-seca/lei-comments-panel").then((mod) => ({
      default: mod.LeiCommentsPanel,
    })),
  { ssr: false }
);

export default function LeiSecaPage() {
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    dispositivos,
    totalDispositivos,
    isLoading,
    error,
    currentLei,
    currentLeiId,
    leiSecaMode,
    toggleLeiSecaMode,
    showRevogados,
    toggleRevogados,
    companionOpen,
  } = useLeiSeca();

  const commentsOpen = useLeiCommentsOpen();

  useKeyboardNav({
    dispositivos,
    toggleLeiSecaMode,
    toggleRevogados,
  });

  useCopyWithReference(dispositivos, currentLei);

  const { grifosByDispositivo, createGrifo, updateGrifo, deleteGrifo } = useGrifos(currentLeiId)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Selection handler — opens grifo popup on text selection
  const lastScrollRef = useRef(0);
  useEffect(() => {
    const scrollHandler = () => { lastScrollRef.current = Date.now(); };
    window.addEventListener('scroll', scrollHandler, true);
    return () => window.removeEventListener('scroll', scrollHandler, true);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Ignore mouseup inside toolbars
      if ((e.target as HTMLElement).closest?.('[role="toolbar"]')) return;

      if (Date.now() - lastScrollRef.current < 300) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (text.length <= 3) return;
      const range = sel.getRangeAt(0);
      const textoEl = (range.startContainer as HTMLElement).closest?.('[data-texto]')
        ?? (range.startContainer.parentElement as HTMLElement)?.closest?.('[data-texto]');
      if (!textoEl) return;
      const dispEl = textoEl.closest('[data-id]');
      if (!dispEl) return;
      const dispositivoId = dispEl.getAttribute('data-id')!;
      const textoContent = textoEl.textContent ?? '';
      const selText = sel.toString();
      const startIdx = textoContent.indexOf(selText);
      if (startIdx === -1) return;

      const { activeTool, activeStyle } = grifoPopupStore.getSnapshot();

      if (activeTool !== 'cursor' && currentLeiId) {
        createGrifo({
          lei_id: currentLeiId,
          dispositivo_id: dispositivoId,
          start_offset: startIdx,
          end_offset: startIdx + selText.length,
          texto_grifado: selText,
          color: activeTool,
          style: activeStyle,
        });
        sel.removeAllRanges();
      }
      // cursor tool → normal selection, no action
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [createGrifo, currentLeiId]);

  // Keyboard shortcuts Alt+0..5 — switch active tool
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const toolMap: Record<string, GrifoColor | 'cursor'> = {
        '0': 'cursor', '1': 'yellow', '2': 'green', '3': 'blue', '4': 'pink', '5': 'orange'
      };
      const tool = toolMap[e.key];
      if (!tool) return;
      e.preventDefault();
      grifoPopupStore.setActiveTool(tool);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Grifo click handler — Ctrl+click deletes, normal click opens edit popup
  const handleGrifoClick = useCallback((grifo: Grifo, _rect: DOMRect) => {
    // Check if Ctrl/Cmd was held during the click
    const lastEvent = window.event as MouseEvent | undefined;
    if (lastEvent?.ctrlKey || lastEvent?.metaKey) {
      deleteGrifo(grifo.id);
      return;
    }
    grifoPopupStore.openExisting(grifo);
  }, [deleteGrifo]);

  // Popup callbacks
  const handleCreateGrifo = useCallback((color: GrifoColor) => {
    const s = grifoPopupStore.getSnapshot();
    if (!s.dispositivoId || !currentLeiId) return;
    createGrifo({
      lei_id: currentLeiId,
      dispositivo_id: s.dispositivoId,
      start_offset: s.startOffset,
      end_offset: s.endOffset,
      texto_grifado: s.textoGrifado,
      color,
    });
  }, [createGrifo, currentLeiId]);

  const handleUpdateColor = useCallback((id: string, color: GrifoColor) => {
    updateGrifo(id, { color });
  }, [updateGrifo]);

  const handleDeleteGrifo = useCallback((id: string) => {
    deleteGrifo(id);
  }, [deleteGrifo]);

  const handleSaveNote = useCallback((grifoId: string, note: string) => {
    updateGrifo(grifoId, { note: note || null });
    grifoPopupStore.closeNote();
  }, [updateGrifo]);

  const activeIndex = useActiveArtigoIndex();
  useReadingProgressTracker(currentLeiId, dispositivos, totalDispositivos, activeIndex);

  // Sync comments store with current lei
  useEffect(() => {
    if (currentLeiId) leiCommentsStore.setLeiId(currentLeiId);
  }, [currentLeiId]);

  // Scroll to a dispositivo by posicao (used by SearchBreadcrumb)
  const handleScrollToDispositivo = useCallback(
    (posicao: number) => {
      const el = document.querySelector(`[data-posicao="${posicao}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    []
  );

  // Scroll to a dispositivo by array index (used by SearchBreadcrumb tree nav)
  const handleSelectArtigoIndex = useCallback(
    (index: number) => {
      const item = dispositivos[index];
      if (item) {
        const el = document.querySelector(`[data-posicao="${item.posicao}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [dispositivos]
  );

  // Scroll to a dispositivo by slug (used by LeiCommentsPanel)
  const scrollToCommentSlug = useCallback(
    (slug: string) => {
      const el = document.querySelector(`[data-id="${slug}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    []
  );

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-neutral-600">Carregando lei...</p>
      </div>
    );
  }

  if (error || !currentLei) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-red-600">
          Erro ao carregar lei: {error?.message ?? "Lei n\u00e3o encontrada"}
        </p>
      </div>
    );
  }

  if (dispositivos.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        Nenhum dispositivo encontrado.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-w-0 flex-1">
      <LeiToolbar />
      <ReadingProgressBar />
      {/* Main content: DispositivoList + side panels */}
      <div className="flex-1 flex min-h-0">
        {/* List area — full width so scrollbar stays at right edge */}
        <div className="flex-1 flex flex-col bg-white relative">
          {/* SearchBreadcrumb: aligned with text column, overflow-visible for dropdown */}
          <div className="max-w-[820px] mx-auto px-5 w-full relative z-20">
            <SearchBreadcrumb
              currentLei={currentLei}
              dispositivos={dispositivos}
              totalDispositivos={totalDispositivos}
              onScrollToDispositivo={handleScrollToDispositivo}
              onSelectArtigoIndex={handleSelectArtigoIndex}
              onOpenChange={setSearchOpen}
            />
          </div>
          {/* DispositivoList: scrollable container */}
          <div ref={scrollContainerRef} className={`relative flex-1 overflow-y-auto transition-opacity duration-100 ${searchOpen ? 'opacity-15' : ''}`}>
            <DispositivoList
              dispositivos={dispositivos}
              leiId={currentLeiId}
              leiSecaMode={leiSecaMode}
              showRevogados={showRevogados}
              grifosByDispositivo={grifosByDispositivo}
              onGrifoClick={handleGrifoClick}
              onSaveNote={handleSaveNote}
            />
          </div>
        </div>

        {/* Study Companion Panel */}
        {!commentsOpen && companionOpen && (
          <div
            className="w-[360px] flex-shrink-0 border-l border-border/50 overflow-y-auto"
          >
            <StudyCompanionPanel />
          </div>
        )}

        {/* Comments panel — fixed panel, outside scroll */}
        {commentsOpen && (
          <div className="w-[340px] flex-shrink-0 bg-[#F8FAFD] dark:bg-zinc-900 border-l border-border/50 overflow-y-auto">
            <LeiCommentsPanel onScrollToSlug={scrollToCommentSlug} />
          </div>
        )}
      </div>
      <GrifoPopup
        scrollContainerRef={scrollContainerRef}
        onCreateGrifo={handleCreateGrifo}
        onUpdateColor={handleUpdateColor}
        onDeleteGrifo={handleDeleteGrifo}
        onOpenNote={() => {
          const s = grifoPopupStore.getSnapshot()
          if (s.existingGrifo) {
            grifoPopupStore.openNote(s.existingGrifo.id)
          } else if (s.dispositivoId && currentLeiId) {
            // Create grifo first with last color, then open note
            const tempId = createGrifo({
              lei_id: currentLeiId,
              dispositivo_id: s.dispositivoId,
              start_offset: s.startOffset,
              end_offset: s.endOffset,
              texto_grifado: s.textoGrifado,
              color: s.lastColor,
            })
            grifoPopupStore.openNote(tempId)
          }
        }}
      />
    </div>
  );
}
