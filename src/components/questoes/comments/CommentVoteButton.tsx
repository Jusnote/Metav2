'use client';

import { useState } from 'react';
import { ArrowBigUp } from 'lucide-react';
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
      <ArrowBigUp
        className={cn(
          'h-4 w-4 transition-colors',
          hasUpvoted
            ? 'fill-[#2563EB] stroke-[#2563EB]'
            : 'fill-transparent stroke-zinc-400',
        )}
      />
      <span
        className={cn(
          'tabular-nums',
          hasUpvoted ? 'text-[#2563EB]' : 'text-zinc-500',
        )}
      >
        {upvoteCount}
      </span>
    </button>
  );
}
