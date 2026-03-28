import { useState, useEffect, useCallback, useRef } from "react";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import { QuestoesSearchBar } from "@/components/questoes/QuestoesSearchBar";
import { QuestoesFilterBar } from "@/components/questoes/QuestoesFilterBar";
import { QuestoesFilterOverlay } from "@/components/questoes/QuestoesFilterOverlay";
import { FilterChipsBidirectional } from "@/components/questoes/FilterChipsBidirectional";
import { VirtualizedQuestionList } from "@/components/questoes/VirtualizedQuestionList";
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

export default function QuestoesPage() {
  const {
    statusTab,
    setStatusTab,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
  } = useQuestoesContext();

  // Track if any popover is open (for overlay)
  const [hasOpenPopover, setHasOpenPopover] = useState(false);

  // Ctrl+K overlay mode — shows filter bar as floating overlay
  const [ctrlKOpen, setCtrlKOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeCtrlK = useCallback(() => {
    setCtrlKOpen(false);
    setHasOpenPopover(false);
  }, []);

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
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      {/* Normal search + filter bar — scrolls with page (NOT sticky) */}
      <div className="px-2 pt-3 pb-2">
        <QuestoesSearchBar />
        <QuestoesFilterBar onPopoverChange={setHasOpenPopover} />
      </div>

      {/* Ctrl+K floating overlay — appears when user presses Ctrl+K */}
      {ctrlKOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            onClick={closeCtrlK}
          />
          {/* Floating bar */}
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
              <QuestoesFilterBar onPopoverChange={setHasOpenPopover} />
            </div>
          </div>
        </>
      )}

      {/* Active filter chips bar */}
      <div className="px-2">
        <FilterChipsBidirectional />
      </div>

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between px-2 pb-8 pt-2 gap-2">
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
          <div className="flex items-center rounded-md border border-border p-0.5">
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

      {/* Questions with overlay (dim when popover open from normal bar) */}
      <div className="flex-1 min-h-0 px-2">
        <QuestoesFilterOverlay visible={hasOpenPopover && !ctrlKOpen}>
          <VirtualizedQuestionList />
        </QuestoesFilterOverlay>
      </div>
    </div>
  );
}
