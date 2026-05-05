'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Folder } from 'lucide-react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import { TaxonomiaTreePicker } from '@/components/questoes/TaxonomiaTreePicker';
import { useMaterias } from '@/hooks/useMaterias';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { groupMateriasByArea } from '@/lib/questoes/materia-areas';

export interface MateriaAssuntosPickerProps {
  dicionario: FiltrosDicionario | null;
  materia: string | null;
  selectedAssuntos: string[];
  selectedNodeIds: (number | 'outros')[];
  /** Lista de matérias atualmente no filtro (qualquer estado: B umbrella ou C específico). */
  selectedMaterias?: string[];
  /** A matéria atualmente em vista está em estado umbrella ("todo o conteúdo")? */
  isUmbrella?: boolean;
  onMateriaChange: (materia: string | null) => void;
  onAssuntosChange: (next: string[]) => void;
  onNodeIdsChange: (next: (number | 'outros')[]) => void;
  /** Toggle umbrella da matéria atualmente em vista. */
  onUmbrellaToggle?: () => void;
  /** Adiciona uma matéria como umbrella diretamente da lista (sem entrar na vista). */
  onUmbrellaAdd?: (materia: string) => void;
}

export function MateriaAssuntosPicker(props: MateriaAssuntosPickerProps) {
  // useMaterias retorna apenas matérias com taxonomia (hoje só Direito Adm).
  // Usamos como source de verdade pra detectar taxonomia + counts, mas a LISTA
  // completa de matérias vem do dicionário (todas as ~107 matérias do app).
  const { data: materiasComTaxonomia } = useMaterias();
  const [q, setQ] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Refs por nome de área pra navegação via TOC do lado esquerdo (Modo 1).
  const areaHeadingRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setHydrated(true);
  }, []);

  const materiaInfo = useMemo(
    () => materiasComTaxonomia?.find((m) => m.nome === props.materia),
    [materiasComTaxonomia, props.materia],
  );

  const selectedMaterias = props.selectedMaterias ?? [];

  // Modo 1: sem matéria → lista completa de matérias do dicionário
  if (!props.materia) {
    const todasMaterias = props.dicionario?.materias ?? [];
    // Map de matérias com taxonomia pra lookup rápido de count
    const taxonomiaMap = new Map(
      (materiasComTaxonomia ?? []).map((m) => [m.nome, m]),
    );
    const items = todasMaterias.map((nome) => {
      const tax = taxonomiaMap.get(nome);
      return {
        id: nome,
        label: nome,
        count: tax?.total_questoes_classificadas,
        hasTaxonomia: tax ? tax.total_nodes > 0 : false,
      };
    });
    const filtered = !q.trim()
      ? items
      : items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="flex items-start justify-between gap-4 px-4 py-3 border-b border-slate-200 min-h-[72px] shrink-0">
          <div className="flex flex-col justify-center">
            <h2
              className="text-lg font-semibold text-slate-900"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                letterSpacing: '-0.01em',
              }}
            >
              Disciplinas e assuntos
            </h2>
            <p className="text-xs text-slate-500">
              {hydrated && props.dicionario
                ? `${items.length} disciplinas · clique nas pastas para abrir os assuntos`
                : 'Carregando disciplinas…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline shrink-0 mt-1"
          >
            Pesquisar por nome →
          </button>
        </header>
        <div className="flex flex-col gap-3 p-4 flex-1 min-h-0 border-r border-slate-200">
        <input
          ref={searchInputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar disciplina ou assunto…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 shrink-0"
        />
        {!hydrated || todasMaterias.length === 0 ? (
          <div className="text-sm text-slate-400 px-2 py-4">Carregando disciplinas…</div>
        ) : (
          (() => {
            const renderItem = (item: typeof filtered[number]) => {
              const isSelected = selectedMaterias.includes(item.id);
              const assuntosDestaMateria =
                props.dicionario?.materia_assuntos[item.id] ?? [];
              const specificAssuntos = props.selectedAssuntos.filter((a) =>
                assuntosDestaMateria.includes(a),
              ).length;
              const specificNodes = item.hasTaxonomia
                ? props.selectedNodeIds.length
                : 0;
              const totalSpecific = specificAssuntos + specificNodes;
              return (
                <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded">
                  <button
                    type="button"
                    onClick={() => props.onMateriaChange(item.id)}
                    title={item.label}
                    className="flex flex-1 items-center gap-2 min-w-0 text-left"
                  >
                    <Folder size={14} strokeWidth={2} className="text-amber-600 shrink-0" aria-hidden />
                    <span
                      className={[
                        'text-sm truncate',
                        isSelected ? 'text-slate-900 font-medium' : 'text-slate-700',
                      ].join(' ')}
                    >
                      {item.label}
                    </span>
                  </button>
                  {isSelected && (
                    <span className="text-xs text-emerald-600 shrink-0 px-2">
                      {totalSpecific === 0
                        ? '✓ Todo o conteúdo'
                        : `✓ ${totalSpecific} ${totalSpecific === 1 ? 'assunto selecionado' : 'assuntos selecionados'}`}
                    </span>
                  )}
                  {item.hasTaxonomia && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                      taxonomia
                    </span>
                  )}
                  {typeof item.count === 'number' && (
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">
                      {item.count.toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              );
            };

            const groups = groupMateriasByArea(filtered);
            // Lista canônica de áreas presentes no resultado (sem subgroup) pro TOC.
            const tocAreas: string[] = [];
            for (const g of groups) {
              if (!tocAreas.includes(g.area)) tocAreas.push(g.area);
            }
            const scrollToArea = (area: string) => {
              areaHeadingRefs.current[area]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            };
            let lastArea: string | null = null;
            return (
              <div className="flex gap-3 flex-1 min-h-0">
                {/* TOC fixa à esquerda */}
                <nav
                  aria-label="Áreas"
                  className="w-32 shrink-0 overflow-y-auto py-1 text-xs"
                >
                  <ul className="flex flex-col gap-0.5">
                    {tocAreas.map((area) => (
                      <li key={area}>
                        <button
                          type="button"
                          onClick={() => scrollToArea(area)}
                          title={area}
                          className="w-full text-left px-2 py-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 truncate transition-colors"
                        >
                          {area}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
                {/* Lista rolável */}
                <div className="flex-1 overflow-y-auto min-w-0">
                  <div className="flex flex-col">
                    {groups.map((g, i) => {
                      const showAreaHeader = g.area !== lastArea;
                      lastArea = g.area;
                      return (
                        <Fragment key={`${g.area}-${g.subgroup ?? ''}-${i}`}>
                          {showAreaHeader && (
                            <div
                              ref={(el) => {
                                areaHeadingRefs.current[g.area] = el;
                              }}
                              className="px-2 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                            >
                              {g.area}
                            </div>
                          )}
                          {g.subgroup && (
                            <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                              {g.subgroup}
                            </div>
                          )}
                          {g.items.map(renderItem)}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()
        )}
        </div>
      </div>
    );
  }

  // Toggle umbrella — azul (clicável) → verde (ativo/marcado), sem caixa,
  // alinhado com os checks dos assuntos abaixo (px-2 + gap-3, igual ao
  // FilterCheckboxItem).
  const renderUmbrellaToggle = () => (
    <button
      type="button"
      onClick={props.onUmbrellaToggle}
      aria-pressed={!!props.isUmbrella}
      className={[
        'flex items-center gap-3 w-full px-2 py-1.5 rounded-md text-sm text-left transition-colors',
        props.isUmbrella
          ? 'text-emerald-700 font-medium'
          : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50/40',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded border text-[10px] leading-none transition-colors shrink-0',
          props.isUmbrella
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : 'border-blue-300',
        ].join(' ')}
      >
        {props.isUmbrella && '✓'}
      </span>
      Todo conteúdo desta matéria
    </button>
  );

  // Modo 2: matéria com taxonomia → wrapper TreePicker
  if (materiaInfo && materiaInfo.total_nodes > 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 min-h-[72px] flex flex-col justify-center shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => props.onMateriaChange(null)}
              aria-label="Voltar para disciplinas"
              title="Voltar para disciplinas"
              className="text-blue-600 hover:text-blue-800 text-lg leading-none shrink-0"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold text-slate-900">{materiaInfo.nome}</h2>
          </div>
          <p className="text-xs text-slate-500">
            {materiaInfo.total_nodes} tópicos · taxonomia GRAN
          </p>
        </header>
        <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto min-h-0 border-r border-slate-200">
        {renderUmbrellaToggle()}
        {props.isUmbrella && (
          <p className="text-xs text-slate-400 italic">
            Todos os assuntos selecionados pela opção acima
          </p>
        )}
        <div className={props.isUmbrella ? 'opacity-50 pointer-events-none' : ''}>
          <TaxonomiaTreePicker
            materiaSlug={materiaInfo.slug}
            selectedIds={props.selectedNodeIds}
            onToggle={(id) => {
              // Pre-flight: TreePicker usa onToggle(id) incremental, não onChange(array).
              // Adapter: converte single-toggle para next-array via add/remove.
              const has = props.selectedNodeIds.includes(id);
              const next = has
                ? props.selectedNodeIds.filter((x) => x !== id)
                : [...props.selectedNodeIds, id];
              props.onNodeIdsChange(next);
            }}
            countsBody={{}}
          />
        </div>
        </div>
      </div>
    );
  }

  // Modo 3: matéria sem taxonomia → fallback flat
  const assuntos = props.dicionario?.materia_assuntos[props.materia] || [];
  const items = assuntos.map((a) => ({ id: a, label: a }));
  const filtered = !q.trim()
    ? items
    : items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (assunto: string) => {
    const isSel = props.selectedAssuntos.includes(assunto);
    const next = isSel
      ? props.selectedAssuntos.filter((v) => v !== assunto)
      : [...props.selectedAssuntos, assunto];
    props.onAssuntosChange(next);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-200 min-h-[72px] flex flex-col justify-center shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => props.onMateriaChange(null)}
            aria-label="Voltar para disciplinas"
            title="Voltar para disciplinas"
            className="text-blue-600 hover:text-blue-800 text-lg leading-none shrink-0"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-slate-900">{props.materia}</h2>
        </div>
        <p className="text-xs text-slate-500">{items.length} assuntos · lista plana</p>
      </header>
      <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto min-h-0 border-r border-slate-200">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar assunto…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        {renderUmbrellaToggle()}
        {props.isUmbrella && (
          <p className="text-xs text-slate-400 italic -mt-1">
            Todos os assuntos selecionados pela opção acima
          </p>
        )}
        <div className={props.isUmbrella ? 'opacity-50 pointer-events-none' : ''}>
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => (
              <FilterCheckboxItemWithCount
                label={item.label}
                checked={props.selectedAssuntos.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
