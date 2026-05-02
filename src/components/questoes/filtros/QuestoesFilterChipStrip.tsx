'use client';
import React from 'react';

export type ChipKey = 'materia_assuntos' | 'banca' | 'orgao_cargo' | 'ano';

export interface ChipDef {
  key: ChipKey;
  label: string;
  icon: string;
}

export const CHIPS: ChipDef[] = [
  { key: 'materia_assuntos', label: 'Matéria · Assuntos', icon: '📚' },
  { key: 'banca', label: 'Banca', icon: '🏛' },
  { key: 'orgao_cargo', label: 'Órgão · Cargo', icon: '🏢' },
  { key: 'ano', label: 'Ano', icon: '📅' },
];

export interface QuestoesFilterChipStripProps {
  activeChip: ChipKey;
  onChange: (next: ChipKey) => void;
}

export function QuestoesFilterChipStrip({
  activeChip,
  onChange,
}: QuestoesFilterChipStripProps) {
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {CHIPS.map((chip) => {
        const isActive = chip.key === activeChip;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm transition-colors',
              'border-b-2',
              isActive
                ? 'border-[#1f2937] text-[#1f2937] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <span aria-hidden>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
