'use client';
import React from 'react';
import type { ChipKey } from './QuestoesFilterChipStrip';

export interface QuestoesFilterPickerProps {
  activeChip: ChipKey;
}

function StubMateriaAssuntos() {
  return <div data-testid="picker-materia-assuntos" className="p-4">Matéria · Assuntos (stub)</div>;
}
function StubBanca() {
  return <div data-testid="picker-banca" className="p-4">Banca (stub)</div>;
}
function StubOrgaoCargo() {
  return <div data-testid="picker-orgao-cargo" className="p-4">Órgão · Cargo (stub)</div>;
}
function StubAno() {
  return <div data-testid="picker-ano" className="p-4">Ano (stub)</div>;
}

export function QuestoesFilterPicker({ activeChip }: QuestoesFilterPickerProps) {
  switch (activeChip) {
    case 'materia_assuntos':
      return <StubMateriaAssuntos />;
    case 'banca':
      return <StubBanca />;
    case 'orgao_cargo':
      return <StubOrgaoCargo />;
    case 'ano':
      return <StubAno />;
  }
}
