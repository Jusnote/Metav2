'use client';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { countActiveFilters, hasAnyFilter } from '@/lib/questoes/filter-serialization';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { ActiveFiltersGroup } from './ActiveFiltersGroup';
import { CarregarLink } from './CarregarLink';
import { QuestoesFilterEmptyState } from './QuestoesFilterEmptyState';
import { VisibilityTogglesPanel } from './VisibilityTogglesPanel';
import { ApplyFiltersButton } from './ApplyFiltersButton';

const FLAT_GROUP_CONFIG: Array<{
  key: keyof AppliedFilters;
  label: string;
}> = [
  { key: 'bancas', label: 'BANCA' },
  { key: 'orgaos', label: 'ÓRGÃO' },
  { key: 'cargos', label: 'CARGO' },
  { key: 'anos', label: 'ANO' },
];

function formatCount(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('pt-BR');
}

/** Retorna os assuntos selecionados que pertencem à matéria informada. */
export function getAssuntosForMateria(
  materia: string,
  allAssuntos: string[],
  dicionario: FiltrosDicionario | null,
): string[] {
  if (!dicionario) return [];
  const materiaAssuntos = dicionario.materia_assuntos[materia] ?? [];
  return allAssuntos.filter((a) => materiaAssuntos.includes(a));
}

export interface QuestoesActiveFiltersPanelProps {
  pendentes: AppliedFilters;
  aplicados: AppliedFilters;
  isDirty: boolean;
  count: number | null;
  onApply: () => void;
  onChange: (patch: Partial<AppliedFilters>) => void;
  dicionario: FiltrosDicionario | null;
}

export function QuestoesActiveFiltersPanel({
  pendentes,
  aplicados,
  isDirty,
  count,
  onApply,
  onChange,
  dicionario,
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
          <>
            {/* Grupos por matéria */}
            {pendentes.materias.map((materia) => {
              const assuntosDaMateria = getAssuntosForMateria(
                materia,
                pendentes.assuntos,
                dicionario,
              );

              return (
                <div key={`materia-${materia}`} className="flex flex-col gap-1 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                      MATÉRIA: {materia}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMaterias = pendentes.materias.filter((m) => m !== materia);
                        const nextAssuntos = pendentes.assuntos.filter(
                          (a) => !assuntosDaMateria.includes(a),
                        );
                        onChange({
                          materias: nextMaterias,
                          assuntos: nextAssuntos,
                        });
                      }}
                      aria-label={`limpar matéria ${materia}`}
                      className="text-slate-400 hover:text-slate-600 px-1 leading-none"
                    >
                      ✕
                    </button>
                  </div>
                  {assuntosDaMateria.length === 0 ? (
                    <span className="text-xs text-slate-400 italic px-3">
                      todos os assuntos
                    </span>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {assuntosDaMateria.map((assunto) => (
                        <li
                          key={assunto}
                          className="group flex items-center justify-between gap-2 pl-3 py-0.5 border-l-2 border-amber-400"
                        >
                          <span className="text-sm text-slate-700 truncate">{assunto}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextAssuntos = pendentes.assuntos.filter(
                                (a) => a !== assunto,
                              );
                              onChange({ assuntos: nextAssuntos });
                            }}
                            aria-label={`remover ${assunto}`}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 px-1 leading-none transition-opacity"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {/* Grupos flat (banca, órgão, cargo, ano) */}
            {FLAT_GROUP_CONFIG.map((cfg) => {
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
            })}
          </>
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
