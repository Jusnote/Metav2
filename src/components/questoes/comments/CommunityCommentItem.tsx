'use client';

import type { QuestionComment } from '@/types/question-comments';
import { CommentItem } from '@/components/shared/comments/CommentItem';
import { useToggleUpvote } from '@/hooks/useToggleUpvote';
import { useToggleReaction } from '@/hooks/useToggleReaction';

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
  onReport?: (commentId: string) => void;
  onPin?: (commentId: string, isPinned: boolean) => void;
  onEndorse?: (commentId: string, isEndorsed: boolean) => void;
  pendingReportCount?: number;
}

// ---------------------------------------------------------------------------
// Component — thin wrapper binding question-specific hooks
// ---------------------------------------------------------------------------

export function CommunityCommentItem({
  comment,
  questionId,
  isReply = false,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onPin,
  onEndorse,
  pendingReportCount,
}: CommunityCommentItemProps) {
  const { mutate: toggleUpvote } = useToggleUpvote(questionId);
  const { mutate: toggleReaction } = useToggleReaction(questionId);

  return (
    <CommentItem
      comment={comment}
      entityType="question"
      entityId={questionId}
      isReply={isReply}
      currentUserId={currentUserId}
      onReply={onReply}
      onEdit={onEdit}
      onDelete={onDelete}
      onReport={onReport}
      onPin={onPin}
      onEndorse={onEndorse}
      onToggleUpvote={(commentId) => toggleUpvote(commentId)}
      onToggleReaction={(commentId, emoji) => toggleReaction({ commentId, emoji })}
      pendingReportCount={pendingReportCount}
    />
  );
}
