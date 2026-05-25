'use client';
import { useCallback, useState } from 'react';
import { QuestoesFilterChipStrip, type ChipKey } from './QuestoesFilterChipStrip';
import { QuestoesFilterPicker } from './QuestoesFilterPicker';
import { QuestoesActiveFiltersPanel } from './QuestoesActiveFiltersPanel';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesCount } from '@/hooks/useQuestoesCount';

export interface QuestoesFilterCardProps {
  /** Disparado depois que `apply()` rodou — usado pela página para
   * sincronizar `triggerSearch()` e trocar para a aba de resultados. */
  onApplied?: () => void;
}

const cardGlass =
  'bg-white border border-slate-200/70 rounded-xl shadow-[0_10px_30px_-10px_rgba(30,41,59,0.10),0_2px_8px_-2px_rgba(30,41,59,0.04)]';

export function QuestoesFilterCard({ onApplied }: QuestoesFilterCardProps = {}) {
  const [activeChip, setActiveChip] = useState<ChipKey>('materia_assuntos');
  const { pendentes, aplicados, isDirty, setPendentes, apply } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { count } = useQuestoesCount(pendentes);

  const handleApply = useCallback(() => {
    apply({ view: 'questoes' });
    onApplied?.();
  }, [apply, onApplied]);

  return (
    <div
      data-testid="filter-grid"
      className="grid h-[70vh] min-h-[480px] gap-4"
      style={{ gridTemplateColumns: '13fr 7fr', gridTemplateRows: '1fr' }}
    >
      {/* LEFT — chip strip + picker em UM card */}
      <div className={`${cardGlass} flex flex-col min-h-0 overflow-hidden`}>
        <QuestoesFilterChipStrip activeChip={activeChip} onChange={setActiveChip} />
        <div className="flex-1 min-h-0 overflow-hidden">
          <QuestoesFilterPicker activeChip={activeChip} />
        </div>
      </div>

      {/* RIGHT — 3 cards stacked */}
      <QuestoesActiveFiltersPanel
        pendentes={pendentes}
        aplicados={aplicados}
        isDirty={isDirty}
        count={count}
        onApply={handleApply}
        onChange={(patch) => setPendentes({ ...pendentes, ...patch })}
        dicionario={dicionario ?? null}
      />
    </div>
  );
}
