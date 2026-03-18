import { useCallback } from "react";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import { SmartSearchBar, type SmartSearchPayload } from "@/components/SmartSearchBarPlate";
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

// Stable empty array — avoids creating new reference on every render
const EMPTY_BUSCAS: never[] = [];

export default function QuestoesPage() {
  const {
    filters: contextFilters,
    statusTab,
    setStatusTab,
    sortBy,
    setSortBy,
    setSearchQuery,
    toggleFilter,
    viewMode,
    setViewMode,
  } = useQuestoesContext();

  // Handle SmartSearchBar submission
  // Usa addIfMissing em vez de toggle para não remover filtros que já estão ativos
  const handleSearch = useCallback(
    (payload: SmartSearchPayload) => {
      const { query, filters } = payload;

      // Set text query
      if (query && query !== '*') {
        setSearchQuery(query);
      }

      // Adiciona filtro apenas se ainda não está no contexto (evita toggle indesejado)
      if (filters.materia && !contextFilters.materias.includes(filters.materia))
        toggleFilter('materias', filters.materia);
      if (filters.banca && !contextFilters.bancas.includes(filters.banca))
        toggleFilter('bancas', filters.banca);
      if (filters.ano && !contextFilters.anos.includes(Number(filters.ano)))
        toggleFilter('anos', Number(filters.ano));
      if (filters.orgao && !contextFilters.orgaos.includes(filters.orgao))
        toggleFilter('orgaos', filters.orgao);
      if (filters.cargo && !contextFilters.cargos.includes(filters.cargo))
        toggleFilter('cargos', filters.cargo);
      if (filters.assunto && !contextFilters.assuntos.includes(filters.assunto))
        toggleFilter('assuntos', filters.assunto);
    },
    [setSearchQuery, toggleFilter, contextFilters]
  );

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      {/* Search bar - compact, always visible */}
      <div className="px-2 pt-3 pb-2">
        <SmartSearchBar
          onSearch={handleSearch}
          loading={false}
          hasResults={true}
          buscasRecentes={EMPTY_BUSCAS}
        />
      </div>

      {/* Filter chips */}
      <div className="px-2 pb-2">
        <FilterChipsBidirectional />
      </div>

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between px-2 pb-2 gap-2">
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

      {/* Virtualized question list */}
      <div className="flex-1 min-h-0 px-2">
        <VirtualizedQuestionList />
      </div>
    </div>
  );
}
