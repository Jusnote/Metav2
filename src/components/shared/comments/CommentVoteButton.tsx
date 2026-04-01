'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentVoteButtonProps {
  commentId: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  onToggleUpvote: (commentId: string) => void;
}

export function CommentVoteButton({
  commentId,
  upvoteCount,
  hasUpvoted,
  onToggleUpvote,
}: CommentVoteButtonProps) {
  const [bouncing, setBouncing] = useState(false);

  function handleClick() {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 300);
    onToggleUpvote(commentId);
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
