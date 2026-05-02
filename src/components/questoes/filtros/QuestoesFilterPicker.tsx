'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  backendToState,
  stateToBackendFilters,
} from '@/lib/questoes/orgao-cargo-serialization';

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

// LIMITATION: Once mounted, this adapter does not react to external mutations
// of pendentes.orgaos/cargos/org_cargo_pairs (e.g., × from applied-filters
// panel). Re-keying the adapter would cause a write-loop because the adapter
// itself writes to pendentes. Re-hydration on external clear is deferred —
// users who clear órgão/cargo from the chips list must close and reopen the
// chip to see the reset reflected here.
function OrgaoCargoPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();

  // Hidrata state local a partir de pendentes no mount (one-shot — useReducer
  // ignora mudanças subsequentes deste initializer). Re-hidratação em mudanças
  // externas é tratada pelo pai re-keyando o adapter (não implementado — ver
  // bloco LIMITATION acima).
  const initialState = useMemo(
    () =>
      backendToState({
        orgaos: pendentes.orgaos,
        cargos: pendentes.cargos,
        org_cargo_pairs: pendentes.org_cargo_pairs,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // intencional: initializer capturado uma vez no mount
  );

  const { state, actions } = useOrgaoCargoState(initialState);
  const [drilldownOrgao, setDrilldownOrgao] = useState<string | null>(null);

  // Backend filters do estado local do picker
  const orgaoCargoBackend = useMemo(() => stateToBackendFilters(state), [state]);

  // Override durante drilldown: força orgaos pra só o órgão drilled
  // pra que facets de cargo venham filtrados àquele órgão
  const filtersForFacets = useMemo(
    () => ({
      ...pendentes,
      orgaos: drilldownOrgao ? [drilldownOrgao] : orgaoCargoBackend.orgaos,
      cargos: orgaoCargoBackend.cargos,
      org_cargo_pairs: orgaoCargoBackend.org_cargo_pairs,
    }),
    [pendentes, drilldownOrgao, orgaoCargoBackend],
  );

  const { facets } = useQuestoesFacets(filtersForFacets);

  // Skip first run (hydration já aconteceu via initializer). Em mudanças
  // subsequentes do state, escreve em pendentes.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setPendentes({
      ...pendentes,
      orgaos: orgaoCargoBackend.orgaos,
      cargos: orgaoCargoBackend.cargos,
      org_cargo_pairs: orgaoCargoBackend.org_cargo_pairs,
    });
    // pendentes intencionalmente fora das deps — set baseado em state interno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgaoCargoBackend]);

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
