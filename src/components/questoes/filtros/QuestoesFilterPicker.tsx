'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChipKey } from './QuestoesFilterChipStrip';
import { BancaPicker } from './pickers/BancaPicker';
import { AnoPicker } from './pickers/AnoPicker';
import { MateriaAssuntosPicker } from './pickers/MateriaAssuntosPicker';
import { OrgaoCargoPicker } from './pickers/OrgaoCargoPicker';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useFiltrosDicionario, type FiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';
import { useMaterias } from '@/hooks/useMaterias';
import { useOrgaoCargoState } from '@/hooks/useOrgaoCargoState';
import { useSearchParams } from 'react-router-dom';
import {
  backendToState,
  stateToBackendFilters,
} from '@/lib/questoes/orgao-cargo-serialization';

/** Retorna a matéria à qual um assunto pertence (via dicionário), ou null. */
function getMateriaForAssunto(
  assunto: string,
  dicionario: FiltrosDicionario | null,
): string | null {
  if (!dicionario) return null;
  for (const [materia, assuntos] of Object.entries(dicionario.materia_assuntos)) {
    if (assuntos.includes(assunto)) return materia;
  }
  return null;
}

export interface QuestoesFilterPickerProps {
  activeChip: ChipKey;
}

function MateriaAssuntosPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { data: materiasComTaxonomia } = useMaterias();
  const [urlSearchParams] = useSearchParams();
  // OAB ativo = URL contém ?orgaos=OAB (carreira "Exame de Ordem" selecionada)
  const oabMode = urlSearchParams.getAll('orgaos').includes('OAB');

  // Navegação local (qual matéria está aberta no picker) é separada do
  // filtro aplicado (pendentes.materias). "← Voltar" só fecha a vista,
  // mantém o filtro intacto. × no painel direito limpa o filtro e
  // a navegação acompanha via efeito abaixo.
  const [viewingMateria, setViewingMateria] = useState<string | null>(
    () => pendentes.materias[0] ?? null,
  );

  // Set local que distingue B (umbrella) de C (específico).
  // Init: matérias em pendentes.materias que não têm nenhum assunto
  // específico nem nodeIds são umbrella.
  const [umbrellaMaterias, setUmbrellaMaterias] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const m of pendentes.materias) {
      const assuntosDessaMateria = pendentes.assuntos.filter(
        (a) => getMateriaForAssunto(a, dicionario) === m,
      );
      // Sem dicionário ainda, não dá pra mapear assuntos → matéria.
      // Conservador: só marca umbrella se realmente não tem assuntos selecionados.
      if (assuntosDessaMateria.length === 0) {
        // Para taxonomia: nodeIds vazios → é umbrella
        // (hoje só Direito Adm tem taxonomia)
        const nodeIdsCount = pendentes.nodeIds?.length ?? 0;
        if (nodeIdsCount === 0) {
          set.add(m);
        }
      }
    }
    return set;
  });

  // Helper: matéria é a "dona" de taxonomia quando aparece em useMaterias com total_nodes > 0
  const isMateriaWithTaxonomia = useMemo(() => {
    const set = new Set(
      (materiasComTaxonomia ?? [])
        .filter((m) => m.total_nodes > 0)
        .map((m) => m.nome),
    );
    return (nome: string) => set.has(nome);
  }, [materiasComTaxonomia]);

  // Navegação (viewingMateria) é ortogonal ao filtro (pendentes.materias):
  // o usuário pode estar vendo assuntos de uma matéria mesmo sem ela no filtro.
  // Ex: clica "Todo conteúdo desta matéria" → ON → OFF: deve permanecer no
  // detalhe; antes fechava porque a matéria saía de pendentes.materias e um
  // efeito de sincronia reseta viewingMateria. Saída só via "← Voltar".

  // Sincroniza umbrella set com mudanças externas em pendentes.materias.
  // Se uma matéria saiu de pendentes.materias (× no painel direito ou
  // qualquer outro caminho), remove do umbrella set pra não ficar inconsistente.
  useEffect(() => {
    setUmbrellaMaterias((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const m of prev) {
        if (!pendentes.materias.includes(m)) {
          next.delete(m);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pendentes.materias]);

  const isUmbrella =
    viewingMateria !== null && umbrellaMaterias.has(viewingMateria);

  return (
    <div data-testid="picker-materia-assuntos" className="flex flex-col min-h-0 h-full">
      <MateriaAssuntosPicker
        dicionario={dicionario ?? null}
        materia={viewingMateria}
        selectedAssuntos={pendentes.assuntos}
        selectedNodeIds={pendentes.nodeIds ?? []}
        selectedMaterias={pendentes.materias}
        isUmbrella={isUmbrella}
        oabMode={oabMode}
        onMateriaChange={(m) => {
          // Lazy-add: clicar em matéria SÓ navega para detalhe.
          // Não adiciona ao filtro — filtro só recebe matéria via
          // assunto/nodeId específico ou via "Todo o conteúdo" explícito.
          setViewingMateria(m);
        }}
        onUmbrellaToggle={() => {
          if (!viewingMateria) return;
          if (isUmbrella) {
            // Toggle off: remove do umbrella set + remove da pendentes.materias
            // (não tem itens específicos por definição).
            const nextUmbrella = new Set(umbrellaMaterias);
            nextUmbrella.delete(viewingMateria);
            setUmbrellaMaterias(nextUmbrella);
            setPendentes({
              ...pendentes,
              materias: pendentes.materias.filter((m) => m !== viewingMateria),
            });
          } else {
            // Toggle on: limpa itens específicos da matéria + adiciona ao
            // umbrella set + garante presença em pendentes.materias.
            const assuntosFora = pendentes.assuntos.filter(
              (a) => getMateriaForAssunto(a, dicionario) !== viewingMateria,
            );
            const nodeIdsFora = isMateriaWithTaxonomia(viewingMateria)
              ? []
              : (pendentes.nodeIds ?? []);
            const nextUmbrella = new Set(umbrellaMaterias);
            nextUmbrella.add(viewingMateria);
            setUmbrellaMaterias(nextUmbrella);
            setPendentes({
              ...pendentes,
              materias: pendentes.materias.includes(viewingMateria)
                ? pendentes.materias
                : [...pendentes.materias, viewingMateria],
              assuntos: assuntosFora,
              nodeIds: nodeIdsFora,
            });
          }
        }}
        onUmbrellaAdd={(m) => {
          // Adiciona matéria como umbrella direto da lista (sem entrar na vista).
          if (pendentes.materias.includes(m)) return;
          const nextUmbrella = new Set(umbrellaMaterias);
          nextUmbrella.add(m);
          setUmbrellaMaterias(nextUmbrella);
          setPendentes({
            ...pendentes,
            materias: [...pendentes.materias, m],
          });
        }}
        onAssuntosChange={(next) => {
          // Recalcula pendentes.materias a partir do novo array de assuntos:
          // - matérias com assunto em next → no filtro (não umbrella)
          // - matérias com nodeIds → preservadas (taxonomia ainda picada)
          // - matérias umbrella → preservadas
          // - matérias que perderam todos os items → removidas
          const newMaterias = new Set(pendentes.materias);
          const newUmbrella = new Set(umbrellaMaterias);

          // Adiciona matérias dos novos assuntos (saindo de umbrella se estavam)
          for (const a of next) {
            const m = getMateriaForAssunto(a, dicionario);
            if (m) {
              newMaterias.add(m);
              newUmbrella.delete(m);
            }
          }

          // Remove matérias que ficaram órfãs (sem assunto, sem nodeId, sem umbrella)
          const nodeIds = pendentes.nodeIds ?? [];
          for (const m of pendentes.materias) {
            if (newUmbrella.has(m)) continue;
            const temAssunto = next.some(
              (a) => getMateriaForAssunto(a, dicionario) === m,
            );
            const temNodeIds =
              isMateriaWithTaxonomia(m) && nodeIds.length > 0;
            if (!temAssunto && !temNodeIds) {
              newMaterias.delete(m);
            }
          }

          setUmbrellaMaterias(newUmbrella);
          setPendentes({
            ...pendentes,
            materias: Array.from(newMaterias),
            assuntos: next,
          });
        }}
        onNodeIdsChange={(next) => {
          // Análogo a onAssuntosChange para taxonomia (viewingMateria é dona).
          if (!viewingMateria) {
            setPendentes({ ...pendentes, nodeIds: next });
            return;
          }
          const newMaterias = new Set(pendentes.materias);
          const newUmbrella = new Set(umbrellaMaterias);

          if (next.length > 0) {
            newMaterias.add(viewingMateria);
            newUmbrella.delete(viewingMateria);
          } else {
            // Sem nodeIds: remove a matéria a menos que ela tenha assunto ou seja umbrella
            const temAssunto = pendentes.assuntos.some(
              (a) => getMateriaForAssunto(a, dicionario) === viewingMateria,
            );
            if (!temAssunto && !newUmbrella.has(viewingMateria)) {
              newMaterias.delete(viewingMateria);
            }
          }

          setUmbrellaMaterias(newUmbrella);
          setPendentes({
            ...pendentes,
            materias: Array.from(newMaterias),
            nodeIds: next,
          });
        }}
      />
    </div>
  );
}

function BancaPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets(pendentes);

  return (
    <div data-testid="picker-banca" className="flex flex-col min-h-0 h-full">
      <BancaPicker
        dicionario={dicionario ?? null}
        facets={facets.banca}
        selected={pendentes.bancas}
        onChange={(next) => setPendentes({ ...pendentes, bancas: next })}
      />
    </div>
  );
}

// External mutations to aplicados (× from applied-filters panel, URL nav,
// back/forward) re-key this adapter from the parent, triggering a clean
// remount + re-hydrate via backendToState. Internal selections write to
// pendentes (not aplicados), so no write-loop.
function OrgaoCargoPickerAdapter() {
  const { pendentes, setPendentes } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();

  // Hidrata state local a partir de pendentes no mount (one-shot — useReducer
  // ignora mudanças subsequentes deste initializer). Re-hidratação em mudanças
  // externas é tratada pelo pai re-keyando o adapter na slice de aplicados
  // (orgaos/cargos/org_cargo_pairs).
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
    <div data-testid="picker-orgao-cargo" className="flex flex-col min-h-0 h-full">
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
    <div data-testid="picker-ano" className="flex flex-col min-h-0 h-full">
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
  const { aplicados } = useFiltrosPendentes();

  let content: React.ReactNode;
  switch (activeChip) {
    case 'materia_assuntos':
      content = <MateriaAssuntosPickerAdapter />;
      break;
    case 'banca':
      content = <BancaPickerAdapter />;
      break;
    case 'orgao_cargo': {
      const ocKey = [
        ...(aplicados.orgaos ?? []),
        '|',
        ...(aplicados.cargos ?? []),
        '|',
        ...(aplicados.org_cargo_pairs ?? []),
      ].join(',');
      content = <OrgaoCargoPickerAdapter key={ocKey} />;
      break;
    }
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
        className="flex flex-col min-h-0 h-full"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
