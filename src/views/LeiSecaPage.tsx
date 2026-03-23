"use client";

import { useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { DispositivoList } from "@/components/lei-seca/dispositivos/DispositivoList";
import { useLeiSeca } from "@/contexts/LeiSecaContext";
import { activeArtigoStore } from "@/stores/activeArtigoStore";
import { leiCommentsStore, useLeiCommentsOpen } from "@/stores/leiCommentsStore";
import type { VirtuosoHandle } from "react-virtuoso";

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
  const {
    dispositivos,
    totalDispositivos,
    loadMore,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    currentLei,
    currentLeiId,
    leiSecaMode,
    showRevogados,
    companionOpen,
  } = useLeiSeca();

  const commentsOpen = useLeiCommentsOpen();
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  // Sync comments store with current lei
  useEffect(() => {
    if (currentLeiId) leiCommentsStore.setLeiId(currentLeiId);
  }, [currentLeiId]);

  // Update active artigo index as user scrolls
  const handleRangeChanged = useCallback(
    (startIndex: number) => {
      if (dispositivos[startIndex]) {
        activeArtigoStore.setActiveArtigoIndex(startIndex);
      }
    },
    [dispositivos]
  );

  // Scroll to a dispositivo by slug (used by LeiCommentsPanel)
  const scrollToCommentSlug = useCallback(
    (slug: string) => {
      const index = dispositivos.findIndex(
        (d) => d.id === slug || d.path === slug
      );
      if (index >= 0 && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index,
          align: "start",
          behavior: "smooth",
        });
      }
    },
    [dispositivos]
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
          Erro ao carregar lei: {error?.message ?? "Lei não encontrada"}
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
      {/* Main content: DispositivoList + side panels */}
      <div className="flex-1 flex min-h-0">
        {/* Virtuoso list area — full width so scrollbar stays at right edge */}
        <div className="flex-1 overflow-hidden bg-white">
          <DispositivoList
            dispositivos={dispositivos}
            totalCount={totalDispositivos}
            loadMore={loadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            leiSecaMode={leiSecaMode}
            showRevogados={showRevogados}
            onRangeChanged={handleRangeChanged}
            virtuosoRef={virtuosoRef}
          />
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
    </div>
  );
}
