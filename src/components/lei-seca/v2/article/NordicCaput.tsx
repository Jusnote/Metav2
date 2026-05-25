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

export function NordicCaput({ item, grifos }: Props) {
  const { texto, grifos: grifosAjustados } = useMemo(
    () => stripDispositivoPrefix(item.tipo, item.texto, grifos),
    [item.tipo, item.texto, grifos],
  );

  return (
    <p
      data-id={item.id}
      data-posicao={item.posicao}
      data-tipo="CAPUT"
      data-texto
      className="m-0 py-1 text-n-ink text-[16px] leading-[1.7] tracking-n-normal font-n-sans"
    >
      <GrifoText texto={texto} tipo={item.tipo} grifos={grifosAjustados} />
    </p>
  );
}
