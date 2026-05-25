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

export function NordicParagrafo({ item, grifos }: Props) {
  const numeroDigits = item.numero?.match(/\d+/)?.[0];
  const isUnico = !numeroDigits;

  const { texto, grifos: grifosAjustados } = useMemo(
    () => stripDispositivoPrefix(item.tipo, item.texto, grifos),
    [item.tipo, item.texto, grifos],
  );

  if (isUnico) {
    return (
      <p
        data-id={item.id}
        data-posicao={item.posicao}
        data-tipo={item.tipo}
        data-texto
        className="m-0 py-1.5 text-n-ink-2 text-[14.5px] leading-[1.6] tracking-n-normal font-n-sans"
      >
        <span className="font-medium not-italic text-n-accent mr-1.5">
          Parágrafo único.
        </span>
        <GrifoText texto={texto} tipo={item.tipo} grifos={grifosAjustados} />
      </p>
    );
  }

  return (
    <div
      data-id={item.id}
      data-posicao={item.posicao}
      data-tipo={item.tipo}
      className="flex gap-2.5 py-1.5"
    >
      <span className="font-n-mono text-[11px] text-n-accent w-7 shrink-0 pt-[3px]">
        §{numeroDigits}
      </span>
      <p
        data-texto
        className="m-0 text-n-ink-2 text-[14.5px] leading-[1.6] tracking-n-normal font-n-sans flex-1 min-w-0"
      >
        <GrifoText texto={texto} tipo={item.tipo} grifos={grifosAjustados} />
      </p>
    </div>
  );
}
