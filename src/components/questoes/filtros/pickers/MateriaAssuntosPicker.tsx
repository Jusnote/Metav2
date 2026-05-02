'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder } from 'lucide-react';
import { FilterAlphabeticList } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import { TaxonomiaTreePicker } from '@/components/questoes/TaxonomiaTreePicker';
import { useMaterias } from '@/hooks/useMaterias';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

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
      <div className="flex flex-col gap-3 p-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Matérias e assuntos</h2>
            <p className="text-xs text-slate-500">
              {hydrated && props.dicionario
                ? `${items.length} matérias · clique nas pastas para abrir os assuntos`
                : 'Carregando matérias…'}
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
        <input
          ref={searchInputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar matéria ou assunto…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        {!hydrated || todasMaterias.length === 0 ? (
          <div className="text-sm text-slate-400 px-2 py-4">Carregando matérias…</div>
        ) : (
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => {
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
                <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded">
                  <button
                    type="button"
                    onClick={() => props.onMateriaChange(item.id)}
                    className="flex flex-1 items-center gap-2 min-w-0 text-left"
                  >
                    <Folder size={14} strokeWidth={2} className="text-amber-600 shrink-0" aria-hidden />
                    <span className="text-sm text-blue-700 truncate">{item.label}</span>
                  </button>
                  {isSelected && (
                    <span className="text-xs text-emerald-600 shrink-0 px-2">
                      {totalSpecific === 0
                        ? '✓ Todo o conteúdo'
                        : `✓ ${totalSpecific} ${totalSpecific === 1 ? 'assunto' : 'assuntos'}`}
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
            }}
          />
        )}
      </div>
    );
  }

  // Toggle umbrella — texto azul elegante, sem caixa.
  const renderUmbrellaToggle = () => (
    <button
      type="button"
      onClick={props.onUmbrellaToggle}
      aria-pressed={!!props.isUmbrella}
      className={[
        'flex items-center gap-2 text-sm text-left transition-colors py-1 px-1 -mx-1 rounded',
        props.isUmbrella
          ? 'text-blue-700 font-medium'
          : 'text-blue-600 hover:text-blue-700',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded border text-[10px] leading-none transition-colors',
          props.isUmbrella
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'border-blue-300',
        ].join(' ')}
      >
        {props.isUmbrella && '✓'}
      </span>
      Todo o conteúdo de {props.materia}
    </button>
  );

  // Modo 2: matéria com taxonomia → wrapper TreePicker
  if (materiaInfo && materiaInfo.total_nodes > 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <header className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => props.onMateriaChange(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              ← Voltar para matérias
            </button>
            <h2 className="text-lg font-semibold text-slate-900 mt-1">{materiaInfo.nome}</h2>
            <p className="text-xs text-slate-500">
              {materiaInfo.total_nodes} tópicos · taxonomia GRAN
            </p>
          </div>
        </header>
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
    <div className="flex flex-col gap-3 p-4">
      <header>
        <button
          type="button"
          onClick={() => props.onMateriaChange(null)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Voltar para matérias
        </button>
        <h2 className="text-lg font-semibold text-slate-900 mt-1">{props.materia}</h2>
        <p className="text-xs text-slate-500">{items.length} assuntos · lista plana</p>
      </header>
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
  );
}
