"use client";

import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useCadernosContext } from "@/contexts/CadernosContext";
import type { CadernoItem, ContextChainItem, CadernoFilters } from "@/types/caderno";
import { CADERNO_COLORS } from "@/types/caderno";
import {
  Notebook, Trash2, X, Pin, PinOff, Check,
  BookOpen, Tag, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ============ Multi-filter logic ============
// Fontes (lei): OR within group
// Tags (markers): AND between them, AND with fontes

function applyFilters(
  items: CadernoItem[],
  leiIds: string[],
  markers: string[],
): CadernoItem[] {
  return items.filter(item => {
    // Fontes: OR — item must match at least one selected lei (or all if none)
    if (leiIds.length > 0 && !leiIds.includes(item.lei_id)) return false;
    // Tags: AND — item must have ALL selected markers
    if (markers.length > 0) {
      const itemMarkers = item.markers || [];
      if (!markers.every(m => itemMarkers.includes(m))) return false;
    }
    return true;
  });
}

// ============ Group items by lei ============

interface LeiGroup {
  leiId: string;
  leiSigla: string;
  leiNome: string;
  items: CadernoItem[];
}

function groupByLei(items: CadernoItem[]): LeiGroup[] {
  const map = new Map<string, LeiGroup>();
  for (const item of items) {
    if (!map.has(item.lei_id)) {
      map.set(item.lei_id, {
        leiId: item.lei_id,
        leiSigla: item.lei_sigla || item.lei_id,
        leiNome: item.lei_nome || '',
        items: [],
      });
    }
    map.get(item.lei_id)!.items.push(item);
  }
  return Array.from(map.values());
}

// ============ Provision Card (with marker support) ============

function ContextLine({ item }: { item: ContextChainItem }) {
  return (
    <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
      {item.text}
    </p>
  );
}

function ProvisionCard({
  item,
  onRemove,
  onAddMarker,
  onRemoveMarker,
}: {
  item: CadernoItem;
  onRemove: () => void;
  onAddMarker: (marker: string) => void;
  onRemoveMarker: (marker: string) => void;
}) {
  const chain: ContextChainItem[] = item.context_chain || [];
  const markers = item.markers || [];
  const [isAdding, setIsAdding] = useState(false);
  const [newMarker, setNewMarker] = useState("");

  const handleAdd = () => {
    const cleaned = newMarker.trim().replace(/^#/, '');
    if (cleaned) {
      onAddMarker(cleaned);
      setNewMarker("");
      setIsAdding(false);
    }
  };

  return (
    <div className="group relative py-3 border-l-2 border-border hover:border-primary/40 transition-colors">
      {/* Parent context chain */}
      {chain.length > 0 && (
        <div className="pl-4 mb-1.5 space-y-0.5">
          {chain.map((ctx, i) => (
            <div key={i} style={{ paddingLeft: `${i * 0.75}rem` }}>
              <ContextLine item={ctx} />
            </div>
          ))}
        </div>
      )}

      {/* Saved provision */}
      <div
        className="pl-4 py-1.5 bg-primary/[0.03] border-l-2 border-l-primary -ml-[2px] rounded-r"
        style={{ paddingLeft: `calc(1rem + ${chain.length * 0.75}rem)` }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed text-foreground font-medium">
              {item.provision_text}
            </p>

            {/* Markers row */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {markers.map((m) => (
                <span
                  key={m}
                  className="group/tag inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                >
                  #{m}
                  <button
                    onClick={() => onRemoveMarker(m)}
                    className="opacity-0 group-hover/tag:opacity-100 ml-0.5"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </span>
              ))}

              {/* Add marker inline */}
              {isAdding ? (
                <span className="inline-flex items-center gap-0.5">
                  <input
                    autoFocus
                    value={newMarker}
                    onChange={(e) => setNewMarker(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd();
                      if (e.key === 'Escape') { setIsAdding(false); setNewMarker(""); }
                    }}
                    onBlur={() => { if (!newMarker.trim()) setIsAdding(false); }}
                    placeholder="tag..."
                    className="w-16 text-[10px] bg-transparent border-b border-blue-400 outline-none py-0.5"
                  />
                  <button onClick={handleAdd} className="p-0.5 text-blue-600">
                    <Check className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <Plus className="h-2.5 w-2.5" />
                  tag
                </button>
              )}
            </div>

            {item.note && (
              <div className="mt-2 px-3 py-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                <p className="text-xs text-blue-800 dark:text-blue-200">{item.note}</p>
              </div>
            )}
          </div>
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
            title="Remover do caderno"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Pin Filter Inline ============

function PinFilterInline({
  defaultTitle,
  onPin,
  onCancel,
}: {
  defaultTitle: string;
  onPin: (title: string, color: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [colorIndex, setColorIndex] = useState(0);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-dashed border-primary/30">
      <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) onPin(title.trim(), CADERNO_COLORS[colorIndex]);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Nome da view..."
        className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none"
      />
      <div className="flex items-center gap-0.5">
        {CADERNO_COLORS.slice(0, 6).map((color, i) => (
          <button
            key={color}
            onClick={() => setColorIndex(i)}
            className={cn(
              "w-3.5 h-3.5 rounded-full transition-transform",
              colorIndex === i && "ring-2 ring-offset-1 ring-primary scale-110"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <button
        onClick={() => title.trim() && onPin(title.trim(), CADERNO_COLORS[colorIndex])}
        disabled={!title.trim()}
        className="p-1 text-primary disabled:opacity-30"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={onCancel} className="p-1 text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ============ Page ============

export default function CadernosPage() {
  const {
    items, isLoading, unsaveProvision, getLeis, getAllMarkers,
    addMarker, removeMarker,
    savedViews, pinView, unpinView, isPinned,
  } = useCadernosContext();

  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPinForm, setShowPinForm] = useState(false);

  // ---- Parse URL params ----
  const viewId = searchParams.get('view');
  const activeLeiIds = searchParams.getAll('lei');
  const activeMarkerParams = searchParams.getAll('tag');

  const activeView = useMemo(
    () => viewId ? savedViews.find(v => v.id === viewId) : null,
    [savedViews, viewId]
  );

  // Effective filters (from view or URL)
  const effectiveLeiIds = useMemo(() =>
    activeView?.filters.lei_ids || activeLeiIds,
    [activeView, activeLeiIds]
  );
  const effectiveMarkers = useMemo(() =>
    activeView?.filters.markers || activeMarkerParams,
    [activeView, activeMarkerParams]
  );

  const leis = useMemo(() => getLeis(), [getLeis]);
  const allMarkers = useMemo(() => getAllMarkers(), [getAllMarkers]);

  // ---- Apply multi-filter ----
  const filteredItems = useMemo(
    () => applyFilters(items, effectiveLeiIds, effectiveMarkers),
    [items, effectiveLeiIds, effectiveMarkers]
  );
  const groups = useMemo(() => groupByLei(filteredItems), [filteredItems]);

  const hasActiveFilter = effectiveLeiIds.length > 0 || effectiveMarkers.length > 0;

  // Is this filter combo already pinned?
  const effectiveFilters: CadernoFilters = {
    lei_ids: effectiveLeiIds.length > 0 ? effectiveLeiIds : undefined,
    markers: effectiveMarkers.length > 0 ? effectiveMarkers : undefined,
  };
  const pinnedViewId = hasActiveFilter ? isPinned(effectiveFilters) : null;

  // ---- URL manipulation helpers ----
  const toggleLei = useCallback((leiId: string) => {
    const next = new URLSearchParams();
    const newLeis = activeLeiIds.includes(leiId)
      ? activeLeiIds.filter(l => l !== leiId)
      : [...activeLeiIds, leiId];
    for (const l of newLeis) next.append('lei', l);
    for (const m of activeMarkerParams) next.append('tag', m);
    setSearchParams(next);
  }, [activeLeiIds, activeMarkerParams, setSearchParams]);

  const toggleMarkerFilter = useCallback((marker: string) => {
    const next = new URLSearchParams();
    for (const l of activeLeiIds) next.append('lei', l);
    const newMarkers = activeMarkerParams.includes(marker)
      ? activeMarkerParams.filter(m => m !== marker)
      : [...activeMarkerParams, marker];
    for (const m of newMarkers) next.append('tag', m);
    setSearchParams(next);
  }, [activeLeiIds, activeMarkerParams, setSearchParams]);

  const removeFilterChip = useCallback((type: 'lei' | 'tag', value: string) => {
    const next = new URLSearchParams();
    for (const l of activeLeiIds) {
      if (!(type === 'lei' && l === value)) next.append('lei', l);
    }
    for (const m of activeMarkerParams) {
      if (!(type === 'tag' && m === value)) next.append('tag', m);
    }
    setSearchParams(next);
  }, [activeLeiIds, activeMarkerParams, setSearchParams]);

  const clearFilter = () => setSearchParams({});

  // ---- Handlers ----
  const handleRemove = async (item: CadernoItem) => {
    await unsaveProvision(item.provision_slug);
  };

  const handlePin = async (title: string, color: string) => {
    const view = await pinView({ title, color, filters: effectiveFilters });
    if (view) {
      setShowPinForm(false);
      toast({ title: 'View fixada na sidebar', description: title, duration: 2000 });
      setSearchParams({ view: view.id });
    }
  };

  const handleUnpin = async () => {
    if (pinnedViewId) {
      await unpinView(pinnedViewId);
      toast({ title: 'View removida da sidebar', duration: 2000 });
    }
  };

  // Resolve lei names for chips
  const leiNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leis) m.set(l.id, l.sigla);
    return m;
  }, [leis]);

  const defaultPinTitle = useMemo(() => {
    const parts: string[] = [];
    for (const id of effectiveLeiIds) parts.push(leiNameMap.get(id) || id);
    for (const m of effectiveMarkers) parts.push(`#${m}`);
    return parts.join(' + ') || 'Minha View';
  }, [effectiveLeiIds, effectiveMarkers, leiNameMap]);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            {activeView ? (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: activeView.color + '20' }}
              >
                <Notebook className="h-5 w-5" style={{ color: activeView.color }} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Notebook className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {activeView ? activeView.title : 'Meu Caderno'}
              </h1>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {filteredItems.length} {filteredItems.length === 1 ? 'dispositivo' : 'dispositivos'}
                {hasActiveFilter && !activeView && ` (${items.length} total)`}
              </p>
            </div>
          </div>
        </div>

        {/* ---- Filter bar: Fontes (OR) ---- */}
        {leis.length > 1 && !activeView && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <BookOpen className="h-3 w-3 text-muted-foreground mr-0.5" />
            {leis.map((lei) => (
              <button
                key={lei.id}
                onClick={() => toggleLei(lei.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  activeLeiIds.includes(lei.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {lei.sigla}
              </button>
            ))}
          </div>
        )}

        {/* ---- Filter bar: Tags (AND) ---- */}
        {allMarkers.length > 0 && !activeView && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <Tag className="h-3 w-3 text-muted-foreground mr-0.5" />
            {allMarkers.map((marker) => (
              <button
                key={marker}
                onClick={() => toggleMarkerFilter(marker)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  activeMarkerParams.includes(marker)
                    ? "bg-blue-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                )}
              >
                #{marker}
              </button>
            ))}
          </div>
        )}

        {/* ---- Active filter chips bar ---- */}
        {hasActiveFilter && !showPinForm && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4 px-3 py-2 rounded-lg bg-muted/50">
            {/* Lei chips */}
            {effectiveLeiIds.map((id) => (
              <span key={`lei-${id}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                {leiNameMap.get(id) || id}
                {!activeView && (
                  <button onClick={() => removeFilterChip('lei', id)} className="hover:text-red-500">
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
            {/* Tag chips */}
            {effectiveMarkers.map((m) => (
              <span key={`tag-${m}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                #{m}
                {!activeView && (
                  <button onClick={() => removeFilterChip('tag', m)} className="hover:text-red-500">
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}

            <div className="ml-auto flex items-center gap-1">
              {/* Pin / Unpin */}
              {activeView ? (
                <button
                  onClick={handleUnpin}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <PinOff className="h-3 w-3" /> Desafixar
                </button>
              ) : !pinnedViewId ? (
                <button
                  onClick={() => setShowPinForm(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-primary hover:bg-primary/5 transition-colors"
                >
                  <Pin className="h-3 w-3" /> Fixar
                </button>
              ) : (
                <button
                  onClick={handleUnpin}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <PinOff className="h-3 w-3" /> Desafixar
                </button>
              )}

              {/* Clear all */}
              <button
                onClick={clearFilter}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                title="Limpar filtros"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Pin form */}
        {showPinForm && (
          <div className="mb-4">
            <PinFilterInline
              defaultTitle={defaultPinTitle}
              onPin={handlePin}
              onCancel={() => setShowPinForm(false)}
            />
          </div>
        )}

        {/* ---- Content ---- */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Carregando dispositivos...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Notebook className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {hasActiveFilter
                ? 'Nenhum dispositivo com estes filtros.'
                : 'Nenhum dispositivo salvo.'}
              <br />
              <span className="text-xs">
                {hasActiveFilter
                  ? 'Tente ajustar os filtros.'
                  : 'Vá para a Lei Seca e clique no ícone de salvar nos dispositivos desejados.'}
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.leiId}>
                {/* Lei header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-muted text-foreground">
                    {group.leiSigla}
                  </span>
                  {group.leiNome && (
                    <span className="text-xs text-muted-foreground">{group.leiNome}</span>
                  )}
                </div>

                {/* Provisions */}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <ProvisionCard
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemove(item)}
                      onAddMarker={(marker) => addMarker(item.provision_slug, marker)}
                      onRemoveMarker={(marker) => removeMarker(item.provision_slug, marker)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
