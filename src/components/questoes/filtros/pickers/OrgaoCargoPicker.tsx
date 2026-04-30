'use client';
import { useMemo, useState } from 'react';
import { FilterAlphabeticList, FilterRecentesBlock } from '@/components/questoes/filtros/shared';
import { FilterCheckboxItemWithCount } from '@/components/questoes/filtros/shared/FilterCheckboxItemWithCount';
import { useFiltroRecentes } from '@/hooks/useFiltroRecentes';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

export interface OrgaoCargoPickerProps {
  dicionario: FiltrosDicionario | null;
  facetsOrgao?: Record<string, number>;
  facetsCargo?: Record<string, number>;
  selectedOrgaos: string[];
  selectedCargos: string[];
  onChangeOrgaos: (next: string[]) => void;
  onChangeCargos: (next: string[]) => void;
}

export function OrgaoCargoPicker(props: OrgaoCargoPickerProps) {
  const [q, setQ] = useState('');
  const recOrgao = useFiltroRecentes('orgao');
  const recCargo = useFiltroRecentes('cargo');

  const orgaos = useMemo(() => {
    if (!props.dicionario) return [];
    const u = [...new Set(Object.values(props.dicionario.orgaos))].sort();
    return u.map((v) => ({ id: v, label: v }));
  }, [props.dicionario]);

  const cargos = useMemo(() => {
    if (!props.dicionario) return [];
    const u = [...new Set(Object.values(props.dicionario.cargos))].sort();
    return u.map((v) => ({ id: v, label: v }));
  }, [props.dicionario]);

  const filterFn = (list: { id: string; label: string }[]) =>
    !q.trim() ? list : list.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  const toggleOrgao = (v: string) => {
    const isSel = props.selectedOrgaos.includes(v);
    const next = isSel ? props.selectedOrgaos.filter((x) => x !== v) : [...props.selectedOrgaos, v];
    props.onChangeOrgaos(next);
    if (!isSel) recOrgao.push({ value: v, label: v });
  };

  const toggleCargo = (v: string) => {
    const isSel = props.selectedCargos.includes(v);
    const next = isSel ? props.selectedCargos.filter((x) => x !== v) : [...props.selectedCargos, v];
    props.onChangeCargos(next);
    if (!isSel) recCargo.push({ value: v, label: v });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Órgãos e cargos</h2>
        <p className="text-xs text-slate-500">
          {orgaos.length} órgãos · {cargos.length} cargos
        </p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar órgão ou cargo…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Órgãos
        </h3>
        {!q && recOrgao.items.length > 0 && (
          <FilterRecentesBlock
            items={recOrgao.items}
            renderItem={(r) => (
              <button
                key={r.value}
                onClick={() => toggleOrgao(r.value)}
                className="text-left text-sm text-blue-700 hover:underline"
                type="button"
              >
                {r.label}
              </button>
            )}
          />
        )}
        <FilterAlphabeticList
          items={filterFn(orgaos)}
          renderItem={(i) => (
            <FilterCheckboxItemWithCount
              label={i.label}
              checked={props.selectedOrgaos.includes(i.id)}
              onToggle={() => toggleOrgao(i.id)}
              count={props.facetsOrgao?.[i.id]}
            />
          )}
        />
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Cargos
        </h3>
        {!q && recCargo.items.length > 0 && (
          <FilterRecentesBlock
            items={recCargo.items}
            renderItem={(r) => (
              <button
                key={r.value}
                onClick={() => toggleCargo(r.value)}
                className="text-left text-sm text-blue-700 hover:underline"
                type="button"
              >
                {r.label}
              </button>
            )}
          />
        )}
        <FilterAlphabeticList
          items={filterFn(cargos)}
          renderItem={(i) => (
            <FilterCheckboxItemWithCount
              label={i.label}
              checked={props.selectedCargos.includes(i.id)}
              onToggle={() => toggleCargo(i.id)}
              count={props.facetsCargo?.[i.id]}
            />
          )}
        />
      </section>
    </div>
  );
}
