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

/** Sparkline mock — 7 pontos com tendência ascendente em verde. */
function Sparkline() {
  const points = [8, 12, 10, 18, 16, 22, 28];
  const max = Math.max(...points);
  const w = 80;
  const h = 28;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - (p / max) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="#22c55e"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(points.length - 1) * stepX}
        cy={h - (points[points.length - 1] / max) * h}
        r={2}
        fill="#22c55e"
      />
    </svg>
  );
}

const cardGlass =
  'bg-white border border-slate-200/70 rounded-xl shadow-[0_10px_30px_-10px_rgba(30,41,59,0.10),0_2px_8px_-2px_rgba(30,41,59,0.04)]';

const cardMuted =
  'bg-slate-50 border border-slate-200/70 rounded-xl shadow-[0_10px_30px_-10px_rgba(30,41,59,0.10),0_2px_8px_-2px_rgba(30,41,59,0.04)]';

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

  const { data: materiasComTaxonomia } = useMaterias();
  const materiasTaxMap = useMemo(() => {
    const map = new Map<string, Materia>();
    for (const m of materiasComTaxonomia ?? []) {
      if (m.total_nodes > 0) map.set(m.nome, m);
    }
    return map;
  }, [materiasComTaxonomia]);

  return (
    <div className="flex flex-col gap-3 min-h-0">

      {/* Card 1 — FILTROS ATIVOS */}
      <section className={`${cardMuted} flex flex-col min-h-0 overflow-hidden flex-1`}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            FILTROS ATIVOS · {aplicadosCount}
          </span>
          <CarregarLink />
        </div>
        <div className="flex-1 overflow-auto px-4 pb-4">
          {pendentesEmpty ? (
            <QuestoesFilterEmptyState />
          ) : (
            <>
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
      </section>

      {/* Card 2 — Stats (dark navy) */}
      <section
        className="rounded-xl border border-white/5 shadow-[0_10px_30px_-10px_rgba(30,41,59,0.20)] overflow-hidden text-white"
        style={{ background: 'linear-gradient(180deg,#0e1530 0%, #0a0e1a 100%)' }}
      >
        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <div
              className="text-[34px] leading-none"
              style={{
                fontFamily: "'Literata', 'Source Serif 4', Georgia, serif",
                fontWeight: 700,
                letterSpacing: '-0.035em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCount(count)}
            </div>
            <div className="text-xs text-white/50 mt-1.5">{countLabel}</div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-2">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-emerald-400 leading-none">+12.459</span>
              <span className="text-[11px] text-white/50 mt-1">novas questões esta semana</span>
            </div>
            <Sparkline />
          </div>
        </div>
      </section>

      {/* Card 3 — Visibility toggles + Apply */}
      <section className={`${cardGlass} flex flex-col`}>
        <VisibilityTogglesPanel pendentes={pendentes} onChange={onChange} />
        <div className="px-4 pb-4">
          <ApplyFiltersButton isDirty={isDirty} count={count} onClick={onApply} />
        </div>
      </section>

    </div>
  );
}
