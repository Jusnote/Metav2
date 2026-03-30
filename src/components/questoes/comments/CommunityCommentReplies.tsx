'use client';

import { useState } from 'react';
import type { QuestionComment } from '@/types/question-comments';
import { CommunityCommentItem } from './CommunityCommentItem';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommunityCommentRepliesProps {
  replies: QuestionComment[]; // Already sorted by created_at ASC
  questionId: number;
  currentUserId?: string;
  onReply?: (commentId: string) => void;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  defaultExpanded?: boolean; // true if replies.length <= 3
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommunityCommentReplies({
  replies,
  questionId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  defaultExpanded,
}: CommunityCommentRepliesProps) {
  const autoExpand = defaultExpanded ?? replies.length <= 3;
  const [expanded, setExpanded] = useState(autoExpand);

  if (replies.length === 0) return null;

  return (
    <div className="ml-10 border-l-2 border-zinc-100 pl-4 dark:border-zinc-800">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Ver {replies.length} respostas
        </button>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <CommunityCommentItem
              key={reply.id}
              comment={reply}
              questionId={questionId}
              isReply
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
