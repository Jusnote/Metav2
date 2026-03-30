'use client';

import { type Value } from 'platejs';
import type { QuestionComment } from '@/types/question-comments';
import { cn } from '@/lib/utils';
import { CommunityCommentStatic } from './CommunityCommentStatic';
import { CommentVoteButton } from './CommentVoteButton';
import { PinnedBadge } from './PinnedBadge';
import { EndorsedBadge } from './EndorsedBadge';
import { CommentContextMenu } from './CommentContextMenu';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAvatarColor(name: string): string {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-amber-400 to-amber-600',
    'from-rose-400 to-rose-600',
    'from-cyan-400 to-cyan-600',
  ];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommunityCommentItemProps {
  comment: QuestionComment;
  questionId: number;
  isReply?: boolean;
  currentUserId?: string;
  onReply?: (commentId: string) => void;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommunityCommentItem({
  comment,
  questionId,
  isReply = false,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
}: CommunityCommentItemProps) {
  const authorName = comment.author_name ?? comment.author_email ?? 'Anônimo';
  const initials = authorName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const avatarGradient = getAvatarColor(authorName);
  const isAuthor = !!currentUserId && currentUserId === comment.user_id;

  // Deleted state
  if (comment.is_deleted) {
    return (
      <div className="flex gap-3 py-2">
        <div className="h-8 w-8 shrink-0" />
        <p className="text-sm italic text-zinc-400">[Comentário removido]</p>
      </div>
    );
  }

  return (
    <div className="group relative flex gap-3 py-2">
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white shadow-sm',
          avatarGradient,
        )}
        aria-hidden="true"
      >
        {comment.author_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author_avatar_url}
            alt={authorName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {authorName}
            </span>
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-400">{relativeTime(comment.created_at)}</span>
            {comment.edit_count > 0 && (
              <span className="italic text-zinc-400">(editado)</span>
            )}
          </div>

          {/* Context menu — hidden until hover on desktop, always visible on mobile */}
          <div className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <CommentContextMenu
              commentId={comment.id}
              questionId={questionId}
              isAuthor={isAuthor}
              onEdit={() => onEdit?.(comment.id)}
              onDelete={() => onDelete?.(comment.id)}
              onReport={() => {
                // report handler — parent can wire this if needed
              }}
            />
          </div>
        </div>

        {/* Badges */}
        {(comment.is_pinned || comment.is_endorsed) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {comment.is_pinned && <PinnedBadge />}
            {comment.is_endorsed && <EndorsedBadge />}
          </div>
        )}

        {/* Comment body */}
        <div className="mt-1">
          <CommunityCommentStatic
            value={comment.content_json as unknown as Value}
          />
        </div>

        {/* Quoted text */}
        {comment.quoted_text && (
          <blockquote className="mt-2 rounded-r border-l-2 border-blue-400 bg-blue-50/50 py-1.5 pl-3 pr-2 text-xs text-zinc-600 dark:bg-blue-950/20 dark:text-zinc-400">
            {comment.quoted_text}
          </blockquote>
        )}

        {/* Actions row */}
        <div className="mt-2 flex items-center gap-3">
          <CommentVoteButton
            commentId={comment.id}
            questionId={questionId}
            upvoteCount={comment.upvote_count}
            hasUpvoted={comment.has_upvoted}
          />
          {!isReply && onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Responder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
