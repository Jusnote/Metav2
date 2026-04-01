'use client';

import { useState, useCallback } from 'react';
import { type Value } from 'platejs';
import { CommunityComments } from './CommunityComments';
import { PrivateNote } from './PrivateNote';

interface QuestionCommentsSectionProps {
  questionId: number;
  activeSection: 'comunidade' | 'nota' | null;
  currentUserId?: string;
  /** Called when the section wants to change tabs (e.g. "Post to Community" switches to comunidade) */
  onSwitchTab?: (tab: 'comunidade' | 'nota') => void;
}

export function QuestionCommentsSection({
  questionId,
  activeSection,
  currentUserId,
  onSwitchTab,
}: QuestionCommentsSectionProps) {
  // Content pre-fill for "Post to Community" flow
  const [prefillContent, setPrefillContent] = useState<Value | null>(null);

  const handlePostToCommunity = useCallback(
    (content_json: Record<string, unknown>, content_text: string) => {
      // Build a Plate value from the note content
      const value = content_json as unknown as Value;
      setPrefillContent(value);
      // Switch to community tab
      onSwitchTab?.('comunidade');
    },
    [onSwitchTab]
  );

  if (!activeSection) return null;

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800/50 px-4 py-3">
      {activeSection === 'comunidade' && (
        <CommunityComments
          questionId={questionId}
          currentUserId={currentUserId}
          initialContent={prefillContent}
        />
      )}
      {activeSection === 'nota' && (
        <PrivateNote
          questionId={questionId}
          onPostToCommunity={handlePostToCommunity}
        />
      )}
    </div>
  );
}
