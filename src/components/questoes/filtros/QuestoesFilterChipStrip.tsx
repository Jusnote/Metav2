'use client';
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Library, Building2, Landmark, Calendar } from 'lucide-react';

export type ChipKey = 'materia_assuntos' | 'banca' | 'orgao_cargo' | 'ano';

export interface ChipDef {
  key: ChipKey;
  label: string;
  icon: LucideIcon;
}

export const CHIPS: ChipDef[] = [
  { key: 'materia_assuntos', label: 'Matéria → Assuntos', icon: Library },
  { key: 'banca', label: 'Banca', icon: Building2 },
  { key: 'orgao_cargo', label: 'Órgão → Cargo', icon: Landmark },
  { key: 'ano', label: 'Ano', icon: Calendar },
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
        const Icon = chip.icon;
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
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <Icon size={14} strokeWidth={2} aria-hidden />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
