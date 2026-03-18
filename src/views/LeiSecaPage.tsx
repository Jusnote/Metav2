'use client';

import { useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from 'next/dynamic';
import { useLeiSeca } from "@/contexts/LeiSecaContext";
import { activeArtigoStore } from "@/stores/activeArtigoStore";
import { leiCommentsStore, useLeiCommentsOpen } from "@/stores/leiCommentsStore";

const LeiSecaEditor = dynamic(
  () => import("@/components/lei-seca/lei-seca-editor").then((mod) => ({ default: mod.LeiSecaEditor })),
  { ssr: false }
);

const StudyCompanionPanel = dynamic(
  () => import("@/components/lei-seca/study-companion-panel").then((mod) => ({ default: mod.StudyCompanionPanel })),
  { ssr: false }
);

const LeiCommentsPanel = dynamic(
  () => import("@/components/lei-seca/lei-comments-panel").then((mod) => ({ default: mod.LeiCommentsPanel })),
  { ssr: false }
);


export default function LeiSecaPage() {
  const {
    plateContent, isLoading, error, lei,
    currentArtigo, viewMode,
    hasNext, hasPrev, handlePrevious, handleNext,
    hasMoreFull, loadMoreFull,
    companionOpen,
    allArtigos, pendingScrollRef, scrollTrigger,
    currentLeiId,
  } = useLeiSeca();

  const commentsOpen = useLeiCommentsOpen();

  // Sync comments store with current lei
  useEffect(() => {
    if (currentLeiId) leiCommentsStore.setLeiId(currentLeiId);
  }, [currentLeiId]);

  // Infinite scroll sentinel para modo full
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Ref para evitar stale closure no IntersectionObserver
  const loadMoreRef = useRef(loadMoreFull);
  loadMoreRef.current = loadMoreFull;

  // Slug → artigo index map for scroll spy
  const slugToIndex = useMemo(() => {
    const map = new Map<string, number>();
    allArtigos.forEach((a, i) => map.set(a.slug, i));
    return map;
  }, [allArtigos]);

  const slugToIndexRef = useRef(slugToIndex);
  slugToIndexRef.current = slugToIndex;

  // Salvar scroll antes do editor recriar, restaurar depois
  const savedScrollRef = useRef(0);
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && savedScrollRef.current > 0) {
      el.scrollTop = savedScrollRef.current;
    }
  }, [plateContent]);

  // ===== Infinite scroll observer (modo full) =====
  useEffect(() => {
    if (viewMode !== 'full' || !hasMoreFull) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const el = scrollContainerRef.current;
          if (el) savedScrollRef.current = el.scrollTop;
          loadMoreRef.current();
        }
      },
      { root: scrollContainerRef.current, rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode, hasMoreFull]);

  // ===== Scroll spy: rAF-coalesced, writes to external store (no React state) =====
  useEffect(() => {
    if (viewMode !== 'full') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const setupObserver = () => {
      const artigoEls = Array.from(container.querySelectorAll<HTMLElement>('p[data-role="artigo"]'));
      if (artigoEls.length === 0) return null;

      const visibleSet = new Set<HTMLElement>();
      let pendingRaf = false;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visibleSet.add(entry.target as HTMLElement);
            else visibleSet.delete(entry.target as HTMLElement);
          }

          // Coalesce: max 1 update per animation frame
          if (!pendingRaf) {
            pendingRaf = true;
            requestAnimationFrame(() => {
              pendingRaf = false;

              // Find topmost visible artigo
              let topMost: HTMLElement | null = null;
              let topMostY = Infinity;
              for (const el of visibleSet) {
                const y = el.getBoundingClientRect().top;
                if (y < topMostY) { topMostY = y; topMost = el; }
              }

              if (topMost) {
                const slug = topMost.getAttribute('data-slug');
                if (slug) {
                  const index = slugToIndexRef.current.get(slug);
                  if (index !== undefined) {
                    // Write to external store — NO React state update, NO context invalidation
                    activeArtigoStore.setActiveArtigoIndex(index);
                  }
                }
              }
            });
          }
        },
        // Observe only top 40% of container
        { root: container, rootMargin: '0px 0px -60% 0px', threshold: 0 }
      );

      artigoEls.forEach(el => observer.observe(el));
      return observer;
    };

    // Try immediately, retry with rAF if elements aren't ready
    let observer = setupObserver();
    let rafId: number | undefined;
    if (!observer) {
      rafId = requestAnimationFrame(() => {
        observer = setupObserver();
      });
    }

    return () => {
      observer?.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [viewMode, plateContent]);

  // ===== Pending scroll: scroll to artigo after view mode switch or sidebar click =====
  const scrollToSlug = useCallback((slug: string): boolean => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const el = container.querySelector<HTMLElement>(`p[data-slug="${CSS.escape(slug)}"]`);
    if (!el) return false;

    // Scroll with 40px offset from top
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top - 40;
    container.scrollBy({ top: offset, behavior: 'smooth' });

    // Flash highlight
    el.classList.add('lei-flash-highlight');
    const onEnd = () => {
      el.classList.remove('lei-flash-highlight');
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd);
    return true;
  }, []);

  // Scroll to a provision slug (used by comments panel click)
  const scrollToCommentSlug = useCallback((slug: string) => {
    scrollToSlug(slug);
  }, [scrollToSlug]);

  useEffect(() => {
    if (pendingScrollRef.current === null) return;
    const targetIndex = pendingScrollRef.current;

    const artigo = allArtigos[targetIndex];
    if (!artigo) {
      pendingScrollRef.current = null;
      return;
    }

    // Try to scroll after DOM commit. If element is not yet in DOM
    // (e.g., fullModeCount expansion hasn't rendered yet), keep the ref
    // so the next render cycle (when plateContent updates) retries.
    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 10;

    const tryScroll = () => {
      if (cancelled) return;
      attempt++;
      const found = scrollToSlug(artigo.slug);
      if (found) {
        pendingScrollRef.current = null;
      } else if (attempt < MAX_ATTEMPTS) {
        // Element not in DOM yet — retry next frame (TipTap may still be rendering)
        requestAnimationFrame(tryScroll);
      } else {
        // Give up after MAX_ATTEMPTS frames to avoid infinite loop
        pendingScrollRef.current = null;
      }
    };

    // Wait 2 frames for TipTap's setContent effect + DOM commit, then start trying
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryScroll();
      });
    });

    return () => { cancelled = true; };
  }, [plateContent, scrollTrigger, allArtigos, scrollToSlug, pendingScrollRef]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-neutral-600">Carregando lei...</p>
      </div>
    );
  }

  if (error || !lei) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-red-600">Erro ao carregar lei: {error?.message}</p>
      </div>
    );
  }

  const isFullMode = viewMode === 'full';

  return (
    <div className="h-full flex flex-col min-w-0 flex-1">
      {/* Navegação entre artigos (esconde no modo full) */}
      {!isFullMode && (
        <div className="border-b">
          <div className="px-8 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handlePrevious}
              disabled={!hasPrev}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>

            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground">
                {currentArtigo ? `Art. ${currentArtigo.numero}` : 'Carregando...'}
              </h1>
              {currentArtigo?.contexto && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentArtigo.contexto}
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleNext}
              disabled={!hasNext}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Editor + Comments column */}
      <div className="flex-1 flex min-h-0">
        {/* Editor scroll container */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto px-4 py-8 min-w-0 scrollbar-hide">
          <div className="flex min-h-full">
            {/* Editor area */}
            <div className="flex-1 min-w-0">
              <LeiSecaEditor content={plateContent} />

              {/* Sentinel para infinite scroll no modo full */}
              {isFullMode && hasMoreFull && (
                <div ref={sentinelRef} className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                    Carregando mais artigos...
                  </div>
                </div>
              )}
            </div>

            {/* Study Companion Panel — inside scroll */}
            {!commentsOpen && companionOpen && (
              <div
                className="w-[360px] flex-shrink-0 self-start sticky top-0 pl-6"
                style={{ height: 'calc(100vh - 10rem)' }}
              >
                <StudyCompanionPanel />
              </div>
            )}
          </div>
        </div>

        {/* Comments column — fixed panel, outside scroll */}
        {commentsOpen && (
          <div className="w-[340px] flex-shrink-0 bg-[#F8FAFD] dark:bg-zinc-900 border-l border-border/50 overflow-y-auto">
            <LeiCommentsPanel onScrollToSlug={scrollToCommentSlug} />
          </div>
        )}
      </div>

    </div>
  );
}
