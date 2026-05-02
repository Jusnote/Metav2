'use client';
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChipKey } from './QuestoesFilterChipStrip';
import { BancaPicker } from './pickers/BancaPicker';
import { AnoPicker } from './pickers/AnoPicker';
import { MateriaAssuntosPicker } from './pickers/MateriaAssuntosPicker';
import { OrgaoCargoPicker } from './pickers/OrgaoCargoPicker';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';
import { useOrgaoCargoState } from '@/hooks/useOrgaoCargoState';
import { stateToBackendFilters } from '@/lib/questoes/orgao-cargo-serialization';

export interface QuestoesFilterPickerProps {
  activeChip: ChipKey;
}

function MateriaAssuntosPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();

  const materia = pendentes.materias[0] ?? null;

  return (
    <div data-testid="picker-materia-assuntos">
      <MateriaAssuntosPicker
        dicionario={dicionario ?? null}
        materia={materia}
        selectedAssuntos={pendentes.assuntos}
        selectedNodeIds={pendentes.nodeIds ?? []}
        onMateriaChange={(m) =>
          setPendentes({
            ...pendentes,
            materias: m ? [m] : [],
            assuntos: [],
            nodeIds: [],
          })
        }
        onAssuntosChange={(next) =>
          setPendentes({ ...pendentes, assuntos: next })
        }
        onNodeIdsChange={(next) =>
          setPendentes({ ...pendentes, nodeIds: next })
        }
      />
    </div>
  );
}

function BancaPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets(pendentes);

  return (
    <div data-testid="picker-banca">
      <BancaPicker
        dicionario={dicionario ?? null}
        facets={facets.banca}
        selected={pendentes.bancas}
        onChange={(next) => setPendentes({ ...pendentes, bancas: next })}
      />
    </div>
  );
}

function OrgaoCargoPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { state, actions } = useOrgaoCargoState();
  const [drilldownOrgao, setDrilldownOrgao] = useState<string | null>(null);

  // Backend filters do estado local do picker
  const orgaoCargoBackend = stateToBackendFilters(state);

  // Override durante drilldown: força orgaos pra só o órgão drilled
  // pra que facets de cargo venham filtrados àquele órgão
  const filtersForFacets = {
    ...pendentes,
    orgaos: drilldownOrgao ? [drilldownOrgao] : orgaoCargoBackend.orgaos,
    cargos: orgaoCargoBackend.cargos,
    org_cargo_pairs: orgaoCargoBackend.org_cargo_pairs,
  };

  const { facets } = useQuestoesFacets(filtersForFacets);

  // Sincroniza state local → pendentes (apenas saída — picker é dono do state)
  useEffect(() => {
    const backend = stateToBackendFilters(state);
    setPendentes({
      ...pendentes,
      orgaos: backend.orgaos,
      cargos: backend.cargos,
      org_cargo_pairs: backend.org_cargo_pairs,
    });
    // pendentes intencionalmente fora das deps — set baseado em state interno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div data-testid="picker-orgao-cargo">
      <OrgaoCargoPicker
        dicionario={dicionario ?? null}
        state={state}
        actions={actions}
        facetsCargo={facets.cargo ?? {}}
        drilldownOrgaoTotalCount={
          drilldownOrgao ? facets.orgao?.[drilldownOrgao] : undefined
        }
        onDrilldownChange={setDrilldownOrgao}
      />
    </div>
  );
}

function AnoPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets(pendentes);

  return (
    <div data-testid="picker-ano">
      <AnoPicker
        dicionario={dicionario ?? null}
        facets={facets.ano}
        selected={pendentes.anos}
        onChange={(next) => setPendentes({ ...pendentes, anos: next })}
      />
    </div>
  );
}

export function QuestoesFilterPicker({ activeChip }: QuestoesFilterPickerProps) {
  let content: React.ReactNode;
  switch (activeChip) {
    case 'materia_assuntos':
      content = <MateriaAssuntosPickerAdapter />;
      break;
    case 'banca':
      content = <BancaPickerAdapter />;
      break;
    case 'orgao_cargo':
      content = <OrgaoCargoPickerAdapter />;
      break;
    case 'ano':
      content = <AnoPickerAdapter />;
      break;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeChip}
        data-testid="picker-fade-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
