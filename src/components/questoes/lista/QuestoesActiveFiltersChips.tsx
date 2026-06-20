import { ArrowLeft, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useQuestoesContext } from '@/contexts/QuestoesContext';
import { useQuestoesFilterDraft } from '@/contexts/QuestoesFilterDraftContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface QuestoesActiveFiltersChipsProps {
  onEditFilters: () => void;
}

interface ChipGroup {
  label: string;
  values: string[];
}

export function QuestoesActiveFiltersChips({ onEditFilters }: QuestoesActiveFiltersChipsProps) {
  const { committedQuery } = useQuestoesContext();
  const { aplicados } = useQuestoesFilterDraft();

  const groups: ChipGroup[] = [
    { label: 'Banca', values: aplicados.bancas ?? [] },
    { label: 'Ano', values: (aplicados.anos ?? []).map(String) },
    { label: 'Matéria', values: aplicados.materias ?? [] },
    { label: 'Assunto', values: aplicados.assuntos ?? [] },
    { label: 'Órgão', values: aplicados.orgaos ?? [] },
    { label: 'Cargo', values: aplicados.cargos ?? [] },
  ].filter((g) => g.values.length > 0);

  const hasQuery = !!(committedQuery && committedQuery.trim().length > 0);
  const totalChips = groups.reduce((sum, g) => sum + g.values.length, 0);
  const count = totalChips + (hasQuery ? 1 : 0);
  const hasAny = count > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-white/60 text-xs text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {hasAny && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 text-white text-[10px] font-semibold tabular-nums">
              {count}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-slate-700">Filtros aplicados</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onEditFilters}
            className="h-7 gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3 w-3" />
            Editar
          </Button>
        </div>

        {hasAny ? (
          <div className="flex flex-col gap-1.5">
            {hasQuery && (
              <div className="text-xs text-slate-600">
                <span className="text-slate-400 mr-1">Busca:</span>
                <span className="font-medium text-slate-800">"{committedQuery}"</span>
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label} className="text-xs text-slate-600">
                <span className="text-slate-400 mr-1">{g.label}:</span>
                <span className="font-medium text-slate-800">{g.values.join(', ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Nenhum filtro aplicado</span>
        )}
      </PopoverContent>
    </Popover>
  );
}
