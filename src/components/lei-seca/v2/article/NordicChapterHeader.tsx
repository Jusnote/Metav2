'use client';

import type { Dispositivo } from '@/types/lei-api';

// Mesma família tipográfica em todos os níveis (semibold, tracking-tight, sem uppercase)
// com escala 1px decrescente conforme aprofunda a hierarquia.
const STYLES: Record<string, string> = {
  livro:    'text-[20px] tracking-n-tight text-n-ink font-semibold leading-[1.2]',
  titulo:   'text-[19px] tracking-n-tight text-n-ink font-semibold leading-[1.2]',
  capitulo: 'text-[18px] tracking-n-tight text-n-ink font-semibold leading-[1.2]',
  secao:    'text-[17px] tracking-n-tight text-n-ink font-semibold leading-[1.2]',
  subsecao: 'text-[16px] tracking-n-tight text-n-ink font-semibold leading-[1.2]',
};

const LABEL_STYLES: Record<string, string> = {
  livro:    'text-[18px] tracking-n-tight text-n-ink font-normal leading-[1.25]',
  titulo:   'text-[17px] tracking-n-tight text-n-ink font-normal leading-[1.25]',
  capitulo: 'text-[16px] tracking-n-tight text-n-ink font-normal leading-[1.25]',
  secao:    'text-[15px] tracking-n-tight text-n-ink font-normal leading-[1.25]',
  subsecao: 'text-[14px] tracking-n-tight text-n-ink font-normal leading-[1.25]',
};

const WRAPPER: Record<string, string> = {
  livro:    'mt-6 mb-2',
  titulo:   'mt-4 mb-2',
  capitulo: 'mt-4 mb-2',
  secao:    'mt-3 mb-1.5',
  subsecao: 'mt-2 mb-1',
};

interface Props {
  item: Dispositivo;
  label?: Dispositivo;
  level: keyof typeof STYLES;
}

export function NordicChapterHeader({ item, label, level }: Props) {
  const numero = item.numero?.trim();
  const texto = item.texto?.trim();
  const labelTexto = label?.texto?.trim();

  return (
    <div
      data-id={item.id}
      data-posicao={item.posicao}
      data-tipo={item.tipo}
      className={WRAPPER[level]}
    >
      {numero && (
        <div className="font-n-mono text-[11px] text-n-ink-3 tracking-[0.04em] uppercase mb-2">
          {item.tipo.toLowerCase()}_{numero}
        </div>
      )}
      <h2 className={STYLES[level]}>{texto}</h2>
      {labelTexto && (
        <p
          data-id={label!.id}
          data-tipo={label!.tipo}
          className={'m-0 mt-1 ' + LABEL_STYLES[level]}
        >
          {labelTexto}
        </p>
      )}
    </div>
  );
}
