'use client';

import type { Dispositivo } from '@/types/lei-api';
import type { Grifo } from '@/types/grifo';
import { GrifoText } from '@/components/lei-seca/GrifoText';

interface Props {
  item: Dispositivo;
  grifos: Grifo[];
}

export function NordicGenericDispositivo({ item, grifos }: Props) {
  return (
    <div data-id={item.id} data-posicao={item.posicao} data-tipo={item.tipo} className="py-1">
      <span data-texto className="text-n-ink text-[15px] leading-[1.7] font-n-sans">
        <GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} />
      </span>
    </div>
  );
}
