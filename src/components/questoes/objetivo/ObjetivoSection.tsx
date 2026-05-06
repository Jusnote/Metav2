// src/components/questoes/objetivo/ObjetivoSection.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCarreiras, useAreaCounts } from '@/hooks/useCarreiras';
import { useFocoObjetivo } from '@/hooks/useFocoObjetivo';
import { AREA_LABELS, type Area } from '@/types/carreira';
import { AreaTabs } from './AreaTabs';
import { CarreiraCarousel } from './CarreiraCarousel';
import { useSearchParams } from 'react-router-dom';
import { useQuestoesFilterDraftOptional } from '@/contexts/QuestoesFilterDraftContext';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const draftCtx = useQuestoesFilterDraftOptional();

  useEffect(() => {
    const orgaosTarget = new Set<string>();
    for (const id of focos) {
      const map = CARREIRA_FILTROS[id];
      if (map) for (const o of map.orgaos) orgaosTarget.add(o);
    }
    const targetArr = Array.from(orgaosTarget).sort();
    const currentArr = searchParams.getAll('orgaos').sort();
    const same =
      targetArr.length === currentArr.length &&
      targetArr.every((v, i) => currentArr[i] === v);

    if (!same) {
      const next = new URLSearchParams(searchParams);
      next.delete('orgaos');
      for (const o of targetArr) next.append('orgaos', o);
      setSearchParams(next, { replace: true });
    }

    // Também atualiza o draft (pendentes) — assim "Aplicar filtros" preserva
    // os orgaos vindos da carreira em vez de sobrescrever URL com pendentes stale.
    if (draftCtx) {
      const currentDraftOrgaos = (draftCtx.pendentes.orgaos ?? []).slice().sort();
      const sameDraft =
        targetArr.length === currentDraftOrgaos.length &&
        targetArr.every((v, i) => currentDraftOrgaos[i] === v);
      if (!sameDraft) {
        draftCtx.setPendentes({ ...draftCtx.pendentes, orgaos: targetArr });
      }
    }
  }, [focos, searchParams, setSearchParams, draftCtx]);

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
