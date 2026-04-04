'use client';

import { type Value } from 'platejs';
import { CommentEditor } from '@/components/shared/comments/CommentEditor';

// ---------------------------------------------------------------------------
// Types — preserve original interface for backward compatibility
// ---------------------------------------------------------------------------

export interface CommunityCommentEditorProps {
  questionId: number;
  mode: 'new' | 'reply' | 'edit' | 'note';
  replyToName?: string;
  initialValue?: Value;
  draftContext?: string;
  onSubmit: (content_json: Record<string, unknown>, content_text: string) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component — thin wrapper delegating to shared CommentEditor
// ---------------------------------------------------------------------------

export function CommunityCommentEditor({
  questionId,
  mode,
  replyToName,
  initialValue,
  draftContext = 'new',
  onSubmit,
  onCancel,
  isSubmitting = false,
  placeholder,
}: CommunityCommentEditorProps) {
  return (
    <CommentEditor
      questionId={questionId}
      entityType="question"
      entityId={questionId}
      mode={mode}
      replyToName={replyToName}
      initialValue={initialValue}
      draftContext={draftContext}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      placeholder={placeholder}
    />
  );
}
