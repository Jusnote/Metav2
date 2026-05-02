'use client';
import { useMemo, useRef, useState } from 'react';
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
  onMateriaChange: (materia: string | null) => void;
  onAssuntosChange: (next: string[]) => void;
  onNodeIdsChange: (next: (number | 'outros')[]) => void;
}

export function MateriaAssuntosPicker(props: MateriaAssuntosPickerProps) {
  // useMaterias retorna apenas matérias com taxonomia (hoje só Direito Adm).
  // Usamos como source de verdade pra detectar taxonomia + counts, mas a LISTA
  // completa de matérias vem do dicionário (todas as ~107 matérias do app).
  const { data: materiasComTaxonomia } = useMaterias();
  const [q, setQ] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const materiaInfo = useMemo(
    () => materiasComTaxonomia?.find((m) => m.nome === props.materia),
    [materiasComTaxonomia, props.materia],
  );

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
              {props.dicionario
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
        {todasMaterias.length === 0 ? (
          <div className="text-sm text-slate-400 px-2 py-4">Carregando matérias…</div>
        ) : (
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => (
              <button
                type="button"
                onClick={() => props.onMateriaChange(item.id)}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-left"
              >
                <span className="flex flex-1 items-center gap-2 min-w-0">
                  <Folder size={14} strokeWidth={2} className="text-amber-600 shrink-0" aria-hidden />
                  <span className="text-sm text-blue-700 truncate">{item.label}</span>
                </span>
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
              </button>
            )}
          />
        )}
      </div>
    );
  }

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
  );
}
