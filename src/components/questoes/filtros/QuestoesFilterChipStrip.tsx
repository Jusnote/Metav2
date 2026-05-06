'use client';
import React, { Fragment } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Library, Building2, Landmark, Calendar } from 'lucide-react';

export type ChipKey = 'materia_assuntos' | 'banca' | 'orgao_cargo' | 'ano';

export interface ChipDef {
  key: ChipKey;
  label: string;
  icon: LucideIcon;
}

export const CHIPS: ChipDef[] = [
  { key: 'materia_assuntos', label: 'Disciplina → Assunto', icon: Library },
  { key: 'banca', label: 'Banca aplicadora', icon: Building2 },
  { key: 'orgao_cargo', label: 'Instituição → Cargos', icon: Landmark },
  { key: 'ano', label: 'Ano(s)', icon: Calendar },
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
    <nav className="flex items-stretch">
      {CHIPS.map((chip, i) => {
        const isActive = chip.key === activeChip;
        const Icon = chip.icon;
        return (
          <Fragment key={chip.key}>
            {i > 0 && (
              <span
                aria-hidden
                className="self-center h-4 w-px bg-slate-200"
              />
            )}
            <button
              type="button"
              onClick={() => onChange(chip.key)}
              aria-pressed={isActive}
              className={[
                'relative flex items-center gap-2 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? "text-slate-900 font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-blue-600 after:rounded-full"
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <Icon size={14} strokeWidth={2} aria-hidden />
              <span>{chip.label}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
