'use client';
import { useState } from 'react';
import { QuestoesFilterChipStrip, type ChipKey } from './QuestoesFilterChipStrip';
import { QuestoesFilterDrawer } from './QuestoesFilterDrawer';
import { QuestoesFilterPicker } from './QuestoesFilterPicker';
import { QuestoesActiveFiltersPanel } from './QuestoesActiveFiltersPanel';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useQuestoesCount } from '@/hooks/useQuestoesCount';

export function QuestoesFilterCard() {
  const [activeChip, setActiveChip] = useState<ChipKey>('materia_assuntos');
  const { pendentes, aplicados, isDirty, setPendentes, apply } = useFiltrosPendentes();
  const { count } = useQuestoesCount(pendentes);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <QuestoesFilterChipStrip activeChip={activeChip} onChange={setActiveChip} />
      <QuestoesFilterDrawer
        left={<QuestoesFilterPicker activeChip={activeChip} />}
        right={
          <QuestoesActiveFiltersPanel
            pendentes={pendentes}
            aplicados={aplicados}
            isDirty={isDirty}
            count={count}
            onApply={apply}
            onChange={(patch) => setPendentes({ ...pendentes, ...patch })}
          />
        }
      />
    </div>
  );
}
