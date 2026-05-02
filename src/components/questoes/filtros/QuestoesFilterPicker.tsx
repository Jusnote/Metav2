'use client';
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChipKey } from './QuestoesFilterChipStrip';
import { BancaPicker } from './pickers/BancaPicker';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';

export interface QuestoesFilterPickerProps {
  activeChip: ChipKey;
}

function StubMateriaAssuntos() {
  return <div data-testid="picker-materia-assuntos" className="p-4">Matéria · Assuntos (stub)</div>;
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

function StubOrgaoCargo() {
  return <div data-testid="picker-orgao-cargo" className="p-4">Órgão · Cargo (stub)</div>;
}
function StubAno() {
  return <div data-testid="picker-ano" className="p-4">Ano (stub)</div>;
}

export function QuestoesFilterPicker({ activeChip }: QuestoesFilterPickerProps) {
  let content: React.ReactNode;
  switch (activeChip) {
    case 'materia_assuntos':
      content = <StubMateriaAssuntos />;
      break;
    case 'banca':
      content = <BancaPickerAdapter />;
      break;
    case 'orgao_cargo':
      content = <StubOrgaoCargo />;
      break;
    case 'ano':
      content = <StubAno />;
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
