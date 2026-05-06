// src/components/questoes/objetivo/ObjetivoSection.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCarreiras, useAreaCounts } from '@/hooks/useCarreiras';
import { useFocoObjetivo } from '@/hooks/useFocoObjetivo';
import { AREA_LABELS, type Area } from '@/types/carreira';
import { AreaTabs } from './AreaTabs';
import { CarreiraCarousel } from './CarreiraCarousel';
import { useQuestoesOptional } from '@/contexts/QuestoesContext';

// Mapping carreira → filtros aplicados quando o card é foco ativo.
// Hoje só OAB tem mapeamento real; outras carreiras seguem visuais.
const CARREIRA_FILTROS: Record<string, { orgaos: string[] }> = {
  'mock-oab': { orgaos: ['OAB', 'OAB DF'] },
};

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
  const [area, setArea] = useState<Area>('advocacia');

  const { focos, toggleFoco, clearFocos } = useFocoObjetivo();

  const { data: carreiras = [], isLoading } = useCarreiras(area);
  const { data: counts = {} } = useAreaCounts();

  const ctx = useQuestoesOptional();

  useEffect(() => {
    if (!ctx?.filters || !ctx.setFilter || !ctx.triggerSearch) return;
    const orgaosTarget = new Set<string>();
    for (const id of focos) {
      const map = CARREIRA_FILTROS[id];
      if (map) for (const o of map.orgaos) orgaosTarget.add(o);
    }
    const arr = Array.from(orgaosTarget);
    const current = ctx.filters.orgaos ?? [];
    const same =
      arr.length === current.length &&
      arr.every((v) => current.includes(v));
    if (!same) {
      ctx.setFilter('orgaos', arr);
      ctx.triggerSearch();
    }
  }, [focos, ctx]);

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
