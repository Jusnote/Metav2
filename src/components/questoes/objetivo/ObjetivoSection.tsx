// src/components/questoes/objetivo/ObjetivoSection.tsx
'use client';

import { useMemo, useState } from 'react';
import { useCarreiras, useAreaCounts } from '@/hooks/useCarreiras';
import { useFocoObjetivo } from '@/hooks/useFocoObjetivo';
import { AREA_LABELS, type Area } from '@/types/carreira';
import { ObjetivoHeader } from './ObjetivoHeader';
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
  const [filtro, setFiltro] = useState('');

  const { focos, toggleFoco, clearFocos, hasAnyFoco } = useFocoObjetivo();

  const { data: carreiras = [], isLoading } = useCarreiras(area);
  const { data: counts = {} } = useAreaCounts();

  const carreirasFiltradas = useMemo(() => {
    if (!filtro.trim()) return carreiras;
    const q = filtro.trim().toLowerCase();
    return carreiras.filter((c) => c.nome.toLowerCase().includes(q));
  }, [carreiras, filtro]);

  return (
    <section className="mt-5">
      <ObjetivoHeader
        filtro={filtro}
        onFiltroChange={setFiltro}
        hasAnyFoco={hasAnyFoco}
        onClearFocos={clearFocos}
      />

      <AreaTabs value={area} onChange={setArea} counts={counts} />

      <CarreiraCarousel
        carreiras={carreirasFiltradas}
        focosAtivos={focos}
        onToggleFoco={toggleFoco}
        onClearFocos={clearFocos}
        areaLabel={AREA_LABELS[area]}
        loading={isLoading}
      />
    </section>
  );
}
