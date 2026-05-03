// src/components/questoes/objetivo/ObjetivoSection.tsx
'use client';

import { useMemo, useState } from 'react';
import { useCarreiras, useAreaCounts } from '@/hooks/useCarreiras';
import { useFocoObjetivo } from '@/hooks/useFocoObjetivo';
import { AREA_LABELS, type Area } from '@/types/carreira';
import { AreaTabs } from './AreaTabs';
import { CarreiraCarousel } from './CarreiraCarousel';

/**
 * Container da seção OBJETIVO. Orquestra:
 *  - estado da área selecionada
 *  - filtro por texto (busca "Filtrar carreiras")
 *  - focos ativos (useFocoObjetivo)
 *  - carreiras da área (useCarreiras)
 *  - contagens por área (useAreaCounts)
 *
 * Fase 1A: os focos não têm efeito nos pills ou na query de questões —
 * só destacam os cards visualmente.
 */
export function ObjetivoSection() {
  const [area, setArea] = useState<Area>('policial');

  const { focos, toggleFoco, clearFocos } = useFocoObjetivo();

  const { data: carreiras = [], isLoading } = useCarreiras(area);
  const { data: counts = {} } = useAreaCounts();

  return (
    <section className="mt-5">
      <AreaTabs value={area} onChange={setArea} counts={counts} />

      <CarreiraCarousel
        carreiras={carreiras}
        focosAtivos={focos}
        onToggleFoco={toggleFoco}
        onClearFocos={clearFocos}
        areaLabel={AREA_LABELS[area]}
        loading={isLoading}
      />
    </section>
  );
}
