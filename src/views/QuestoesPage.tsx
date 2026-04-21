import { useState, useEffect, useCallback, useRef } from "react";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import { QuestoesSearchBar } from "@/components/questoes/QuestoesSearchBar";
import { QuestoesFilterBar } from "@/components/questoes/QuestoesFilterBar";
import { QuestoesFilterOverlay } from "@/components/questoes/QuestoesFilterOverlay";
import { FilterChipsBidirectional } from "@/components/questoes/FilterChipsBidirectional";
import { QuestoesResultsHeader } from "@/components/questoes/QuestoesResultsHeader";
import { VirtualizedQuestionList } from "@/components/questoes/VirtualizedQuestionList";
import { ObjetivoSection } from "@/components/questoes/objetivo/ObjetivoSection";
import { SemanticScopeToggle } from "@/components/questoes/objetivo/SemanticScopeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ArrowUpDown, List, Square } from "lucide-react";
import type { StatusTab, SortOption, ViewMode } from "@/contexts/QuestoesContext";

const SORT_LABELS: Record<SortOption, string> = {
  recentes: "Mais recentes",
  dificuldade: "Mais dificeis",
  menos_resolvidas: "Menos resolvidas",
  relevancia: "Relevancia IA",
};

const TAB_LABELS: Record<StatusTab, string> = {
  todas: "Todas",
  nao_resolvidas: "Nao resolvidas",
  erradas: "Erradas",
  marcadas: "Marcadas",
};

type FilterView = 'filtros' | 'semantico' | 'cadernos';

const FILTER_VIEW_LABELS: Record<FilterView, string> = {
  filtros: 'Filtros',
  semantico: 'Filtro semântico',
  cadernos: 'Cadernos',
};

export default function QuestoesPage() {
  const {
    statusTab,
    setStatusTab,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    triggerSearch,
  } = useQuestoesContext();

  // Track which filter view is active
  const [filterView, setFilterView] = useState<FilterView>('filtros');

  // Track if any popover is open (for overlay)
  const [hasOpenPopover, setHasOpenPopover] = useState(false);

  // Ctrl+K overlay
  const [ctrlKOpen, setCtrlKOpen] = useState(false);

  const closeCtrlK = useCallback(() => {
    setCtrlKOpen(false);
    setHasOpenPopover(false);
  }, []);

  // Buscar button → commits draft filters to query
  const handleSearch = useCallback(() => {
    triggerSearch();
  }, [triggerSearch]);

  // Global Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCtrlKOpen(true);
      }
      if (e.key === "Escape" && ctrlKOpen) {
        e.preventDefault();
        closeCtrlK();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ctrlKOpen, closeCtrlK]);

  // The bar is visible either when at top of page (normal flow) or via Ctrl+K overlay
  const showOverlay = ctrlKOpen || hasOpenPopover;

  return (
    <div className="flex flex-col h-full w-full">
      {/* ─── Filters section (light blue background) ─── */}
      <section className="bg-gradient-to-b from-[#EEF4FF] to-[#F5F9FF] border border-blue-100/60 rounded-2xl mx-4 mt-4 overflow-hidden">
        <div className="max-w-5xl mx-auto w-full px-2">
          {/* Header refinado: título serifa + tabs como segmented control */}
          <div className="flex items-center justify-between gap-5 pt-[18px] pb-[14px] border-b border-[#f1f5f9]">
            <h1
              className="m-0 leading-none"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: '26px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Banco de Questões
              <span style={{ color: '#2563eb' }}>.</span>
            </h1>

            <nav
              className="inline-flex items-center gap-[2px] rounded-full bg-[#f1f5f9] p-[3px]"
              aria-label="Modo de filtro"
            >
              {(Object.keys(FILTER_VIEW_LABELS) as FilterView[]).map((view) => {
                const active = filterView === view;
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setFilterView(view)}
                    className={[
                      'rounded-full px-[14px] py-[6px] text-[12px] transition-all',
                      active
                        ? 'bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)] font-semibold'
                        : 'bg-transparent text-[#64748b] font-medium hover:text-[#0f172a]',
                    ].join(' ')}
                  >
                    {FILTER_VIEW_LABELS[view]}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Seção OBJETIVO — Fase 1A: UI só, foco não afeta query ainda */}
          <ObjetivoSection />

          {/* View content */}
          {filterView === 'filtros' && (
            <>
              <div className="pt-2 pb-2">
                <QuestoesFilterBar onPopoverChange={setHasOpenPopover} onSearch={handleSearch} />
              </div>
              <FilterChipsBidirectional onSearch={handleSearch} />
            </>
          )}

          {filterView === 'semantico' && (
            <div className="pt-2 pb-2">
              <QuestoesSearchBar />
              {/* Fase 1A: visible=false → não renderiza. Fase 2 ativa baseado em foco+query. */}
              <SemanticScopeToggle
                visible={false}
                incluirFora={false}
                onToggle={() => { /* noop — Fase 2 */ }}
              />
            </div>
          )}

          {filterView === 'cadernos' && (
            <div className="py-8 text-center text-sm text-slate-500">
              Cadernos em breve.
            </div>
          )}

          {/* Results count + search indicators */}
          <QuestoesResultsHeader />

          {/* Tabs + Sort */}
          <div className="flex items-center justify-between pb-4 pt-2 gap-2">
            <Tabs
              value={statusTab}
              onValueChange={(v) => setStatusTab(v as StatusTab)}
              className="w-auto"
            >
              <TabsList className="h-8">
                {(Object.keys(TAB_LABELS) as StatusTab[]).map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="text-xs px-3 h-7">
                    {TAB_LABELS[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1">
              {/* View mode toggle */}
              <div className="flex items-center rounded-md border border-border p-0.5 bg-white/60">
                <button
                  onClick={() => setViewMode('lista')}
                  className={`inline-flex items-center justify-center h-7 w-7 rounded-sm transition-colors ${
                    viewMode === 'lista'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Lista"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('individual')}
                  className={`inline-flex items-center justify-center h-7 w-7 rounded-sm transition-colors ${
                    viewMode === 'individual'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Individual"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    {SORT_LABELS[sortBy]}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                      <DropdownMenuRadioItem key={opt} value={opt} className="text-sm">
                        {SORT_LABELS[opt]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </section>

      {/* Ctrl+K floating overlay */}
      {ctrlKOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            onClick={closeCtrlK}
          />
          <div
            className="fixed top-4 left-1/2 z-50 w-full max-w-5xl px-4"
            style={{ transform: "translateX(-50%)" }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 16,
                boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
                overflow: "hidden",
              }}
            >
              <QuestoesSearchBar autoFocus />
              <QuestoesFilterBar onPopoverChange={setHasOpenPopover} onSearch={handleSearch} />
            </div>
          </div>
        </>
      )}

      {/* ─── Questions section (white background) ─── */}
      <section className="flex-1 min-h-0 bg-white">
        <div className="max-w-5xl mx-auto w-full h-full px-2 pt-4">
          <QuestoesFilterOverlay visible={hasOpenPopover && !ctrlKOpen}>
            <VirtualizedQuestionList />
          </QuestoesFilterOverlay>
        </div>
      </section>
    </div>
  );
}
