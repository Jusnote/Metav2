'use client';

import { memo } from 'react';
import type { Dispositivo } from '@/types/lei-api';
import type { Grifo } from '@/types/grifo';
import type { DispositivoStatus } from '@/hooks/useDispositivoUserStatus';
import { NordicArticle } from './NordicArticle';
import { NordicCaput } from './NordicCaput';
import { NordicParagrafo } from './NordicParagrafo';
import { NordicInciso } from './NordicInciso';
import { NordicAlinea } from './NordicAlinea';
import { NordicPena } from './NordicPena';
import { NordicGenericDispositivo } from './NordicGenericDispositivo';
import { NordicChapterHeader } from './NordicChapterHeader';

interface Props {
  item: Dispositivo;
  isActive: boolean;
  status: DispositivoStatus | undefined;
  bookmarked: boolean;
  commentCount: number;
  hasNote: boolean;
  grifos: Grifo[];
  onToggleStatus: (status: DispositivoStatus) => void;
  onToggleBookmark: () => void;
  onOpenNote: () => void;
  onOpenComments: () => void;
}

export const NordicDispositivoRenderer = memo(function NordicDispositivoRenderer(props: Props) {
  const { item, grifos } = props;

  // Pular ruído conhecido (mesma lógica do legacy DispositivoRenderer)
  if (item.tipo === 'EMENTA' || item.tipo === 'PREAMBULO') return null;
  if (item.tipo === 'EPIGRAFE' && /^(ÍNDICE|índice|\.|[*])$/i.test(item.texto.trim())) return null;

  // Estruturais — apenas headers, sem ActionPills
  if (item.tipo === 'PARTE' || item.tipo === 'LIVRO') {
    return <NordicChapterHeader item={item} level="livro" />;
  }
  if (item.tipo === 'TITULO') return <NordicChapterHeader item={item} level="titulo" />;
  if (item.tipo === 'CAPITULO') return <NordicChapterHeader item={item} level="capitulo" />;
  if (item.tipo === 'SECAO') return <NordicChapterHeader item={item} level="secao" />;
  if (item.tipo === 'SUBSECAO') return <NordicChapterHeader item={item} level="subsecao" />;

  // Conteúdo
  if (item.tipo === 'ARTIGO') return <NordicArticle {...props} />;
  if (item.tipo === 'CAPUT') return <NordicCaput item={item} grifos={grifos} />;
  if (item.tipo === 'PARAGRAFO') return <NordicParagrafo item={item} grifos={grifos} />;
  if (item.tipo === 'INCISO') return <NordicInciso item={item} grifos={grifos} />;
  if (item.tipo === 'ALINEA') return <NordicAlinea item={item} grifos={grifos} />;
  if (item.tipo === 'PENA') return <NordicPena item={item} grifos={grifos} />;

  return <NordicGenericDispositivo item={item} grifos={grifos} />;
});
