'use client';
import { useMemo, useState } from 'react';
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
  const { data: materias, isLoading } = useMaterias();
  const [q, setQ] = useState('');

  const materiaInfo = useMemo(
    () => materias?.find((m) => m.nome === props.materia),
    [materias, props.materia],
  );

  // Modo 1: sem matéria → lista de matérias
  if (!props.materia) {
    const items = (materias || []).map((m) => ({
      id: m.nome,
      label: m.nome,
      count: m.total_questoes_classificadas,
    }));
    const filtered = !q.trim()
      ? items
      : items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

    return (
      <div className="flex flex-col gap-3 p-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">Matérias e assuntos</h2>
          <p className="text-xs text-slate-500">
            {items.length} matérias · clique para abrir
          </p>
        </header>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar matéria…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        {isLoading ? (
          <div className="text-sm text-slate-400 px-2 py-4">Carregando matérias…</div>
        ) : (
          <FilterAlphabeticList
            items={filtered}
            renderItem={(item) => (
              <button
                type="button"
                onClick={() => props.onMateriaChange(item.id)}
                className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded text-left"
              >
                <span className="text-sm text-blue-700">{item.label}</span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {item.count?.toLocaleString('pt-BR') ?? ''}
                </span>
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
