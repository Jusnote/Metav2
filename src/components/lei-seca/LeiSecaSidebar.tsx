"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LeiTree, type LeiTreeNode } from "@/components/ui/lei-tree";
import { TracingBeam, type TracingBeamRef } from "@/components/ui/tracing-beam";
import { useLeiSecaOptional } from "@/contexts/LeiSecaContext";
import { activeArtigoStore, useActiveArtigoIndex } from "@/stores/activeArtigoStore";
import type { HierarquiaNode } from "@/types/lei-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// -------- Map HierarquiaNode[] → LeiTreeNode[] --------

function hierarquiaToTreeNodes(nodes: HierarquiaNode[]): LeiTreeNode[] {
  return nodes.map((node) => ({
    id: node.path,
    type: node.tipo as LeiTreeNode['type'],
    badge: node.descricao,
    label: node.descricao,
    sublabel: node.subtitulo,
    children: node.filhos?.length ? hierarquiaToTreeNodes(node.filhos) : undefined,
  }));
}

// -------- Filter tree nodes by search query --------

function filterTree(nodes: LeiTreeNode[], query: string): LeiTreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();

  return nodes.reduce<LeiTreeNode[]>((acc, node) => {
    const labelMatch = node.label?.toLowerCase().includes(lower);
    const sublabelMatch = node.sublabel?.toLowerCase().includes(lower);
    const filteredChildren = node.children ? filterTree(node.children, query) : undefined;
    const hasMatchingChildren = filteredChildren && filteredChildren.length > 0;

    if (labelMatch || sublabelMatch || hasMatchingChildren) {
      acc.push({
        ...node,
        children: hasMatchingChildren ? filteredChildren : node.children,
      });
    }

    return acc;
  }, []);
}

// -------- Collect all branch node IDs (for expand-all on search) --------

function collectBranchIds(nodes: LeiTreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children?.length) {
      ids.push(node.id);
      ids.push(...collectBranchIds(node.children));
    }
  }
  return ids;
}

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
    leis, currentLeiId, currentLei,
    handleLeiChange,
    isLoading, error,
  } = ctx;

  // Local UI state (previously in context, now managed locally)
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build tree data from API hierarquia
  const leiTreeData = useMemo(() => {
    if (!currentLei?.hierarquia) return [];
    return hierarquiaToTreeNodes(currentLei.hierarquia);
  }, [currentLei?.hierarquia]);

  // Apply search filter
  const filteredTreeData = useMemo(() => {
    if (!searchQuery.trim()) return leiTreeData;
    const filtered = filterTree(leiTreeData, searchQuery.trim());
    // Auto-expand all matching branches when searching
    const allIds = collectBranchIds(filtered);
    setExpandedSections(new Set(allIds));
    return filtered;
  }, [leiTreeData, searchQuery]);

  // Stats from the API
  const totalArtigos = currentLei?.stats?.totalArtigos ?? 0;
  const totalDispositivos = currentLei?.stats?.totalDispositivos ?? 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (error || !currentLei) {
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
                  {currentLei.apelido || currentLei.titulo}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {currentLei.ementa || currentLei.titulo}
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
                <span className="font-medium">{leiItem.apelido ?? leiItem.titulo}</span>
                <span className="text-xs text-muted-foreground">{leiItem.tipo}</span>
              </DropdownMenuItem>
            ))}
            {leis.length === 0 && (
              <DropdownMenuItem disabled>Nenhuma lei disponível</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Busca */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar na estrutura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-transparent border-border"
            />
          </div>
        </div>
      </div>

      <div className="border-b" />

      {/* Tree with Tracing Beam */}
      <TracingBeamTree
        leiTreeData={filteredTreeData}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />

      {/* Footer stats */}
      <SidebarFooterStats
        totalArtigos={totalArtigos}
        totalDispositivos={totalDispositivos}
      />
    </div>
  );
}

// Isolated subscriber: wraps LeiTree with TracingBeam + auto-scroll
// Only this component re-renders when activeArtigoIndex changes (not the whole sidebar)
function TracingBeamTree({ leiTreeData, expandedSections, toggleSection }: {
  leiTreeData: LeiTreeNode[];
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
}) {
  const activeIndex = useActiveArtigoIndex();
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<TracingBeamRef>(null);

  return (
    <div className="flex-1 overflow-y-auto pl-3 pr-1 py-2" ref={treeScrollRef}>
      <TracingBeam ref={beamRef} activeArtigoIndex={activeIndex} scrollContainerRef={treeScrollRef}>
        <LeiTree
          data={leiTreeData}
          expanded={expandedSections}
          onToggle={toggleSection}
          onAnimationStart={() => beamRef.current?.animationStarted()}
          onAnimationSettled={() => beamRef.current?.remeasure()}
          hideChevrons
        />
      </TracingBeam>
    </div>
  );
}

// Footer showing stats from the API
function SidebarFooterStats({ totalArtigos, totalDispositivos }: {
  totalArtigos: number;
  totalDispositivos: number;
}) {
  const activeIndex = useActiveArtigoIndex();

  return (
    <div className="p-3 border-t">
      <div className="text-xs text-foreground/70 space-y-1">
        <div className="flex justify-between">
          <span>Artigos</span>
          <span className="font-medium text-foreground">{totalArtigos}</span>
        </div>
        <div className="flex justify-between">
          <span>Dispositivos</span>
          <span className="font-medium text-foreground">{totalDispositivos}</span>
        </div>
        {totalArtigos > 0 && (
          <div className="flex justify-between">
            <span>Posição</span>
            <span className="font-medium text-foreground">
              {activeIndex + 1} / {totalArtigos}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
