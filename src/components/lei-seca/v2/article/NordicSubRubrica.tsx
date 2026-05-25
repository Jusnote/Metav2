'use client';

import type { Dispositivo } from '@/types/lei-api';

interface Props {
  item: Dispositivo;
}

/**
 * Sub-rubrica dentro de um artigo (ex: "Descriminantes putativas" agrupando §1, §2).
 * Renderizada como label uppercase pequeno pra criar hierarquia entre grupos de parágrafos
 * sem competir visualmente com o título do artigo.
 */
export function NordicSubRubrica({ item }: Props) {
  return (
    <h3
      data-id={item.id}
      data-posicao={item.posicao}
      data-tipo={item.tipo}
      className="m-0 mt-4 mb-1 text-[11px] uppercase tracking-[0.12em] text-n-ink-3 font-medium"
    >
      {item.texto}
    </h3>
  );
}
