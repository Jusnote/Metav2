'use client';
import { useCallback, useState } from 'react';
import { QuestoesFilterChipStrip, type ChipKey } from './QuestoesFilterChipStrip';
import { QuestoesFilterDrawer } from './QuestoesFilterDrawer';
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

export function QuestoesFilterCard({ onApplied }: QuestoesFilterCardProps = {}) {
  const [activeChip, setActiveChip] = useState<ChipKey>('materia_assuntos');
  const { pendentes, aplicados, isDirty, setPendentes, apply } = useFiltrosPendentes();
  const { dicionario } = useFiltrosDicionario();
  const { count } = useQuestoesCount(pendentes);

  const handleApply = useCallback(() => {
    // Aplica filtros + navega pra aba de resultados em UM setSearchParams.
    // Separar essas operações causa race condition (segundo setSearchParams
    // pisa no primeiro com snapshot antigo).
    apply({ view: 'questoes' });
    onApplied?.();
  }, [apply, onApplied]);

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
            onApply={handleApply}
            onChange={(patch) => setPendentes({ ...pendentes, ...patch })}
            dicionario={dicionario ?? null}
          />
        }
      />
    </div>
  );
}
