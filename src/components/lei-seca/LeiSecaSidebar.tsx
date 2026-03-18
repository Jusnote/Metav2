"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LeiTree } from "@/components/ui/lei-tree";
import { TracingBeam, type TracingBeamRef } from "@/components/ui/tracing-beam";
import { useLeiSecaOptional } from "@/contexts/LeiSecaContext";
import { activeArtigoStore, useActiveArtigoIndex } from "@/stores/activeArtigoStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LeiSecaSidebar() {
  const ctx = useLeiSecaOptional();

  if (!ctx) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-gray-400">Navegue para Lei Seca</p>
      </div>
    );
  }

  const {
    leis, leisLoading, currentLeiId, lei,
    currentLeiInfo, totalArtigos, currentArtigoIndex,
    viewMode, setViewMode, searchQuery, setSearchQuery,
    expandedSections, toggleSection,
    leiTreeData, navigateToArtigo, scrollToArtigoInEditor, handleLeiChange,
    isLoading, error,
  } = ctx;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (error || !lei) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-red-400">Erro ao carregar lei</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Seletor de Lei */}
      <div className="px-3 pt-3 pb-2 space-y-2.5">
        {/* Dropdown de seleção de lei */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/60 rounded-lg transition-colors">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {currentLeiInfo?.sigla || lei.nome || lei.numero}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {currentLeiInfo?.nome || lei.ementa}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 ml-2" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {leis.map((leiItem) => (
              <DropdownMenuItem
                key={leiItem.id}
                onClick={() => handleLeiChange(leiItem.id)}
                className={cn(
                  "flex flex-col items-start py-2",
                  leiItem.id === currentLeiId && "bg-accent"
                )}
              >
                <span className="font-medium">{leiItem.sigla} - {leiItem.nome}</span>
                <span className="text-xs text-muted-foreground">{leiItem.total_artigos} artigos</span>
              </DropdownMenuItem>
            ))}
            {leis.length === 0 && !leisLoading && (
              <DropdownMenuItem disabled>Nenhuma lei nesta categoria</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Busca + View mode */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-transparent border-border"
            />
          </div>
          <div className="flex rounded-md border border-border overflow-hidden shrink-0">
            {([1, 'full'] as const).map((mode) => (
              <button
                key={String(mode)}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {mode === 'full' ? 'Todos' : '1'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b" />

      {/* Tree with Tracing Beam */}
      <TracingBeamTree
        viewMode={viewMode}
        totalArtigos={totalArtigos}
        leiTreeData={leiTreeData}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
        onSelectArtigo={viewMode === 'full' ? scrollToArtigoInEditor : navigateToArtigo}
      />

      {/* Footer — isolated subscriber, does NOT cause sidebar re-render on scroll */}
      <SidebarFooterPosition
        viewMode={viewMode}
        currentArtigoIndex={currentArtigoIndex}
        totalArtigos={totalArtigos}
      />
    </div>
  );
}

// Isolated subscriber: wraps LeiTree with TracingBeam + auto-scroll
// Only this component re-renders when activeArtigoIndex changes (not the whole sidebar)
function TracingBeamTree({ viewMode, totalArtigos, leiTreeData, expandedSections, toggleSection, onSelectArtigo }: {
  viewMode: number | 'full';
  totalArtigos: number;
  leiTreeData: import("@/components/ui/lei-tree").LeiTreeNode[];
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  onSelectArtigo: (index: number) => void;
}) {
  const activeIndex = useActiveArtigoIndex();
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<TracingBeamRef>(null);

  // Auto-scroll sidebar to active article (debounced, after auto-expand)
  useEffect(() => {
    if (viewMode !== 'full') return;

    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = activeArtigoStore.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const idx = activeArtigoStore.getSnapshot();
        const el = treeScrollRef.current?.querySelector<HTMLElement>(
          `[data-artigo-index="${idx}"]`
        );
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 300);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [viewMode]);

  return (
    <div className="flex-1 overflow-y-auto pl-3 pr-1 py-2" ref={treeScrollRef}>
      <TracingBeam ref={beamRef} activeArtigoIndex={activeIndex} scrollContainerRef={treeScrollRef}>
        <LeiTree
          data={leiTreeData}
          expanded={expandedSections}
          onToggle={toggleSection}
          onSelectArtigo={onSelectArtigo}
          onAnimationStart={() => beamRef.current?.animationStarted()}
          onAnimationSettled={() => beamRef.current?.remeasure()}
          hideChevrons
        />
      </TracingBeam>
    </div>
  );
}

// Isolated component: subscribes to active artigo store directly
// Only this tiny component re-renders on scroll, not the entire sidebar
function SidebarFooterPosition({ viewMode, currentArtigoIndex, totalArtigos }: {
  viewMode: number | 'full';
  currentArtigoIndex: number;
  totalArtigos: number;
}) {
  const activeIndex = useActiveArtigoIndex();
  const displayIndex = viewMode === 'full' ? activeIndex : currentArtigoIndex;

  return (
    <div className="p-3 border-t">
      <div className="text-xs text-foreground/70 space-y-1">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="font-medium text-foreground">{totalArtigos}</span>
        </div>
        <div className="flex justify-between">
          <span>Posição</span>
          <span className="font-medium text-foreground">
            {displayIndex + 1} / {totalArtigos}
          </span>
        </div>
      </div>
    </div>
  );
}
