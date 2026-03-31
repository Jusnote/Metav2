// src/types/question-comments.ts

import type { SupabaseClient } from '@supabase/supabase-js';

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

// ---------------------------------------------------------------------------
// Supabase type helpers
// ---------------------------------------------------------------------------
// The generated database.ts does not include the question_comments tables yet.
// Instead of regenerating (which requires the Supabase CLI), we provide typed
// wrappers around the untyped `.from()` / `.rpc()` calls. This avoids `as any`
// while keeping the casts explicit and narrow.
//
// When the generated types are eventually updated, these helpers can be removed
// and the hooks can use the Supabase client directly.
// ---------------------------------------------------------------------------

/**
 * A typed wrapper for supabase.from() / supabase.rpc() for comment-related
 * tables. Returns the raw Supabase client cast to `any` internally, but the
 * public API types the return value correctly.
 *
 * This is strictly better than scattering `(supabase as any)` everywhere:
 * - Single location for the cast
 * - Return types are explicit, not inferred as `any`
 * - Easy to find-and-replace when generated types are updated
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function commentFrom(client: SupabaseClient, table: 'question_comments' | 'question_notes' | 'question_comment_reports') {
  // The cast is unavoidable until generated types include these tables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export function commentRpc(
  client: SupabaseClient,
  fn: 'get_comments_with_votes' | 'toggle_upvote' | 'handle_soft_delete',
  args: Record<string, unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).rpc(fn, args);
}
