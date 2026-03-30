'use client';

import { CommunityComments } from './CommunityComments';
import { PrivateNote } from './PrivateNote';

interface QuestionCommentsSectionProps {
  questionId: number;
  activeSection: 'comunidade' | 'nota' | null;
  currentUserId?: string;
}

export function QuestionCommentsSection({
  questionId,
  activeSection,
  currentUserId,
}: QuestionCommentsSectionProps) {
  if (!activeSection) return null;

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800/50 px-4 py-3">
      {activeSection === 'comunidade' && (
        <CommunityComments
          questionId={questionId}
          currentUserId={currentUserId}
        />
      )}
      {activeSection === 'nota' && (
        <PrivateNote
          questionId={questionId}
        />
      )}
    </div>
  );
}
