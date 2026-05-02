'use client';
import { useState } from 'react';
import { QuestoesFilterChipStrip, type ChipKey } from './QuestoesFilterChipStrip';
import { QuestoesFilterDrawer } from './QuestoesFilterDrawer';
import { QuestoesFilterPicker } from './QuestoesFilterPicker';

export function QuestoesFilterCard() {
  const [activeChip, setActiveChip] = useState<ChipKey>('materia_assuntos');

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <QuestoesFilterChipStrip activeChip={activeChip} onChange={setActiveChip} />
      <QuestoesFilterDrawer
        left={<QuestoesFilterPicker activeChip={activeChip} />}
        right={
          <div
            data-testid="painel-direito-placeholder"
            className="p-4 text-sm text-slate-400"
          >
            Painel direito (3c-3)
          </div>
        }
      />
    </div>
  );
}
