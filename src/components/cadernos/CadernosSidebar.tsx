"use client";

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCadernosOptional } from "@/contexts/CadernosContext";
import { cn } from "@/lib/utils";
import { Notebook, Search, BookOpen, Tag, PinOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CadernoSavedView } from "@/types/caderno";

// ============ Pinned View Item ============

function PinnedViewItem({
  view,
  isActive,
  itemCount,
  onClick,
  onUnpin,
}: {
  view: CadernoSavedView;
  isActive: boolean;
  itemCount: number;
  onClick: () => void;
  onUnpin: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent"
      )}
      onClick={onClick}
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: view.color + '20' }}
      >
        <Notebook className="h-2.5 w-2.5" style={{ color: view.color }} />
      </div>
      <span className="text-xs font-medium truncate flex-1">{view.title}</span>
      <span className="text-[10px] text-muted-foreground flex-shrink-0 group-hover:hidden">
        {itemCount}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onUnpin(); }}
        className="hidden group-hover:block p-0.5 rounded text-muted-foreground hover:text-red-500 flex-shrink-0"
        title="Desafixar"
      >
        <PinOff className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ============ Helpers ============

function buildUrl(
  activeLeiIds: string[],
  activeMarkers: string[],
  toggleType: 'lei' | 'marker',
  toggleValue: string,
): string {
  let leis = [...activeLeiIds];
  let markers = [...activeMarkers];

  if (toggleType === 'lei') {
    leis = leis.includes(toggleValue)
      ? leis.filter(l => l !== toggleValue)
      : [...leis, toggleValue];
  } else {
    markers = markers.includes(toggleValue)
      ? markers.filter(m => m !== toggleValue)
      : [...markers, toggleValue];
  }

  const params = new URLSearchParams();
  for (const l of leis) params.append('lei', l);
  for (const m of markers) params.append('tag', m);
  const qs = params.toString();
  return qs ? `/cadernos?${qs}` : '/cadernos';
}

// ============ Main Sidebar ============

export function CadernosSidebar() {
  const ctx = useCadernosOptional();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  if (!ctx) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-gray-400">Carregando caderno...</p>
      </div>
    );
  }

  const isOnCadernos = location.pathname === '/cadernos';
  const currentParams = new URLSearchParams(location.search);
  const currentViewId = currentParams.get('view');
  const activeLeiIds = currentParams.getAll('lei');
  const activeMarkers = currentParams.getAll('tag');
  const leis = ctx.getLeis();
  const allMarkers = ctx.getAllMarkers();

  // Count items matching a saved view's filters
  const countForView = (view: CadernoSavedView): number => {
    return ctx.items.filter(item => {
      const f = view.filters;
      if (f.lei_ids && f.lei_ids.length > 0 && !f.lei_ids.includes(item.lei_id)) return false;
      if (f.markers && f.markers.length > 0) {
        if (!f.markers.every(m => (item.markers || []).includes(m))) return false;
      }
      return true;
    }).length;
  };

  // Count per lei
  const leiCounts = new Map<string, number>();
  for (const item of ctx.items) {
    leiCounts.set(item.lei_id, (leiCounts.get(item.lei_id) || 0) + 1);
  }

  // Count per marker
  const markerCounts = new Map<string, number>();
  for (const item of ctx.items) {
    for (const m of (item.markers || [])) {
      markerCounts.set(m, (markerCounts.get(m) || 0) + 1);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Caderno</h2>
          <span className="text-[10px] text-muted-foreground">
            {ctx.items.length} {ctx.items.length === 1 ? 'dispositivo' : 'dispositivos'}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar dispositivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-transparent border-border"
          />
        </div>
      </div>

      <div className="border-b" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {ctx.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground">Carregando...</p>
          </div>
        ) : leis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 gap-2">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Notebook className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground text-center">Nenhum dispositivo salvo</p>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Vá para a Lei Seca e clique no ícone de salvar
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pinned Views */}
            {ctx.savedViews.length > 0 && (
              <div className="space-y-0.5">
                <p className="px-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                  Fixados
                </p>
                {ctx.savedViews.map((view) => (
                  <PinnedViewItem
                    key={view.id}
                    view={view}
                    isActive={isOnCadernos && currentViewId === view.id}
                    itemCount={countForView(view)}
                    onClick={() => navigate(`/cadernos?view=${view.id}`)}
                    onUnpin={() => ctx.unpinView(view.id)}
                  />
                ))}
              </div>
            )}

            {/* "All" button */}
            <button
              onClick={() => navigate('/cadernos')}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                isOnCadernos && !location.search
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80 hover:bg-accent"
              )}
            >
              <Notebook className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium flex-1">Todos</span>
              <span className="text-[10px] text-muted-foreground">{ctx.items.length}</span>
            </button>

            {/* ---- BLOCK 1: Fontes (Structural — OR logic) ---- */}
            <div className="space-y-0.5">
              <p className="px-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                <BookOpen className="h-2.5 w-2.5" />
                Fontes
              </p>
              {leis.map((lei) => {
                const count = leiCounts.get(lei.id) || 0;
                const isActive = activeLeiIds.includes(lei.id);

                return (
                  <button
                    key={lei.id}
                    onClick={() => navigate(buildUrl(activeLeiIds, activeMarkers, 'lei', lei.id))}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-accent"
                    )}
                  >
                    <span className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0 border transition-colors",
                      isActive ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )} />
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-foreground flex-shrink-0">
                      {lei.sigla}
                    </span>
                    <span className="text-[11px] truncate flex-1 text-muted-foreground">{lei.nome}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* ---- BLOCK 2: Minhas Tags (Personal — AND logic) ---- */}
            {allMarkers.length > 0 && (
              <div className="space-y-0.5">
                <p className="px-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5" />
                  Minhas Tags
                </p>
                {allMarkers.map((marker) => {
                  const count = markerCounts.get(marker) || 0;
                  const isActive = activeMarkers.includes(marker);

                  return (
                    <button
                      key={marker}
                      onClick={() => navigate(buildUrl(activeLeiIds, activeMarkers, 'marker', marker))}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                        isActive
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          : "text-foreground/80 hover:bg-accent"
                      )}
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-sm flex-shrink-0 border transition-colors",
                        isActive ? "bg-blue-500 border-blue-500" : "border-muted-foreground/40"
                      )} />
                      <span className="text-[11px] flex-1">#{marker}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <button
          onClick={() => navigate('/cadernos')}
          className="w-full text-center text-[11px] text-primary hover:underline"
        >
          Abrir caderno completo
        </button>
      </div>
    </div>
  );
}
