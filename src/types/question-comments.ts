// src/types/question-comments.ts

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface QuestionComment {
  id: string;
  question_id: number;
  user_id: string;
  root_id: string | null;
  reply_to_id: string | null;
  content_json: Record<string, unknown>;
  content_text: string;
  quoted_text: string | null;
  is_pinned: boolean;
  is_endorsed: boolean;
  is_deleted: boolean;
  is_author_shadowbanned: boolean;
  upvote_count: number;
  reply_count: number;
  edit_count: number;
  last_edited_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from get_comments_with_votes RPC
  has_upvoted: boolean;
  reaction_counts: Record<string, number>;  // e.g. {"❤️": 3, "🔥": 1}
  user_reactions: string[];                  // e.g. ["❤️", "🔥"]
  author_email?: string;
  author_name?: string;
  author_avatar_url?: string;
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

export type CommentSortOption = 'top' | 'recent' | 'teacher';

export interface CommentDraft {
  content_json: Record<string, unknown>;
  content_text: string;
  updated_at: number;
}

export const REACTION_EMOJIS = [
  { emoji: '❤️', label: 'Amei' },
  { emoji: '🔥', label: 'Destaque' },
  { emoji: '🎯', label: 'Preciso' },
  { emoji: '👏', label: 'Boa explicação' },
] as const;
