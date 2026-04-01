'use client';

import { type Value } from 'platejs';
import { CommentStatic as CommunityCommentStatic } from '@/components/shared/comments/CommentStatic';

interface ContentPreviewProps {
  type: 'comment' | 'question' | 'law_article';
  contentJson?: Record<string, unknown>;
  contentText?: string;
  authorName?: string | null;
  authorEmail?: string | null;
  questionId?: number;
}

export function ContentPreview({
  type,
  contentJson,
  contentText,
  authorName,
  authorEmail,
}: ContentPreviewProps) {
  const displayName = authorName ?? authorEmail ?? 'Anônimo';

  return (
    <div className="rounded-lg border border-zinc-100 bg-[#fafafa] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          {type === 'comment' ? 'Comentário' : type === 'question' ? 'Questão' : 'Dispositivo Legal'}
        </span>
      </div>

      {type === 'comment' && contentJson ? (
        <>
          <p className="mb-2 text-[12px] font-medium text-zinc-500">
            por {displayName}
          </p>
          <div className="text-[13px] leading-[1.55] text-zinc-600">
            <CommunityCommentStatic value={contentJson as unknown as Value} />
          </div>
        </>
      ) : (
        <p className="text-[13px] text-zinc-600">
          {contentText ?? 'Conteúdo não disponível'}
        </p>
      )}
    </div>
  );
}
