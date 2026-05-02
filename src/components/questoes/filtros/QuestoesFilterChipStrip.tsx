'use client';
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Building2, Landmark, Calendar } from 'lucide-react';

export type ChipKey = 'materia_assuntos' | 'banca' | 'orgao_cargo' | 'ano';

export interface ChipDef {
  key: ChipKey;
  label: string;
  icon: LucideIcon;
  iconStroke: string;
}

export const CHIPS: ChipDef[] = [
  { key: 'materia_assuntos', label: 'Matéria · Assuntos', icon: BookOpen, iconStroke: '#D97706' },
  { key: 'banca', label: 'Banca', icon: Building2, iconStroke: '#7C3AED' },
  { key: 'orgao_cargo', label: 'Órgão · Cargo', icon: Landmark, iconStroke: '#16A34A' },
  { key: 'ano', label: 'Ano', icon: Calendar, iconStroke: '#2563EB' },
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
            <Icon size={16} strokeWidth={2} color={chip.iconStroke} aria-hidden />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
