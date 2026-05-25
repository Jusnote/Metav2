'use client';

import type { Dispositivo } from '@/types/lei-api';
import type { Grifo } from '@/types/grifo';
import { NordicCaput } from './NordicCaput';
import { NordicParagrafo } from './NordicParagrafo';
import { NordicInciso } from './NordicInciso';
import { NordicAlinea } from './NordicAlinea';
import { NordicPena } from './NordicPena';
import { NordicSubRubrica } from './NordicSubRubrica';
import { NordicGenericDispositivo } from './NordicGenericDispositivo';

interface Props {
  item: Dispositivo;
  grifos: Grifo[];
}

export function NordicArticleChild({ item, grifos }: Props) {
  if (item.tipo === 'CAPUT') return <NordicCaput item={item} grifos={grifos} />;
  if (item.tipo === 'PARAGRAFO') return <NordicParagrafo item={item} grifos={grifos} />;
  if (item.tipo === 'INCISO') return <NordicInciso item={item} grifos={grifos} />;
  if (item.tipo === 'ALINEA') return <NordicAlinea item={item} grifos={grifos} />;
  if (item.tipo === 'PENA') return <NordicPena item={item} grifos={grifos} />;
  if (item.tipo === 'EPIGRAFE' || item.tipo === 'SUBTITULO' || item.tipo === 'AGRUPADOR') {
    return <NordicSubRubrica item={item} />;
  }
  return <NordicGenericDispositivo item={item} grifos={grifos} />;
}
