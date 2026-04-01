// src/types/comments.ts
// Shared comment types used across questoes and dispositivos.

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const REACTION_EMOJIS = [
  { emoji: '❤️', label: 'Amei' },
  { emoji: '🔥', label: 'Destaque' },
  { emoji: '🎯', label: 'Preciso' },
  { emoji: '👏', label: 'Boa explicação' },
] as const;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type CommentSortOption = 'top' | 'recent' | 'teacher';

export interface CommentDraft {
  content_json: Record<string, unknown>;
  content_text: string;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Base comment — fields shared by QuestionComment & DispositivoComment
// ---------------------------------------------------------------------------

export interface BaseComment {
  id: string;
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
  // Joined fields from RPC
  has_upvoted: boolean;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  author_email?: string;
  author_name?: string;
  author_avatar_url?: string;
}

// ---------------------------------------------------------------------------
// Dispositivo-specific types
// ---------------------------------------------------------------------------

export interface DispositivoComment extends BaseComment {
  dispositivo_id: string;
  lei_id: string;
}

export interface DispositivoNote {
  user_id: string;
  dispositivo_id: string;
  lei_id: string;
  content_json: Record<string, unknown>;
  content_text: string;
  created_at: string;
  updated_at: string;
}
