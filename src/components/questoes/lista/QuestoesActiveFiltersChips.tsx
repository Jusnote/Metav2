import { ArrowLeft } from 'lucide-react';
import { useQuestoesContext } from '@/contexts/QuestoesContext';
import { Button } from '@/components/ui/button';

interface QuestoesActiveFiltersChipsProps {
  onEditFilters: () => void;
}

interface ChipGroup {
  label: string;
  values: string[];
}

export function QuestoesActiveFiltersChips({ onEditFilters }: QuestoesActiveFiltersChipsProps) {
  const { committedFilters, committedQuery } = useQuestoesContext();

  const groups: ChipGroup[] = [
    { label: 'Banca', values: committedFilters.bancas ?? [] },
    { label: 'Ano', values: (committedFilters.anos ?? []).map(String) },
    { label: 'Matéria', values: committedFilters.materias ?? [] },
    { label: 'Assunto', values: committedFilters.assuntos ?? [] },
    { label: 'Órgão', values: committedFilters.orgaos ?? [] },
    { label: 'Cargo', values: committedFilters.cargos ?? [] },
  ].filter((g) => g.values.length > 0);

  const totalChips = groups.reduce((sum, g) => sum + g.values.length, 0);
  const hasAny = totalChips > 0 || (committedQuery && committedQuery.trim().length > 0);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#f1f5f9]">
      <Button
        variant="outline"
        size="sm"
        onClick={onEditFilters}
        className="shrink-0 h-8 gap-1.5 text-xs"
      >
        <ArrowLeft className="h-3 w-3" />
        Editar filtros
      </Button>

      {hasAny ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 pt-1">
          {committedQuery && committedQuery.trim().length > 0 && (
            <span className="text-xs text-slate-600">
              <span className="text-slate-400 mr-1">Busca:</span>
              <span className="font-medium text-slate-800">"{committedQuery}"</span>
            </span>
          )}
          {groups.map((g) => (
            <span key={g.label} className="text-xs text-slate-600">
              <span className="text-slate-400 mr-1">{g.label}:</span>
              <span className="font-medium text-slate-800">{g.values.join(', ')}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-slate-400 pt-1.5">Nenhum filtro aplicado</span>
      )}
    </div>
  );
}
