'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REACTION_EMOJIS } from '@/types/question-comments';
import { useToggleReaction } from '@/hooks/useToggleReaction';

interface ReactionButtonsProps {
  commentId: string;
  questionId: number;
  reactionCounts: Record<string, number>;
  userReactions: string[];
}

export function ReactionButtons({
  commentId,
  questionId,
  reactionCounts,
  userReactions,
}: ReactionButtonsProps) {
  const { mutate: toggleReaction } = useToggleReaction(questionId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bouncing, setBouncing] = useState<string | null>(null);

  function handleToggle(emoji: string) {
    setBouncing(emoji);
    setTimeout(() => setBouncing(null), 300);
    toggleReaction({ commentId, emoji });
    setPickerOpen(false);
  }

  // Emojis with counts > 0, ordered by REACTION_EMOJIS order
  const activeReactions = REACTION_EMOJIS
    .filter((r) => (reactionCounts[r.emoji] ?? 0) > 0)
    .map((r) => ({
      ...r,
      count: reactionCounts[r.emoji],
      hasReacted: userReactions.includes(r.emoji),
    }));

  return (
    <>
      {/* Existing reactions — inline toggles */}
      {activeReactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => handleToggle(r.emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 text-xs transition-transform',
            bouncing === r.emoji && 'scale-125',
          )}
          aria-label={r.hasReacted ? `Remover ${r.label}` : r.label}
        >
          <span className="text-xs">{r.emoji}</span>
          <span
            className={cn(
              'tabular-nums',
              r.hasReacted ? 'font-medium text-blue-600' : 'text-zinc-400',
            )}
          >
            {r.count}
          </span>
        </button>
      ))}

      {/* Add reaction button + ghost popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex items-center gap-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Adicionar reação"
        >
          <SmilePlus className="h-[13px] w-[13px]" strokeWidth={2} />
        </button>

        {pickerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPickerOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
              aria-hidden="true"
            />
            {/* Ghost popover */}
            <div className="absolute bottom-6 left-0 z-20 flex gap-0.5 rounded-lg bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-zinc-900">
              {REACTION_EMOJIS.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => handleToggle(r.emoji)}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[15px] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    userReactions.includes(r.emoji) && 'bg-blue-50 dark:bg-blue-950/30',
                  )}
                  aria-label={r.label}
                  title={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
