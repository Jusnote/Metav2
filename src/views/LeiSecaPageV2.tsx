'use client';

import { useMemo, useState } from 'react';
import { useLeiSeca } from '@/contexts/LeiSecaContext';
import { useLei } from '@/hooks/useLeiApi';
import { useDispositivoUserStatus } from '@/hooks/useDispositivoUserStatus';
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore';
import { deriveEstrutura, findCurrentNodeId } from '@/lib/lei-seca/derive-estrutura';
import { NordicShell, Topbar, Subnav, MegaMenu, ArticleColumn } from '@/components/lei-seca/v2';

export function LeiSecaPageV2() {
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  const { dispositivos, currentLeiId, isLoading } = useLeiSeca();
  const { lei: currentLei } = useLei(currentLeiId ?? null);
  const { data: statusMap } = useDispositivoUserStatus(currentLeiId);
  const activeIndex = useActiveArtigoIndex();

  // Estrutura da lei aberta (pra computar currentNodeId no escopo da page)
  const estrutura = useMemo(
    () => (currentLei ? deriveEstrutura(currentLei.hierarquia, dispositivos, statusMap) : []),
    [currentLei, dispositivos, statusMap],
  );

  const currentNodeId = useMemo(
    () => findCurrentNodeId(estrutura, dispositivos[activeIndex]),
    [estrutura, dispositivos, activeIndex],
  );

  const currentTotalArtigos = useMemo(
    () => dispositivos.filter((d) => d.tipo === 'ARTIGO').length,
    [dispositivos],
  );

  const currentPctEstudado = useMemo(() => {
    if (currentTotalArtigos === 0) return 0;
    let estudados = 0;
    for (const d of dispositivos) {
      if (d.tipo === 'ARTIGO' && statusMap?.get(String(d.id)) === 'estudado') {
        estudados++;
      }
    }
    return Math.round((estudados / currentTotalArtigos) * 100);
  }, [dispositivos, statusMap, currentTotalArtigos]);

  return (
    <NordicShell
      topbar={
        <Topbar
          megaMenuOpen={megaMenuOpen}
          onToggleMegaMenu={() => setMegaMenuOpen((v) => !v)}
        />
      }
      subnav={<Subnav />}
      main={
        <main className="overflow-y-auto nordic-scroll">
          {currentLeiId ? (
            <ArticleColumn
              leiId={currentLeiId}
              dispositivos={dispositivos}
              isLoading={isLoading}
              activeArtigoId={dispositivos[activeIndex]?.id ?? null}
            />
          ) : null}
        </main>
      }
      drawer={
        currentLeiId ? (
          <MegaMenu
            open={megaMenuOpen}
            onClose={() => setMegaMenuOpen(false)}
            currentLeiId={currentLeiId}
            currentNodeId={currentNodeId}
            currentTotalArtigos={currentTotalArtigos}
            currentPctEstudado={currentPctEstudado}
          />
        ) : undefined
      }
    />
  );
}
