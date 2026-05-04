'use client';
import { useMemo } from 'react';
import type { AppliedFilters } from '@/lib/questoes/filter-serialization';
import { countActiveFilters, hasAnyFilter } from '@/lib/questoes/filter-serialization';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useMaterias, type Materia } from '@/hooks/useMaterias';
import { useTaxonomia, flattenTree } from '@/hooks/useTaxonomia';
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

interface MateriaTaxonomiaItemsProps {
  slug: string;
  nodeIds: (number | 'outros')[];
  onRemove: (id: number | 'outros') => void;
}

/**
 * Renderiza os nodeIds da taxonomia da matéria (slug) com seus labels.
 * 'outros' renderiza como "Não classificados". IDs não encontrados na árvore
 * caem em fallback `#<id>`.
 */
function MateriaTaxonomiaItems({ slug, nodeIds, onRemove }: MateriaTaxonomiaItemsProps) {
  const { data } = useTaxonomia(slug);
  const labelMap = useMemo(() => {
    if (!data?.tree) return new Map<number | string, string>();
    const flat = flattenTree(data.tree);
    return new Map(flat.map((n) => [n.id, n.nome]));
  }, [data]);

  if (nodeIds.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5">
      {nodeIds.map((id) => {
        const label =
          id === 'outros'
            ? 'Não classificados'
            : (labelMap.get(id) ?? `#${id}`);
        return (
          <li
            key={String(id)}
            className="group flex items-center justify-between gap-2 pl-3 py-0.5 border-l-2 border-blue-400"
          >
            <span className="text-sm text-slate-700 truncate">{label}</span>
            <button
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`remover ${label}`}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 px-1 leading-none transition-opacity"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
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

  // useMaterias retorna apenas matérias COM taxonomia. Usamos pra mapear
  // nome → slug e detectar quais matérias selecionadas têm taxonomia.
  const { data: materiasComTaxonomia } = useMaterias();
  const materiasTaxMap = useMemo(() => {
    const map = new Map<string, Materia>();
    for (const m of materiasComTaxonomia ?? []) {
      if (m.total_nodes > 0) map.set(m.nome, m);
    }
    return map;
  }, [materiasComTaxonomia]);

  return (
    <div className="flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: '#F7F5F3' }}>
      {/* Header vazio — só pra alinhar a borda inferior com o header dos
          pickers da esquerda (min-h-[72px] + border-b). */}
      <div className="min-h-[72px] border-b border-slate-200 shrink-0" />

      {/* Body: label da seção + grupos OU empty state */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <div className="flex items-center justify-between pt-1 pb-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            FILTROS ATIVOS · {aplicadosCount}
          </span>
          <CarregarLink />
        </div>
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
              const materiaTax = materiasTaxMap.get(materia);
              const hasTaxonomia = !!materiaTax;
              const nodeIds = pendentes.nodeIds ?? [];

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
                        // Se a matéria removida tem taxonomia e era a única
                        // com taxonomia entre as selecionadas, limpa nodeIds.
                        // Pragmático: hoje só Direito Adm tem taxonomia.
                        const remainingHasTax = nextMaterias.some((m) =>
                          materiasTaxMap.has(m),
                        );
                        const patch: Partial<AppliedFilters> = {
                          materias: nextMaterias,
                          assuntos: nextAssuntos,
                        };
                        if (hasTaxonomia && !remainingHasTax) {
                          patch.nodeIds = [];
                        }
                        onChange(patch);
                      }}
                      aria-label={`limpar matéria ${materia}`}
                      className="text-slate-400 hover:text-slate-600 px-1 leading-none"
                    >
                      ✕
                    </button>
                  </div>
                  {assuntosDaMateria.length === 0 && !(hasTaxonomia && nodeIds.length > 0) ? (
                    <span className="text-xs text-slate-400 italic px-3">
                      todos os assuntos
                    </span>
                  ) : (
                    <>
                      {assuntosDaMateria.length > 0 && (
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
                      {hasTaxonomia && nodeIds.length > 0 && materiaTax && (
                        <MateriaTaxonomiaItems
                          slug={materiaTax.slug}
                          nodeIds={nodeIds}
                          onRemove={(id) => {
                            onChange({
                              nodeIds: nodeIds.filter((v) => v !== id),
                            });
                          }}
                        />
                      )}
                    </>
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
        <div
          className="text-[34px] text-slate-900 leading-none"
          style={{
            fontFamily: "'Literata', 'Source Serif 4', Georgia, serif",
            fontWeight: 700,
            letterSpacing: '-0.035em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCount(count)}
        </div>
        <div className="text-xs text-slate-400 mt-1.5">{countLabel}</div>
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
