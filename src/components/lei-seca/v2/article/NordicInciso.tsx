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

export function NordicInciso({ item, grifos }: Props) {
  const { texto, grifos: grifosAjustados } = useMemo(
    () => stripDispositivoPrefix(item.tipo, item.texto, grifos),
    [item.tipo, item.texto, grifos],
  );

  return (
    <div
      data-id={item.id}
      data-posicao={item.posicao}
      data-tipo="INCISO"
      className="grid grid-cols-[32px_1fr] gap-3 py-1.5"
    >
      <span className="font-n-mono text-[11px] text-n-ink-3 pt-[3px]">
        {item.numero ?? '—'}
      </span>
      <p
        data-texto
        className="m-0 text-n-ink-2 text-[15px] leading-[1.6] tracking-n-normal font-n-sans"
      >
        <GrifoText texto={texto} tipo={item.tipo} grifos={grifosAjustados} />
      </p>
    </div>
  );
}
