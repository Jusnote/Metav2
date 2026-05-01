'use client';
import { useState } from 'react';
import { OrgaoListView } from './orgao-cargo/OrgaoListView';
import { OrgaoDrilldownView } from './orgao-cargo/OrgaoDrilldownView';
import { CargoFlatSearchView } from './orgao-cargo/CargoFlatSearchView';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import type { OrgaoCargoState, OrgaoCargoActions } from '@/hooks/useOrgaoCargoState';

type ViewMode = 'list' | { type: 'drilldown'; orgao: string } | 'flat-search';

export interface OrgaoCargoPickerProps {
  dicionario: FiltrosDicionario | null;
  state: OrgaoCargoState;
  actions: OrgaoCargoActions;
  /** Facets de cargo CONTEXTUAL — quando há órgão drilled, deve refletir só cargos daquele órgão */
  facetsCargo: Record<string, number>;
  /** Total de questões do órgão drilled (vindo de facets.orgao[orgao_atual]) */
  drilldownOrgaoTotalCount?: number;
}

export function OrgaoCargoPicker({
  dicionario,
  state,
  actions,
  facetsCargo,
  drilldownOrgaoTotalCount,
}: OrgaoCargoPickerProps) {
  const [view, setView] = useState<ViewMode>('list');

  if (view === 'list') {
    return (
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={state.orgaos}
        onSelectOrgao={(orgao) => setView({ type: 'drilldown', orgao })}
        onOpenFlatSearch={() => setView('flat-search')}
      />
    );
  }

  if (view === 'flat-search') {
    return (
      <CargoFlatSearchView
        dicionario={dicionario}
        flatCargosSelecionados={state.flatCargos}
        facetsCargo={facetsCargo}
        onToggleFlatCargo={(cargo) => {
          if (state.flatCargos.includes(cargo)) actions.removeFlatCargo(cargo);
          else actions.addFlatCargo(cargo);
        }}
        onBack={() => setView('list')}
      />
    );
  }

  // Drilldown
  return (
    <OrgaoDrilldownView
      orgao={view.orgao}
      availableCargos={facetsCargo}
      selection={state.orgaos.get(view.orgao)}
      totalCount={drilldownOrgaoTotalCount}
      onMarkAll={(orgao) => actions.addOrgaoAll(orgao)}
      onTogglePair={(orgao, cargo) => {
        const sel = state.orgaos.get(orgao);
        if (Array.isArray(sel) && sel.includes(cargo)) {
          actions.removePair(orgao, cargo);
        } else {
          actions.addPair(orgao, cargo);
        }
      }}
      onRefineToSpecific={(orgao) => actions.removeOrgao(orgao)}
      onBack={() => setView('list')}
    />
  );
}
