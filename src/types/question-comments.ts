// src/types/question-comments.ts

import type { BaseComment } from './comments';

// Re-export shared types so existing imports from this module keep working
export { REACTION_EMOJIS } from './comments';
export type { CommentSortOption, CommentDraft } from './comments';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface QuestionComment extends BaseComment {
  question_id: number;
}

export interface QuestionNote {
  user_id: string;
  question_id: number;
  content_json: Record<string, unknown>;
  content_text: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionCommentReport {
  id: string;
  comment_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  created_at: string;
}
