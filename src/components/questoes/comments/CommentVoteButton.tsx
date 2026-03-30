'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToggleUpvote } from '@/hooks/useToggleUpvote';

interface CommentVoteButtonProps {
  commentId: string;
  questionId: number;
  upvoteCount: number;
  hasUpvoted: boolean;
}

export function CommentVoteButton({
  commentId,
  questionId,
  upvoteCount,
  hasUpvoted,
}: CommentVoteButtonProps) {
  const { mutate: toggleUpvote } = useToggleUpvote(questionId);
  const [bouncing, setBouncing] = useState(false);

  function handleClick() {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 300);
    toggleUpvote(commentId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-0.5 text-xs transition-transform',
        bouncing && 'scale-125',
      )}
      aria-label={hasUpvoted ? 'Remover voto' : 'Votar'}
    >
      <ChevronUp
        className={cn(
          'h-[13px] w-[13px] transition-colors',
          hasUpvoted
            ? 'text-blue-600'
            : 'text-zinc-400',
        )}
        strokeWidth={hasUpvoted ? 2.5 : 2}
      />
      <span
        className={cn(
          'tabular-nums',
          hasUpvoted ? 'font-medium text-blue-600' : 'text-zinc-400',
        )}
      >
        {upvoteCount}
      </span>
    </button>
  );
}
