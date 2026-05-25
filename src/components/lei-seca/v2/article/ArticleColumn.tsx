'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { Dispositivo } from '@/types/lei-api';
import {
  useDispositivoUserStatus,
  useToggleDispositivoUserStatus,
  type DispositivoStatus,
} from '@/hooks/useDispositivoUserStatus';
import {
  useDispositivoBookmarks,
  useToggleDispositivoBookmark,
} from '@/hooks/useDispositivoBookmarks';
import {
  useDispositivoCommentCounts,
  useDispositivoNoteFlags,
} from '@/hooks/useDispositivoBadges';
import { useGrifos } from '@/hooks/useGrifos';
import { groupDispositivos } from '@/lib/lei-seca/group-dispositivos';
import { NordicArticle } from './NordicArticle';
import { NordicArticleChild } from './NordicArticleChild';
import { NordicChapterHeader } from './NordicChapterHeader';
import { NordicGenericDispositivo } from './NordicGenericDispositivo';
import { ArticleColumnSkeleton } from './ArticleColumnSkeleton';
import { EmptyLeiState } from './EmptyLeiState';

interface Props {
  leiId: string;
  dispositivos: Dispositivo[];
  isLoading: boolean;
  activeArtigoId: string | null;
}

const EMPTY_GRIFOS: never[] = [];

const CHAPTER_LEVEL: Record<string, 'livro' | 'titulo' | 'capitulo' | 'secao' | 'subsecao'> = {
  PARTE: 'livro',
  LIVRO: 'livro',
  TITULO: 'titulo',
  SUBTITULO: 'titulo',
  CAPITULO: 'capitulo',
  SECAO: 'secao',
  SUBSECAO: 'subsecao',
};

export function ArticleColumn({ leiId, dispositivos, isLoading, activeArtigoId }: Props) {
  const { data: statusMap } = useDispositivoUserStatus(leiId);
  const { data: bookmarksSet } = useDispositivoBookmarks(leiId);
  const { data: commentCountsMap } = useDispositivoCommentCounts(leiId);
  const { data: noteFlagsSet } = useDispositivoNoteFlags(leiId);
  const { grifosByDispositivo } = useGrifos(leiId);

  const toggleStatus = useToggleDispositivoUserStatus();
  const toggleBookmark = useToggleDispositivoBookmark();

  const toggleStatusRef = useRef(toggleStatus);
  toggleStatusRef.current = toggleStatus;
  const toggleBookmarkRef = useRef(toggleBookmark);
  toggleBookmarkRef.current = toggleBookmark;

  const handleToggleStatus = useCallback(
    (dispositivoId: string, status: DispositivoStatus) => {
      toggleStatusRef.current.mutate({ dispositivoId, leiId, status });
    },
    [leiId],
  );

  const handleToggleBookmark = useCallback(
    (dispositivoId: string) => {
      toggleBookmarkRef.current.mutate({ dispositivoId, leiId });
    },
    [leiId],
  );

  const handleOpenNote = useCallback((dispositivoId: string) => {
    // TODO A5
    // eslint-disable-next-line no-console
    console.log('TODO A5: abrir NotesDrawer para', dispositivoId);
  }, []);

  const handleOpenComments = useCallback((dispositivoId: string) => {
    // TODO A5/A6
    // eslint-disable-next-line no-console
    console.log('TODO A5/A6: abrir comentários para', dispositivoId);
  }, []);

  const blocks = useMemo(() => groupDispositivos(dispositivos), [dispositivos]);

  if (isLoading && blocks.length === 0) return <ArticleColumnSkeleton />;
  if (blocks.length === 0) return <EmptyLeiState />;

  const safeStatus = statusMap instanceof Map ? statusMap : null;
  const safeBookmarks = bookmarksSet instanceof Set ? bookmarksSet : null;
  const safeNoteFlags = noteFlagsSet instanceof Set ? noteFlagsSet : null;
  const safeGrifosMap = grifosByDispositivo instanceof Map ? grifosByDispositivo : null;

  return (
    <div className="mx-auto w-full max-w-[720px] px-8 py-10">
      {blocks.map((block) => {
        if (block.kind === 'structural') {
          const level = CHAPTER_LEVEL[block.item.tipo] ?? 'titulo';
          return (
            <NordicChapterHeader
              key={block.item.id}
              item={block.item}
              label={block.label}
              level={level}
            />
          );
        }

        if (block.kind === 'orphan') {
          return (
            <NordicGenericDispositivo
              key={block.item.id}
              item={block.item}
              grifos={safeGrifosMap?.get(block.item.id) ?? EMPTY_GRIFOS}
            />
          );
        }

        const id = String(block.item.id);
        return (
          <NordicArticle
            key={block.item.id}
            item={block.item}
            isActive={block.item.id === activeArtigoId}
            status={safeStatus?.get(id)}
            bookmarked={safeBookmarks?.has(id) ?? false}
            commentCount={commentCountsMap?.[id] ?? 0}
            hasNote={safeNoteFlags?.has(id) ?? false}
            grifos={safeGrifosMap?.get(block.item.id) ?? EMPTY_GRIFOS}
            onToggleStatus={(status) => handleToggleStatus(id, status)}
            onToggleBookmark={() => handleToggleBookmark(id)}
            onOpenNote={() => handleOpenNote(id)}
            onOpenComments={() => handleOpenComments(id)}
          >
            {block.children.map((child) => (
              <NordicArticleChild
                key={child.id}
                item={child}
                grifos={safeGrifosMap?.get(child.id) ?? EMPTY_GRIFOS}
              />
            ))}
          </NordicArticle>
        );
      })}
    </div>
  );
}
