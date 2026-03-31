// src/types/moderation.ts

export type UserRole = 'admin' | 'moderator' | 'teacher' | 'user';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  teacher: 1,
  moderator: 2,
  admin: 3,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// --- Reports ---

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface ReportWithContext {
  id: string;
  comment_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Joined fields
  comment_content_text: string;
  comment_content_json: Record<string, unknown>;
  comment_author_email: string | null;
  comment_author_name: string | null;
  comment_question_id: number;
  reporter_email: string | null;
  reporter_name: string | null;
  report_count_by_reporter: number;
}

// --- Users ---

export interface ModerationUser {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_shadowbanned: boolean;
  timeout_until: string | null;
  timeout_reason: string | null;
  banned_by: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  comment_count: number;
  report_count_received: number;
  report_count_made: number;
}

// --- Audit Log ---

export type ModerationAction =
  | 'ban'
  | 'shadowban'
  | 'unban'
  | 'unshadowban'
  | 'role_change'
  | 'report_resolve'
  | 'report_dismiss'
  | 'delete_content';

export interface ModerationLogEntry {
  id: string;
  actor_id: string;
  target_type: string;
  target_id: string;
  action: ModerationAction;
  details: Record<string, unknown>;
  created_at: string;
  // Joined
  actor_email?: string;
  actor_name?: string;
}

// --- Stats ---

export interface ModerationStats {
  pending_reports: number;
  resolved_reports_period: number;
  avg_resolution_time_hours: number;
  active_bans: number;
}
