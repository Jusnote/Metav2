import { useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronDown, List, Square } from 'lucide-react';
import { useQuestoesContext } from '@/contexts/QuestoesContext';
import type { StatusTab, SortOption, ViewMode } from '@/contexts/QuestoesContext';
import { QuestoesResultsHeader } from '@/components/questoes/QuestoesResultsHeader';
import { VirtualizedQuestionList } from '@/components/questoes/VirtualizedQuestionList';
import { QuestoesActiveFiltersChips } from './QuestoesActiveFiltersChips';

const SORT_LABELS: Record<SortOption, string> = {
  recentes: 'Mais recentes',
  dificuldade: 'Mais dificeis',
  menos_resolvidas: 'Menos resolvidas',
  relevancia: 'Relevancia IA',
};

const TAB_LABELS: Record<StatusTab, string> = {
  todas: 'Todas',
  nao_resolvidas: 'Nao resolvidas',
  erradas: 'Erradas',
  marcadas: 'Marcadas',
};

const SORT_KEY = 'questoes:sortBy';
const VIEW_KEY = 'questoes:viewMode';

interface QuestoesListaViewProps {
  onEditFilters: () => void;
}

export function QuestoesListaView({ onEditFilters }: QuestoesListaViewProps) {
  const { statusTab, setStatusTab, sortBy, setSortBy, viewMode, setViewMode } = useQuestoesContext();

  // Hidratar sort/view do localStorage na 1ª montagem
  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(SORT_KEY) as SortOption | null;
      if (savedSort && SORT_LABELS[savedSort]) setSortBy(savedSort);
      const savedView = localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (savedView === 'lista' || savedView === 'individual') setViewMode(savedView);
    } catch {
      // localStorage indisponível — ignora
    }
  }, [setSortBy, setViewMode]);

  // Persistir sort/view ao mudar
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sortBy);
    } catch {
      // ignora
    }
  }, [sortBy]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      // ignora
    }
  }, [viewMode]);

  return (
    <div className="flex flex-col gap-2">
      <QuestoesActiveFiltersChips onEditFilters={onEditFilters} />

      <QuestoesResultsHeader />

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <ArrowUpDown className="h-3 w-3" />
                {SORT_LABELS[sortBy]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
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

      <VirtualizedQuestionList />
    </div>
  );
}
