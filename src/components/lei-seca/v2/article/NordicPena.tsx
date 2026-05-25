'use client';

import { useMemo } from 'react';
import type { Dispositivo } from '@/types/lei-api';
import type { Grifo } from '@/types/grifo';
import { GrifoText } from '@/components/lei-seca/GrifoText';
import { stripDispositivoPrefix } from '@/lib/lei-seca/strip-dispositivo-prefix';

interface Props {
  item: Dispositivo;
  grifos: Grifo[];
}

export function NordicPena({ item, grifos }: Props) {
  const { texto, grifos: grifosAjustados } = useMemo(
    () => stripDispositivoPrefix(item.tipo, item.texto, grifos),
    [item.tipo, item.texto, grifos],
  );

  return (
    <div data-id={item.id} data-posicao={item.posicao} data-tipo="PENA" className="py-1.5 italic">
      <span className="font-medium not-italic uppercase tracking-n-snug text-[11px] text-n-ink-3 mr-2">
        Pena
      </span>
      <span data-texto className="text-n-ink-2 text-[14px] leading-[1.65] font-n-sans">
        <GrifoText texto={texto} tipo={item.tipo} grifos={grifosAjustados} />
      </span>
    </div>
  );
}
