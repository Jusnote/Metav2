'use client';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { countActiveFilters, hasAnyFilter } from '@/lib/questoes/filter-serialization';
import { ActiveFiltersGroup } from './ActiveFiltersGroup';
import { CarregarLink } from './CarregarLink';
import { QuestoesFilterEmptyState } from './QuestoesFilterEmptyState';
import { VisibilityTogglesPanel } from './VisibilityTogglesPanel';
import { ApplyFiltersButton } from './ApplyFiltersButton';

const GROUP_CONFIG: Array<{
  key: keyof AppliedFilters;
  label: string;
}> = [
  { key: 'bancas', label: 'BANCA' },
  { key: 'orgaos', label: 'ÓRGÃO' },
  { key: 'cargos', label: 'CARGO' },
  { key: 'anos', label: 'ANO' },
  { key: 'materias', label: 'MATÉRIA' },
  { key: 'assuntos', label: 'ASSUNTO' },
];

function formatCount(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('pt-BR');
}

export interface QuestoesActiveFiltersPanelProps {
  pendentes: AppliedFilters;
  aplicados: AppliedFilters;
  isDirty: boolean;
  count: number | null;
  onApply: () => void;
  onChange: (patch: Partial<AppliedFilters>) => void;
}

export function QuestoesActiveFiltersPanel({
  pendentes,
  aplicados,
  isDirty,
  count,
  onApply,
  onChange,
}: QuestoesActiveFiltersPanelProps) {
  const aplicadosCount = countActiveFilters(aplicados);
  const pendentesEmpty = !hasAnyFilter(pendentes);
  const countLabel = pendentesEmpty ? 'total no banco' : 'questões encontradas';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          FILTROS ATIVOS · {aplicadosCount}
        </span>
        <CarregarLink />
      </div>

      {/* Body: grupos OU empty state */}
      <div className="flex-1 overflow-auto px-4 py-2">
        {pendentesEmpty ? (
          <QuestoesFilterEmptyState />
        ) : (
          GROUP_CONFIG.map((cfg) => {
            const items = (pendentes[cfg.key] as (string | number)[] | undefined) ?? [];
            return (
              <ActiveFiltersGroup
                key={cfg.key}
                label={cfg.label}
                items={items.map(String)}
                onClearGroup={() => onChange({ [cfg.key]: [] } as Partial<AppliedFilters>)}
                onRemoveItem={(value) => {
                  const next = items.filter((v) => String(v) !== value);
                  onChange({ [cfg.key]: next } as Partial<AppliedFilters>);
                }}
              />
            );
          })
        )}
      </div>

      {/* Count grande */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="text-[36px] font-semibold text-slate-900 leading-none">
          {formatCount(count)}
        </div>
        <div className="text-xs text-slate-400 mt-1">{countLabel}</div>
      </div>

      {/* Toggles */}
      <VisibilityTogglesPanel pendentes={pendentes} onChange={onChange} />

      {/* Aplicar */}
      <div className="px-4 pb-4">
        <ApplyFiltersButton isDirty={isDirty} count={count} onClick={onApply} />
      </div>
    </div>
  );
}
