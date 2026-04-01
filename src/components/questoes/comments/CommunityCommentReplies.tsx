'use client';

import { useState } from 'react';
import type { QuestionComment } from '@/types/question-comments';
import { CommunityCommentItem } from './CommunityCommentItem';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const autoExpand = defaultExpanded ?? replies.length <= 3;
  const [expanded, setExpanded] = useState(!isMobile && autoExpand);

  if (replies.length === 0) return null;

  return (
    <div className="ml-[38px]">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="py-1.5 text-[11px] font-medium text-violet-600 hover:text-violet-700"
        >
          {replies.length} {replies.length === 1 ? 'resposta' : 'respostas'}
        </button>
      ) : (
        <div className="space-y-1">
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
