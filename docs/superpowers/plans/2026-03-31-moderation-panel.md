# Moderation Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete moderation dashboard at `/moderacao` with reports queue, user management, inline badges, and audit logging.

**Architecture:** Modular approach — each domain (reports, users) is an isolated module sharing a UI kit (Drawer, DataTable, StatusDot). Supabase RLS enforces permissions server-side; frontend guards are UX only. Dedicated layout (ModerationShell) with its own sidebar, separate from the study app.

**Tech Stack:** Next.js, React 19, Supabase (PostgreSQL + RLS + RPCs), React Query, shadcn/ui, Tailwind CSS, Lucide React, React Router

**Spec:** `docs/superpowers/specs/2026-03-31-moderation-panel-design.md`

---

## File Structure

### New files

```
src/types/moderation.ts                              — All moderation types
src/hooks/moderation/useUserRole.ts                  — Current user's role
src/hooks/moderation/useReports.ts                   — Reports query + mutations
src/hooks/moderation/useModerationUsers.ts           — Users list + mutations
src/hooks/moderation/useModerationLog.ts             — Audit log query
src/components/moderation/layout/ModerationRoute.tsx — Role guard wrapper
src/components/moderation/layout/ModerationShell.tsx — Layout: sidebar + main
src/components/moderation/layout/ModerationSidebar.tsx — Sidebar navigation
src/components/moderation/shared/StatusDot.tsx       — Severity dot with glow
src/components/moderation/shared/ActionBar.tsx       — Sticky bottom actions
src/components/moderation/shared/ModerationDrawer.tsx — Slide-in drawer
src/components/moderation/shared/ModerationDataTable.tsx — Reusable table
src/components/moderation/shared/Timeline.tsx        — Audit log timeline
src/components/moderation/shared/ContentPreview.tsx  — Content renderer by type
src/components/moderation/overview/OverviewPage.tsx  — Dashboard overview
src/components/moderation/overview/StatsCards.tsx     — 4 stat cards
src/components/moderation/reports/ReportsPage.tsx    — Full reports queue
src/components/moderation/reports/ReportDrawer.tsx   — Report detail drawer
src/components/moderation/reports/ReportFilters.tsx  — Filter controls
src/components/moderation/users/UsersPage.tsx        — User management table
src/components/moderation/users/UserDrawer.tsx       — User detail drawer
src/components/moderation/users/UserFilters.tsx      — User filter controls
src/components/questoes/comments/InlineReportBadge.tsx — Dot badge on comments
```

### Modified files

```
src/App.tsx                                          — Add /moderacao routes
src/components/questoes/comments/CommunityCommentItem.tsx — Add InlineReportBadge
src/components/AppSidebar.tsx                        — Add moderation link for mod/admin
```

---

## Task 1: Database — user_roles table + get_user_role function

**Files:**
- Create: SQL migration (run via Supabase dashboard or CLI)

- [ ] **Step 1: Create user_roles table**

Run in Supabase SQL editor:

```sql
-- Table
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'teacher', 'user')),
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Helper function used by RLS policies
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = p_user_id),
    'user'
  );
$$;
```

- [ ] **Step 2: Add RLS policies for user_roles**

```sql
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own role
CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Moderators and admins can read all roles
CREATE POLICY "Mods can read all roles"
  ON user_roles FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- Only admins can insert/update/delete roles
CREATE POLICY "Admins can manage roles"
  ON user_roles FOR ALL
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
```

- [ ] **Step 3: Insert your admin role**

```sql
INSERT INTO user_roles (user_id, role, granted_by)
SELECT id, 'admin', id
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';
```

- [ ] **Step 4: Verify setup**

```sql
SELECT get_user_role(auth.uid());
-- Expected: 'admin'
```

- [ ] **Step 5: Commit note**

This is a database migration — no git commit needed. Document in the spec that it was applied.

---

## Task 2: Database — moderation_log table

**Files:**
- Create: SQL migration (Supabase SQL editor)

- [ ] **Step 1: Create moderation_log table**

```sql
CREATE TABLE moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  target_type text NOT NULL CHECK (target_type IN ('user', 'comment', 'question', 'law_article')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'ban', 'shadowban', 'unban', 'unshadowban',
    'role_change', 'report_resolve', 'report_dismiss',
    'delete_content'
  )),
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_moderation_log_target ON moderation_log(target_type, target_id);
CREATE INDEX idx_moderation_log_actor ON moderation_log(actor_id);
CREATE INDEX idx_moderation_log_created ON moderation_log(created_at DESC);
```

- [ ] **Step 2: Add RLS policies**

```sql
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;

-- Only mods/admins can read logs
CREATE POLICY "Mods can read logs"
  ON moderation_log FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- Only mods/admins can insert logs
CREATE POLICY "Mods can insert logs"
  ON moderation_log FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'moderator'));
```

- [ ] **Step 3: Verify**

```sql
SELECT * FROM moderation_log LIMIT 1;
-- Expected: empty result set, no error (RLS allows read for admin)
```

---

## Task 3: Database — RLS for existing tables

**Files:**
- Modify: RLS policies on `question_comment_reports`

- [ ] **Step 1: Add mod read access to reports**

```sql
-- Mods/admins can read all reports
CREATE POLICY "Mods can read all reports"
  ON question_comment_reports FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- Mods/admins can update reports (resolve)
CREATE POLICY "Mods can update reports"
  ON question_comment_reports FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('admin', 'moderator'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'moderator'));
```

- [ ] **Step 2: Add mod access to user_moderation**

```sql
-- Mods/admins can read all user moderation status
CREATE POLICY "Mods can read user moderation"
  ON user_moderation FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- Mods/admins can update user moderation (ban/shadowban)
CREATE POLICY "Mods can update user moderation"
  ON user_moderation FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('admin', 'moderator'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'moderator'));

-- Mods/admins can insert user moderation records
CREATE POLICY "Mods can insert user moderation"
  ON user_moderation FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'moderator'));
```

---

## Task 4: Regenerate database types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerate types**

```bash
supabase gen types typescript --project-id xmtleqquivcukwgdexhc > src/types/database.ts
```

- [ ] **Step 2: Verify new tables appear**

Open `src/types/database.ts` and confirm `user_roles` and `moderation_log` tables are present.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerate database types with moderation tables"
```

---

## Task 5: Types — moderation.ts

**Files:**
- Create: `src/types/moderation.ts`

- [ ] **Step 1: Create moderation types**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types/moderation.ts
git commit -m "feat(moderation): add moderation types"
```

---

## Task 6: Hook — useUserRole

**Files:**
- Create: `src/hooks/moderation/useUserRole.ts`

- [ ] **Step 1: Create useUserRole hook**

```typescript
// src/hooks/moderation/useUserRole.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types/moderation';
import { hasRole } from '@/types/moderation';

export function useUserRole() {
  const query = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'user' as UserRole;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.role ?? 'user') as UserRole;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchOnWindowFocus: false,
  });

  return {
    role: query.data ?? 'user' as UserRole,
    isLoading: query.isLoading,
    isModerator: hasRole(query.data ?? 'user', 'moderator'),
    isAdmin: hasRole(query.data ?? 'user', 'admin'),
    isTeacher: hasRole(query.data ?? 'user', 'teacher'),
    hasRole: (required: UserRole) => hasRole(query.data ?? 'user', required),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/moderation/useUserRole.ts
git commit -m "feat(moderation): add useUserRole hook"
```

---

## Task 7: Layout — ModerationRoute guard

**Files:**
- Create: `src/components/moderation/layout/ModerationRoute.tsx`

- [ ] **Step 1: Create ModerationRoute**

```typescript
// src/components/moderation/layout/ModerationRoute.tsx
'use client';

import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/moderation/useUserRole';

export function ModerationRoute({ children }: { children: React.ReactNode }) {
  const { isModerator, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!isModerator) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/layout/ModerationRoute.tsx
git commit -m "feat(moderation): add ModerationRoute guard"
```

---

## Task 8: Layout — ModerationSidebar

**Files:**
- Create: `src/components/moderation/layout/ModerationSidebar.tsx`

- [ ] **Step 1: Create ModerationSidebar**

```typescript
// src/components/moderation/layout/ModerationSidebar.tsx
'use client';

import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Flag,
  Users,
  HelpCircle,
  BookOpen,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/moderation/useUserRole';
import { useReportCount } from '@/hooks/moderation/useReports';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

export function ModerationSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { role } = useUserRole();
  const pendingCount = useReportCount();

  const navItems: NavItem[] = [
    {
      label: 'Overview',
      href: '/moderacao',
      icon: <LayoutGrid className="h-[15px] w-[15px]" />,
    },
    {
      label: 'Reports',
      href: '/moderacao/reports',
      icon: <Flag className="h-[15px] w-[15px]" />,
      badge: pendingCount,
    },
    {
      label: 'Usuários',
      href: '/moderacao/usuarios',
      icon: <Users className="h-[15px] w-[15px]" />,
    },
    {
      label: 'Questões',
      href: '/moderacao/questoes',
      icon: <HelpCircle className="h-[15px] w-[15px]" />,
      disabled: true,
    },
  ];

  const futureItems: NavItem[] = [
    {
      label: 'Lei Seca',
      href: '/moderacao/lei-seca',
      icon: <BookOpen className="h-[15px] w-[15px]" />,
      disabled: true,
    },
    {
      label: 'Billing',
      href: '/moderacao/billing',
      icon: <CreditCard className="h-[15px] w-[15px]" />,
      disabled: true,
    },
  ];

  const isActive = (href: string) =>
    href === '/moderacao'
      ? location.pathname === '/moderacao'
      : location.pathname.startsWith(href);

  const userName = user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Usuário';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-[210px] shrink-0 flex-col border-r border-violet-100 bg-[#faf8ff]">
      {/* Logo */}
      <div className="px-5 pb-6 pt-5">
        <div className="flex items-center gap-[9px]">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-gradient-to-br from-violet-600 to-violet-400 text-[13px] font-bold text-white">
            M
          </div>
          <span className="text-[14px] font-bold tracking-tight text-violet-950">
            Moderação
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => !item.disabled && navigate(item.href)}
            disabled={item.disabled}
            className={cn(
              'flex w-full items-center gap-2 rounded-[7px] px-3 py-[7px] text-[13px] transition-all',
              isActive(item.href)
                ? 'bg-white font-semibold text-violet-600 shadow-[0_1px_3px_rgba(124,58,237,0.08)]'
                : item.disabled
                  ? 'cursor-default text-violet-300'
                  : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-700',
            )}
          >
            <span className={cn(
              isActive(item.href) ? 'text-violet-600' : item.disabled ? 'text-violet-300' : 'text-zinc-400',
            )}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {!!item.badge && item.badge > 0 && (
              <span className="min-w-[18px] rounded-full bg-violet-600 px-[7px] py-[2px] text-center text-[11px] font-semibold tabular-nums text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="mx-3 my-3 h-px bg-violet-100" />

        {futureItems.map((item) => (
          <button
            key={item.href}
            disabled
            className="flex w-full items-center gap-2 rounded-[7px] px-3 py-[7px] text-[12px] text-violet-300 cursor-default"
          >
            <span className="text-violet-300">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* User card */}
      <div className="mx-2 mb-3 rounded-lg bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-400 text-[11px] font-bold text-white">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-zinc-900">
              {userName}
            </div>
            <div className="text-[11px] font-medium capitalize text-violet-600">
              {role}
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-zinc-400 transition-colors hover:text-zinc-600"
            title="Voltar ao app"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/layout/ModerationSidebar.tsx
git commit -m "feat(moderation): add ModerationSidebar"
```

---

## Task 9: Layout — ModerationShell

**Files:**
- Create: `src/components/moderation/layout/ModerationShell.tsx`

- [ ] **Step 1: Create ModerationShell**

```typescript
// src/components/moderation/layout/ModerationShell.tsx
'use client';

import { Outlet } from 'react-router-dom';
import { ModerationSidebar } from './ModerationSidebar';

export function ModerationShell() {
  return (
    <div className="flex h-screen bg-[#f8f8f8]">
      <ModerationSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/layout/ModerationShell.tsx
git commit -m "feat(moderation): add ModerationShell layout"
```

---

## Task 10: Routing — add /moderacao to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports at top of App.tsx**

After the existing imports (around line 38), add:

```typescript
import { ModerationShell } from './components/moderation/layout/ModerationShell';
import { ModerationRoute } from './components/moderation/layout/ModerationRoute';
import { OverviewPage } from './components/moderation/overview/OverviewPage';
import { ReportsPage } from './components/moderation/reports/ReportsPage';
import { UsersPage } from './components/moderation/users/UsersPage';
```

- [ ] **Step 2: Add moderation routes**

Inside the `<Routes>` block (after the `<Route path="/" element={<AppContent />}>` closing tag, around line 180), add before the `<Route path="*">`:

```typescript
                  {/* Moderation Panel — separate layout */}
                  <Route
                    path="/moderacao"
                    element={
                      <PrivateRoute>
                        <ModerationRoute>
                          <ModerationShell />
                        </ModerationRoute>
                      </PrivateRoute>
                    }
                  >
                    <Route index element={<OverviewPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="usuarios" element={<UsersPage />} />
                  </Route>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(moderation): add /moderacao routes"
```

---

## Task 11: Shared UI — StatusDot

**Files:**
- Create: `src/components/moderation/shared/StatusDot.tsx`

- [ ] **Step 1: Create StatusDot**

```typescript
// src/components/moderation/shared/StatusDot.tsx
'use client';

import { cn } from '@/lib/utils';

type Severity = 'high' | 'medium' | 'resolved';

const SEVERITY_STYLES: Record<Severity, { dot: string; ring: string }> = {
  high: {
    dot: 'bg-red-500',
    ring: 'shadow-[0_0_0_3px_#fef2f2]',
  },
  medium: {
    dot: 'bg-amber-500',
    ring: 'shadow-[0_0_0_3px_#fffbeb]',
  },
  resolved: {
    dot: 'bg-zinc-300',
    ring: '',
  },
};

interface StatusDotProps {
  severity: Severity;
  size?: number;
  className?: string;
}

export function StatusDot({ severity, size = 7, className }: StatusDotProps) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <div
      className={cn(
        'shrink-0 rounded-full',
        styles.dot,
        severity !== 'resolved' && styles.ring,
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/shared/StatusDot.tsx
git commit -m "feat(moderation): add StatusDot component"
```

---

## Task 12: Shared UI — ActionBar

**Files:**
- Create: `src/components/moderation/shared/ActionBar.tsx`

- [ ] **Step 1: Create ActionBar**

```typescript
// src/components/moderation/shared/ActionBar.tsx
'use client';

import { cn } from '@/lib/utils';

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 flex items-center gap-2 border-t border-zinc-100 bg-white px-6 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/shared/ActionBar.tsx
git commit -m "feat(moderation): add ActionBar component"
```

---

## Task 13: Shared UI — ModerationDrawer

**Files:**
- Create: `src/components/moderation/shared/ModerationDrawer.tsx`

- [ ] **Step 1: Create ModerationDrawer**

```typescript
// src/components/moderation/shared/ModerationDrawer.tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModerationDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function ModerationDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 450,
}: ModerationDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/10 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full flex-col bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.06)]',
          'animate-in slide-in-from-right duration-200',
        )}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-zinc-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[12px] text-zinc-400">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/shared/ModerationDrawer.tsx
git commit -m "feat(moderation): add ModerationDrawer component"
```

---

## Task 14: Shared UI — ModerationDataTable

**Files:**
- Create: `src/components/moderation/shared/ModerationDataTable.tsx`

- [ ] **Step 1: Create ModerationDataTable**

```typescript
// src/components/moderation/shared/ModerationDataTable.tsx
'use client';

import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface ModerationDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

export function ModerationDataTable<T>({
  columns,
  data,
  onRowClick,
  rowKey,
  emptyMessage = 'Nenhum resultado encontrado',
}: ModerationDataTableProps<T>) {
  const gridCols = columns.map((c) => c.width ?? '1fr').join(' ');

  if (data.length === 0) {
    return (
      <div className="rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="py-12 text-center text-[13px] text-zinc-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div
        className="grid border-b border-zinc-100 bg-[#fafafa] px-[18px] py-[10px]"
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map((col) => (
          <span
            key={col.key}
            className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400"
          >
            {col.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      {data.map((row) => (
        <div
          key={rowKey(row)}
          className={cn(
            'grid items-center border-b border-[#fafafa] px-[18px] py-[13px] transition-colors',
            onRowClick && 'cursor-pointer hover:bg-[#faf8ff]',
          )}
          style={{ gridTemplateColumns: gridCols }}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((col) => (
            <div key={col.key}>{col.render(row)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/shared/ModerationDataTable.tsx
git commit -m "feat(moderation): add ModerationDataTable component"
```

---

## Task 15: Shared UI — Timeline

**Files:**
- Create: `src/components/moderation/shared/Timeline.tsx`

- [ ] **Step 1: Create Timeline**

```typescript
// src/components/moderation/shared/Timeline.tsx
'use client';

import type { ModerationLogEntry } from '@/types/moderation';

const ACTION_LABELS: Record<string, string> = {
  ban: 'Baniu o usuário',
  shadowban: 'Aplicou shadowban',
  unban: 'Removeu banimento',
  unshadowban: 'Removeu shadowban',
  role_change: 'Alterou role',
  report_resolve: 'Resolveu report (procedente)',
  report_dismiss: 'Resolveu report (improcedente)',
  delete_content: 'Deletou conteúdo',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

interface TimelineProps {
  entries: ModerationLogEntry[];
}

export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-[12px] text-zinc-400">
        Nenhuma ação registrada
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3 py-2.5">
          {/* Line */}
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-violet-300" />
            {i < entries.length - 1 && (
              <div className="w-px flex-1 bg-zinc-100" />
            )}
          </div>

          {/* Content */}
          <div className="-mt-0.5 min-w-0 flex-1">
            <p className="text-[12px] text-zinc-600">
              <span className="font-semibold text-zinc-900">
                {entry.actor_name ?? entry.actor_email ?? 'Sistema'}
              </span>{' '}
              {ACTION_LABELS[entry.action] ?? entry.action}
            </p>
            {entry.details && Object.keys(entry.details).length > 0 && (
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {entry.details.reason as string ??
                  (entry.details.role_from
                    ? `${entry.details.role_from} → ${entry.details.role_to}`
                    : null)}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-300">
              {relativeTime(entry.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/shared/Timeline.tsx
git commit -m "feat(moderation): add Timeline component"
```

---

## Task 16: Shared UI — ContentPreview

**Files:**
- Create: `src/components/moderation/shared/ContentPreview.tsx`

- [ ] **Step 1: Create ContentPreview**

```typescript
// src/components/moderation/shared/ContentPreview.tsx
'use client';

import { type Value } from 'platejs';
import { CommunityCommentStatic } from '@/components/questoes/comments/CommunityCommentStatic';

interface ContentPreviewProps {
  type: 'comment' | 'question' | 'law_article';
  contentJson?: Record<string, unknown>;
  contentText?: string;
  authorName?: string | null;
  authorEmail?: string | null;
  questionId?: number;
}

export function ContentPreview({
  type,
  contentJson,
  contentText,
  authorName,
  authorEmail,
}: ContentPreviewProps) {
  const displayName = authorName ?? authorEmail ?? 'Anônimo';

  return (
    <div className="rounded-lg border border-zinc-100 bg-[#fafafa] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          {type === 'comment' ? 'Comentário' : type === 'question' ? 'Questão' : 'Dispositivo Legal'}
        </span>
      </div>

      {type === 'comment' && contentJson ? (
        <>
          <p className="mb-2 text-[12px] font-medium text-zinc-500">
            por {displayName}
          </p>
          <div className="text-[13px] leading-[1.55] text-zinc-600">
            <CommunityCommentStatic value={contentJson as unknown as Value} />
          </div>
        </>
      ) : (
        <p className="text-[13px] text-zinc-600">
          {contentText ?? 'Conteúdo não disponível'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/shared/ContentPreview.tsx
git commit -m "feat(moderation): add ContentPreview component"
```

---

## Task 17: Hook — useReports + useReportCount

**Files:**
- Create: `src/hooks/moderation/useReports.ts`

- [ ] **Step 1: Create RPC in Supabase for reports with context**

Run in SQL editor:

```sql
CREATE OR REPLACE FUNCTION get_reports_with_context(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  comment_id uuid,
  reporter_id uuid,
  reason text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  comment_content_text text,
  comment_content_json jsonb,
  comment_author_email text,
  comment_author_name text,
  comment_question_id bigint,
  reporter_email text,
  reporter_name text,
  report_count_by_reporter bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    r.id,
    r.comment_id,
    r.reporter_id,
    r.reason,
    r.status,
    r.created_at,
    r.resolved_at,
    r.resolved_by,
    c.content_text AS comment_content_text,
    c.content_json AS comment_content_json,
    c.author_email AS comment_author_email,
    c.author_name AS comment_author_name,
    c.question_id AS comment_question_id,
    reporter_meta.raw_user_meta_data->>'email' AS reporter_email,
    reporter_meta.raw_user_meta_data->>'name' AS reporter_name,
    (SELECT count(*) FROM question_comment_reports r2 WHERE r2.reporter_id = r.reporter_id) AS report_count_by_reporter
  FROM question_comment_reports r
  JOIN question_comments c ON c.id = r.comment_id
  JOIN auth.users reporter_meta ON reporter_meta.id = r.reporter_id
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY
    CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
    r.created_at DESC;
$$;
```

- [ ] **Step 2: Create useReports hook**

```typescript
// src/hooks/moderation/useReports.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportWithContext } from '@/types/moderation';

export function useReports(statusFilter?: string) {
  return useQuery({
    queryKey: ['moderation-reports', statusFilter],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_reports_with_context', {
        p_status: statusFilter ?? null,
      });
      if (error) throw error;
      return (data ?? []) as ReportWithContext[];
    },
    staleTime: 30 * 1000,
  });
}

export function useReportCount() {
  const { data } = useQuery({
    queryKey: ['moderation-report-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('question_comment_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });
  return data ?? 0;
}

export function useReportMutations() {
  const queryClient = useQueryClient();

  const resolveReport = useMutation({
    mutationFn: async ({
      reportId,
      resolution,
    }: {
      reportId: string;
      resolution: 'resolve' | 'dismiss';
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update report status
      const { error: reportError } = await supabase
        .from('question_comment_reports')
        .update({
          status: resolution === 'resolve' ? 'resolved' : 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', reportId);
      if (reportError) throw reportError;

      // Log action
      const { error: logError } = await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'comment',
        target_id: reportId,
        action: resolution === 'resolve' ? 'report_resolve' : 'report_dismiss',
      });
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-report-count'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
    },
  });

  return {
    resolveReport: resolveReport.mutateAsync,
    isResolving: resolveReport.isPending,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/moderation/useReports.ts
git commit -m "feat(moderation): add useReports hook with resolve mutations"
```

---

## Task 18: Hook — useModerationUsers

**Files:**
- Create: `src/hooks/moderation/useModerationUsers.ts`

- [ ] **Step 1: Create RPC for users with moderation data**

```sql
CREATE OR REPLACE FUNCTION get_moderation_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  role text,
  is_shadowbanned boolean,
  timeout_until timestamptz,
  timeout_reason text,
  banned_by uuid,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  comment_count bigint,
  report_count_received bigint,
  report_count_made bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id AS user_id,
    u.raw_user_meta_data->>'email' AS email,
    u.raw_user_meta_data->>'name' AS name,
    u.raw_user_meta_data->>'avatar_url' AS avatar_url,
    COALESCE(ur.role, 'user') AS role,
    COALESCE(um.is_shadowbanned, false) AS is_shadowbanned,
    um.timeout_until,
    um.timeout_reason,
    um.banned_by,
    u.created_at,
    u.last_sign_in_at,
    (SELECT count(*) FROM question_comments qc WHERE qc.user_id = u.id) AS comment_count,
    (SELECT count(*) FROM question_comment_reports r
     JOIN question_comments c ON c.id = r.comment_id
     WHERE c.user_id = u.id) AS report_count_received,
    (SELECT count(*) FROM question_comment_reports r WHERE r.reporter_id = u.id) AS report_count_made
  FROM auth.users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN user_moderation um ON um.user_id = u.id
  ORDER BY u.created_at DESC;
$$;
```

- [ ] **Step 2: Create useModerationUsers hook**

```typescript
// src/hooks/moderation/useModerationUsers.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ModerationUser, UserRole } from '@/types/moderation';

export function useModerationUsers() {
  return useQuery({
    queryKey: ['moderation-users'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_moderation_users');
      if (error) throw error;
      return (data ?? []) as ModerationUser[];
    },
    staleTime: 60 * 1000,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current role
      const { data: current } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const previousRole = current?.role ?? 'user';

      // Upsert role
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: newRole, granted_by: user.id }, { onConflict: 'user_id' });
      if (error) throw error;

      // Log
      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: 'role_change',
        details: { role_from: previousRole, role_to: newRole },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  const toggleShadowban = useMutation({
    mutationFn: async ({ userId, shadowban }: { userId: string; shadowban: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_moderation')
        .upsert(
          { user_id: userId, is_shadowbanned: shadowban, banned_by: shadowban ? user.id : null },
          { onConflict: 'user_id' },
        );
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: shadowban ? 'shadowban' : 'unshadowban',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_moderation')
        .upsert(
          {
            user_id: userId,
            timeout_reason: reason,
            timeout_until: '9999-12-31T23:59:59Z', // permanent
            banned_by: user.id,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: 'ban',
        details: { reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  const unbanUser = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_moderation')
        .update({
          timeout_reason: null,
          timeout_until: null,
          banned_by: null,
          is_shadowbanned: false,
        })
        .eq('user_id', userId);
      if (error) throw error;

      await supabase.from('moderation_log').insert({
        actor_id: user.id,
        target_type: 'user',
        target_id: userId,
        action: 'unban',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-users'] });
    },
  });

  return {
    changeRole: changeRole.mutateAsync,
    toggleShadowban: toggleShadowban.mutateAsync,
    banUser: banUser.mutateAsync,
    unbanUser: unbanUser.mutateAsync,
    isChangingRole: changeRole.isPending,
    isBanning: banUser.isPending,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/moderation/useModerationUsers.ts
git commit -m "feat(moderation): add useModerationUsers hook with mutations"
```

---

## Task 19: Hook — useModerationLog

**Files:**
- Create: `src/hooks/moderation/useModerationLog.ts`

- [ ] **Step 1: Create RPC for log with actor info**

```sql
CREATE OR REPLACE FUNCTION get_moderation_log(
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  target_type text,
  target_id uuid,
  action text,
  details jsonb,
  created_at timestamptz,
  actor_email text,
  actor_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ml.id,
    ml.actor_id,
    ml.target_type,
    ml.target_id,
    ml.action,
    ml.details,
    ml.created_at,
    u.raw_user_meta_data->>'email' AS actor_email,
    u.raw_user_meta_data->>'name' AS actor_name
  FROM moderation_log ml
  JOIN auth.users u ON u.id = ml.actor_id
  WHERE (p_target_type IS NULL OR ml.target_type = p_target_type)
    AND (p_target_id IS NULL OR ml.target_id = p_target_id)
  ORDER BY ml.created_at DESC
  LIMIT p_limit;
$$;
```

- [ ] **Step 2: Create useModerationLog hook**

```typescript
// src/hooks/moderation/useModerationLog.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ModerationLogEntry } from '@/types/moderation';

export function useModerationLog(targetType?: string, targetId?: string) {
  return useQuery({
    queryKey: ['moderation-log', targetType, targetId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_moderation_log', {
        p_target_type: targetType ?? null,
        p_target_id: targetId ?? null,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as ModerationLogEntry[];
    },
    staleTime: 30 * 1000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/moderation/useModerationLog.ts
git commit -m "feat(moderation): add useModerationLog hook"
```

---

## Task 20: Hook — useModerationStats

**Files:**
- Modify: `src/hooks/moderation/useReports.ts` (add stats hook)

- [ ] **Step 1: Create RPC for stats**

```sql
CREATE OR REPLACE FUNCTION get_moderation_stats(p_days int DEFAULT 7)
RETURNS TABLE (
  pending_reports bigint,
  resolved_reports_period bigint,
  avg_resolution_time_hours numeric,
  active_bans bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    (SELECT count(*) FROM question_comment_reports WHERE status = 'pending') AS pending_reports,
    (SELECT count(*) FROM question_comment_reports
     WHERE status IN ('resolved', 'dismissed')
       AND resolved_at >= now() - (p_days || ' days')::interval) AS resolved_reports_period,
    COALESCE(
      (SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 1)
       FROM question_comment_reports
       WHERE resolved_at IS NOT NULL
         AND resolved_at >= now() - (p_days || ' days')::interval),
      0
    ) AS avg_resolution_time_hours,
    (SELECT count(*) FROM user_moderation
     WHERE timeout_until IS NOT NULL AND timeout_until > now()) AS active_bans;
$$;
```

- [ ] **Step 2: Add useModerationStats to useReports.ts**

Append to `src/hooks/moderation/useReports.ts`:

```typescript
export function useModerationStats(days: number = 7) {
  return useQuery({
    queryKey: ['moderation-stats', days],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_moderation_stats', {
        p_days: days,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as ModerationStats;
    },
    staleTime: 60 * 1000,
  });
}
```

Add the import at the top:
```typescript
import type { ReportWithContext, ModerationStats } from '@/types/moderation';
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/moderation/useReports.ts
git commit -m "feat(moderation): add useModerationStats hook"
```

---

## Task 21: Overview — StatsCards

**Files:**
- Create: `src/components/moderation/overview/StatsCards.tsx`

- [ ] **Step 1: Create StatsCards**

```typescript
// src/components/moderation/overview/StatsCards.tsx
'use client';

import type { ModerationStats } from '@/types/moderation';

interface StatsCardsProps {
  stats: ModerationStats | undefined;
  isLoading: boolean;
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-white p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        highlight ? 'border-violet-200' : 'border-zinc-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          {label}
        </span>
        {highlight && (
          <div className="h-2 w-2 rounded-full bg-violet-600" />
        )}
      </div>
      <div className="mt-2 text-[36px] font-extrabold leading-none tracking-[-1.5px] tabular-nums text-zinc-900">
        {value}
      </div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-[10px] border border-zinc-100 bg-white"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Pendentes"
        value={String(stats.pending_reports)}
        highlight
        sub={
          <span className="text-[12px] text-zinc-400">aguardando ação</span>
        }
      />
      <StatCard
        label="Resolvidos"
        value={String(stats.resolved_reports_period)}
        sub={
          <span className="text-[12px] text-emerald-500">nos últimos 7 dias</span>
        }
      />
      <StatCard
        label="Tempo médio"
        value={`${stats.avg_resolution_time_hours}`}
        sub={
          <span className="text-[12px] text-zinc-400">horas p/ resolução</span>
        }
      />
      <StatCard
        label="Banidos ativos"
        value={String(stats.active_bans)}
        sub={
          <span className="text-[12px] text-zinc-400">este período</span>
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/overview/StatsCards.tsx
git commit -m "feat(moderation): add StatsCards component"
```

---

## Task 22: Overview — OverviewPage

**Files:**
- Create: `src/components/moderation/overview/OverviewPage.tsx`

- [ ] **Step 1: Create OverviewPage**

```typescript
// src/components/moderation/overview/OverviewPage.tsx
'use client';

import { useState } from 'react';
import { useReports, useModerationStats } from '@/hooks/moderation/useReports';
import { StatsCards } from './StatsCards';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { StatusDot } from '../shared/StatusDot';
import { ModerationDrawer } from '../shared/ModerationDrawer';
import { ReportDrawer } from '../reports/ReportDrawer';
import type { ReportWithContext } from '@/types/moderation';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

const columns: Column<ReportWithContext>[] = [
  {
    key: 'content',
    label: 'Conteúdo',
    width: '1fr',
    render: (row) => (
      <div className="flex items-center gap-3">
        <StatusDot
          severity={
            row.status === 'pending'
              ? row.reason === 'offensive' ? 'high' : 'medium'
              : 'resolved'
          }
        />
        <span
          className={`truncate text-[13px] ${
            row.status === 'pending' ? 'font-medium text-zinc-900' : 'text-zinc-400'
          }`}
        >
          {row.comment_content_text?.slice(0, 80) || 'Sem texto'}
        </span>
      </div>
    ),
  },
  {
    key: 'type',
    label: 'Tipo',
    width: '90px',
    render: () => <span className="text-[12px] text-zinc-500">Comentário</span>,
  },
  {
    key: 'when',
    label: 'Quando',
    width: '90px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {relativeTime(row.created_at)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '80px',
    render: (row) => (
      <span
        className={`text-[11px] font-semibold ${
          row.status === 'pending' ? 'text-zinc-900' : 'text-zinc-400'
        }`}
      >
        {row.status === 'pending' ? 'Pendente' : 'Resolvido'}
      </span>
    ),
  },
];

export function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useModerationStats();
  const { data: reports, isLoading: reportsLoading } = useReports();
  const [selectedReport, setSelectedReport] = useState<ReportWithContext | null>(null);

  const recentReports = (reports ?? []).slice(0, 5);

  return (
    <>
      {/* Header */}
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Overview
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Atividade dos últimos 7 dias
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        <StatsCards stats={stats} isLoading={statsLoading} />

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[14px] font-bold tracking-[-0.2px] text-zinc-900">
              Reports recentes
            </span>
            <a
              href="/moderacao/reports"
              className="text-[12px] font-semibold text-violet-600"
            >
              Ver todos →
            </a>
          </div>
          <ModerationDataTable
            columns={columns}
            data={recentReports}
            onRowClick={setSelectedReport}
            rowKey={(r) => r.id}
            emptyMessage="Nenhum report encontrado"
          />
        </div>
      </div>

      {/* Drawer */}
      {selectedReport && (
        <ReportDrawer
          report={selectedReport}
          open={!!selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/overview/OverviewPage.tsx
git commit -m "feat(moderation): add OverviewPage"
```

---

## Task 23: Reports — ReportFilters + ReportsPage

**Files:**
- Create: `src/components/moderation/reports/ReportFilters.tsx`
- Create: `src/components/moderation/reports/ReportsPage.tsx`

- [ ] **Step 1: Create ReportFilters**

```typescript
// src/components/moderation/reports/ReportFilters.tsx
'use client';

import { cn } from '@/lib/utils';

interface ReportFiltersProps {
  status: string | undefined;
  onStatusChange: (status: string | undefined) => void;
}

const STATUSES = [
  { value: undefined, label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'dismissed', label: 'Descartados' },
];

export function ReportFilters({ status, onStatusChange }: ReportFiltersProps) {
  return (
    <div className="flex gap-1">
      {STATUSES.map((s) => (
        <button
          key={s.label}
          onClick={() => onStatusChange(s.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
            status === s.value
              ? 'bg-violet-100 text-violet-700'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ReportsPage**

```typescript
// src/components/moderation/reports/ReportsPage.tsx
'use client';

import { useState } from 'react';
import { useReports } from '@/hooks/moderation/useReports';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { StatusDot } from '../shared/StatusDot';
import { ReportDrawer } from './ReportDrawer';
import { ReportFilters } from './ReportFilters';
import type { ReportWithContext } from '@/types/moderation';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  incorrect: 'Incorreto',
  other: 'Outro',
};

const columns: Column<ReportWithContext>[] = [
  {
    key: 'content',
    label: 'Conteúdo',
    width: '1fr',
    render: (row) => (
      <div className="flex items-center gap-3">
        <StatusDot
          severity={
            row.status === 'pending'
              ? row.reason === 'offensive' ? 'high' : 'medium'
              : 'resolved'
          }
        />
        <span
          className={`truncate text-[13px] ${
            row.status === 'pending' ? 'font-medium text-zinc-900' : 'text-zinc-400'
          }`}
        >
          {row.comment_content_text?.slice(0, 80) || 'Sem texto'}
        </span>
      </div>
    ),
  },
  {
    key: 'reason',
    label: 'Motivo',
    width: '90px',
    render: (row) => (
      <span className="text-[12px] text-zinc-500">
        {REASON_LABELS[row.reason] ?? row.reason}
      </span>
    ),
  },
  {
    key: 'reporter',
    label: 'Reporter',
    width: '120px',
    render: (row) => (
      <span className="truncate text-[12px] text-zinc-500">
        {row.reporter_name ?? row.reporter_email ?? 'Anônimo'}
      </span>
    ),
  },
  {
    key: 'when',
    label: 'Quando',
    width: '90px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {relativeTime(row.created_at)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '80px',
    render: (row) => (
      <span
        className={`text-[11px] font-semibold ${
          row.status === 'pending' ? 'text-zinc-900' : 'text-zinc-400'
        }`}
      >
        {row.status === 'pending'
          ? 'Pendente'
          : row.status === 'resolved'
            ? 'Resolvido'
            : 'Descartado'}
      </span>
    ),
  },
];

export function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: reports, isLoading } = useReports(statusFilter);
  const [selectedReport, setSelectedReport] = useState<ReportWithContext | null>(null);

  return (
    <>
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Reports
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Fila de reports de comentários
            </p>
          </div>
          <ReportFilters status={statusFilter} onStatusChange={setStatusFilter} />
        </div>
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <ModerationDataTable
            columns={columns}
            data={reports ?? []}
            onRowClick={setSelectedReport}
            rowKey={(r) => r.id}
            emptyMessage="Nenhum report encontrado"
          />
        )}
      </div>

      {selectedReport && (
        <ReportDrawer
          report={selectedReport}
          open={!!selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/reports/ReportFilters.tsx src/components/moderation/reports/ReportsPage.tsx
git commit -m "feat(moderation): add ReportsPage with filters"
```

---

## Task 24: Reports — ReportDrawer

**Files:**
- Create: `src/components/moderation/reports/ReportDrawer.tsx`

- [ ] **Step 1: Create ReportDrawer**

```typescript
// src/components/moderation/reports/ReportDrawer.tsx
'use client';

import { ModerationDrawer } from '../shared/ModerationDrawer';
import { ActionBar } from '../shared/ActionBar';
import { ContentPreview } from '../shared/ContentPreview';
import { Timeline } from '../shared/Timeline';
import { StatusDot } from '../shared/StatusDot';
import { useReportMutations } from '@/hooks/moderation/useReports';
import { useModerationLog } from '@/hooks/moderation/useModerationLog';
import type { ReportWithContext } from '@/types/moderation';
import { toast } from 'sonner';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  incorrect: 'Incorreto',
  other: 'Outro',
};

interface ReportDrawerProps {
  report: ReportWithContext;
  open: boolean;
  onClose: () => void;
}

export function ReportDrawer({ report, open, onClose }: ReportDrawerProps) {
  const { resolveReport, isResolving } = useReportMutations();
  const { data: logEntries } = useModerationLog('comment', report.comment_id);

  const isPending = report.status === 'pending';

  const handleResolve = async (resolution: 'resolve' | 'dismiss') => {
    await resolveReport({ reportId: report.id, resolution });
    toast.success(resolution === 'resolve' ? 'Report resolvido' : 'Report descartado');
    onClose();
  };

  return (
    <ModerationDrawer
      open={open}
      onClose={onClose}
      title="Detalhes do Report"
      subtitle={`Questão #${report.comment_question_id}`}
      footer={
        isPending ? (
          <ActionBar>
            <button
              onClick={() => handleResolve('resolve')}
              disabled={isResolving}
              className="rounded-md bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              Procedente
            </button>
            <button
              onClick={() => handleResolve('dismiss')}
              disabled={isResolving}
              className="rounded-md bg-zinc-100 px-4 py-2 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              Improcedente
            </button>
          </ActionBar>
        ) : undefined
      }
    >
      {/* Status */}
      <div className="mb-5 flex items-center gap-2">
        <StatusDot
          severity={isPending ? (report.reason === 'offensive' ? 'high' : 'medium') : 'resolved'}
        />
        <span className="text-[13px] font-semibold text-zinc-900">
          {isPending ? 'Pendente' : 'Resolvido'}
        </span>
        <span className="text-[12px] text-zinc-400">
          — {REASON_LABELS[report.reason] ?? report.reason}
        </span>
      </div>

      {/* Content preview */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Conteúdo reportado
        </h3>
        <ContentPreview
          type="comment"
          contentJson={report.comment_content_json}
          contentText={report.comment_content_text}
          authorName={report.comment_author_name}
          authorEmail={report.comment_author_email}
          questionId={report.comment_question_id}
        />
      </div>

      {/* Reporter info */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Reportado por
        </h3>
        <div className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3">
          <p className="text-[13px] font-medium text-zinc-700">
            {report.reporter_name ?? report.reporter_email ?? 'Anônimo'}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-400">
            {report.report_count_by_reporter} reports feitos no total
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Timeline
        </h3>
        <Timeline entries={logEntries ?? []} />
      </div>
    </ModerationDrawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/reports/ReportDrawer.tsx
git commit -m "feat(moderation): add ReportDrawer with resolve actions"
```

---

## Task 25: Users — UserFilters + UsersPage + UserDrawer

**Files:**
- Create: `src/components/moderation/users/UserFilters.tsx`
- Create: `src/components/moderation/users/UsersPage.tsx`
- Create: `src/components/moderation/users/UserDrawer.tsx`

- [ ] **Step 1: Create UserFilters**

```typescript
// src/components/moderation/users/UserFilters.tsx
'use client';

import { cn } from '@/lib/utils';

interface UserFiltersProps {
  roleFilter: string | undefined;
  onRoleChange: (role: string | undefined) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

const ROLES = [
  { value: undefined, label: 'Todos' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderador' },
  { value: 'teacher', label: 'Professor' },
  { value: 'user', label: 'Usuário' },
];

export function UserFilters({ roleFilter, onRoleChange, search, onSearchChange }: UserFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por nome ou email..."
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700 placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300"
      />
      <div className="flex gap-1">
        {ROLES.map((r) => (
          <button
            key={r.label}
            onClick={() => onRoleChange(r.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              roleFilter === r.value
                ? 'bg-violet-100 text-violet-700'
                : 'text-zinc-500 hover:bg-zinc-100',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create UsersPage**

```typescript
// src/components/moderation/users/UsersPage.tsx
'use client';

import { useState, useMemo } from 'react';
import { useModerationUsers } from '@/hooks/moderation/useModerationUsers';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { UserDrawer } from './UserDrawer';
import { UserFilters } from './UserFilters';
import type { ModerationUser } from '@/types/moderation';

function getStatus(user: ModerationUser): string {
  if (user.timeout_until && new Date(user.timeout_until) > new Date()) return 'Banido';
  if (user.is_shadowbanned) return 'Shadowban';
  return 'Ativo';
}

const columns: Column<ModerationUser>[] = [
  {
    key: 'name',
    label: 'Usuário',
    width: '1fr',
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-[11px] font-bold text-white">
          {(row.name ?? row.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-900">
            {row.name ?? row.email?.split('@')[0] ?? 'Anônimo'}
          </p>
          <p className="truncate text-[11px] text-zinc-400">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    width: '90px',
    render: (row) => (
      <span className="text-[12px] capitalize text-zinc-500">{row.role}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '90px',
    render: (row) => {
      const status = getStatus(row);
      return (
        <span
          className={`text-[11px] font-semibold ${
            status === 'Ativo' ? 'text-zinc-500' : status === 'Banido' ? 'text-red-500' : 'text-amber-500'
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    key: 'comments',
    label: 'Comentários',
    width: '80px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {row.comment_count}
      </span>
    ),
  },
  {
    key: 'reports',
    label: 'Reports',
    width: '70px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {row.report_count_received}
      </span>
    ),
  },
];

export function UsersPage() {
  const { data: users, isLoading } = useModerationUsers();
  const [selectedUser, setSelectedUser] = useState<ModerationUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = users ?? [];
    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.name?.toLowerCase().includes(q)) ||
          (u.email?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [users, roleFilter, search]);

  return (
    <>
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Usuários
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Gestão de usuários e permissões
            </p>
          </div>
          <UserFilters
            roleFilter={roleFilter}
            onRoleChange={setRoleFilter}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <ModerationDataTable
            columns={columns}
            data={filtered}
            onRowClick={setSelectedUser}
            rowKey={(u) => u.user_id}
            emptyMessage="Nenhum usuário encontrado"
          />
        )}
      </div>

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Create UserDrawer**

```typescript
// src/components/moderation/users/UserDrawer.tsx
'use client';

import { useState } from 'react';
import { ModerationDrawer } from '../shared/ModerationDrawer';
import { ActionBar } from '../shared/ActionBar';
import { Timeline } from '../shared/Timeline';
import { useUserMutations } from '@/hooks/moderation/useModerationUsers';
import { useModerationLog } from '@/hooks/moderation/useModerationLog';
import { useUserRole } from '@/hooks/moderation/useUserRole';
import type { ModerationUser, UserRole } from '@/types/moderation';
import { toast } from 'sonner';

const ROLE_OPTIONS: UserRole[] = ['user', 'teacher', 'moderator', 'admin'];

interface UserDrawerProps {
  user: ModerationUser;
  open: boolean;
  onClose: () => void;
}

export function UserDrawer({ user, open, onClose }: UserDrawerProps) {
  const { isAdmin } = useUserRole();
  const { changeRole, toggleShadowban, banUser, unbanUser, isChangingRole, isBanning } = useUserMutations();
  const { data: logEntries } = useModerationLog('user', user.user_id);
  const [banReason, setBanReason] = useState('');

  const isBanned = user.timeout_until && new Date(user.timeout_until) > new Date();
  const displayName = user.name ?? user.email?.split('@')[0] ?? 'Anônimo';

  const handleRoleChange = async (newRole: UserRole) => {
    await changeRole({ userId: user.user_id, newRole });
    toast.success(`Role alterada para ${newRole}`);
  };

  const handleToggleShadowban = async () => {
    await toggleShadowban({ userId: user.user_id, shadowban: !user.is_shadowbanned });
    toast.success(user.is_shadowbanned ? 'Shadowban removido' : 'Shadowban aplicado');
  };

  const handleBan = async () => {
    if (!banReason.trim()) {
      toast.error('Motivo obrigatório para banimento');
      return;
    }
    await banUser({ userId: user.user_id, reason: banReason });
    toast.success('Usuário banido');
    setBanReason('');
    onClose();
  };

  const handleUnban = async () => {
    await unbanUser({ userId: user.user_id });
    toast.success('Banimento removido');
  };

  return (
    <ModerationDrawer
      open={open}
      onClose={onClose}
      title={displayName}
      subtitle={user.email}
      footer={
        <ActionBar>
          <button
            onClick={handleToggleShadowban}
            className="rounded-md bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            {user.is_shadowbanned ? 'Remover Shadowban' : 'Shadowban'}
          </button>
          {isBanned ? (
            <button
              onClick={handleUnban}
              className="rounded-md bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              Desbanir
            </button>
          ) : (
            <button
              onClick={handleBan}
              disabled={isBanning}
              className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              Banir
            </button>
          )}
        </ActionBar>
      }
    >
      {/* Avatar + Role */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-400 text-lg font-bold text-white">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-[15px] font-bold text-zinc-900">{displayName}</p>
          {isAdmin ? (
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              disabled={isChangingRole}
              className="mt-0.5 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[12px] font-medium text-violet-700 focus:outline-none"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] font-medium capitalize text-violet-600">
              {user.role}
            </span>
          )}
        </div>
      </div>

      {/* Activity stats */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Atividade
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Comentários', value: user.comment_count },
            { label: 'Reports recebidos', value: user.report_count_received },
            { label: 'Reports feitos', value: user.report_count_made },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3">
              <p className="text-[11px] text-zinc-400">{stat.label}</p>
              <p className="text-[18px] font-bold tabular-nums text-zinc-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Ban reason input (only shown if not already banned) */}
      {!isBanned && (
        <div className="mb-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
            Motivo do banimento
          </h3>
          <input
            type="text"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Obrigatório para banir..."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-700 placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300"
          />
        </div>
      )}

      {/* Timeline */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Histórico de moderação
        </h3>
        <Timeline entries={logEntries ?? []} />
      </div>
    </ModerationDrawer>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/moderation/users/
git commit -m "feat(moderation): add UsersPage, UserDrawer, UserFilters"
```

---

## Task 26: Inline Report Badge

**Files:**
- Create: `src/components/questoes/comments/InlineReportBadge.tsx`
- Modify: `src/components/questoes/comments/CommunityCommentItem.tsx`

- [ ] **Step 1: Create InlineReportBadge**

```typescript
// src/components/questoes/comments/InlineReportBadge.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/moderation/useUserRole';
import { ReportDrawer } from '@/components/moderation/reports/ReportDrawer';
import type { ReportWithContext } from '@/types/moderation';

interface InlineReportBadgeProps {
  commentId: string;
}

export function InlineReportBadge({ commentId }: InlineReportBadgeProps) {
  const { isModerator } = useUserRole();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: reports } = useQuery({
    queryKey: ['inline-report-count', commentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('question_comment_reports')
        .select('*')
        .eq('comment_id', commentId)
        .eq('status', 'pending');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isModerator,
    staleTime: 60 * 1000,
  });

  // Fetch full report for drawer
  const { data: fullReport } = useQuery({
    queryKey: ['inline-report-detail', commentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_reports_with_context', {
        p_status: 'pending',
      });
      if (error) throw error;
      const found = (data as ReportWithContext[])?.find(
        (r) => r.comment_id === commentId,
      );
      return found ?? null;
    },
    enabled: isModerator && drawerOpen,
  });

  if (!isModerator || !reports || reports.length === 0) return null;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDrawerOpen(true);
        }}
        className="flex items-center gap-1 text-[11px] tabular-nums text-violet-600"
        title={`${reports.length} report(s) pendente(s)`}
      >
        <div className="h-[6px] w-[6px] rounded-full bg-violet-600" />
        {reports.length}
      </button>

      {drawerOpen && fullReport && (
        <ReportDrawer
          report={fullReport}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add InlineReportBadge to CommunityCommentItem**

In `src/components/questoes/comments/CommunityCommentItem.tsx`, add import at top:

```typescript
import { InlineReportBadge } from './InlineReportBadge';
```

Then after the `{comment.is_endorsed && <EndorsedBadge />}` line (around line 89), add:

```typescript
                <InlineReportBadge commentId={comment.id} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/comments/InlineReportBadge.tsx src/components/questoes/comments/CommunityCommentItem.tsx
git commit -m "feat(moderation): add InlineReportBadge on comments"
```

---

## Task 27: Add moderation link to AppSidebar

**Files:**
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Add moderation nav item**

In `src/components/AppSidebar.tsx`, add import at top:

```typescript
import { IconShield } from "@tabler/icons-react";
import { useUserRole } from "@/hooks/moderation/useUserRole";
```

Inside the component function (around line 65), add:

```typescript
const { isModerator } = useUserRole();
```

In the `toolsNavigation` array, add a conditional moderation item. After line 63 (after the tools array closing), add a new computed array:

```typescript
const moderationNav: NavItem[] = isModerator
  ? [{ label: "Moderação", href: "/moderacao", icon: <IconShield className="h-5 w-5" /> }]
  : [];
```

Then update `allNavItems` to include it:

```typescript
const allNavItems = [...mainNavigation, ...toolsNavigation, ...moderationNav];
```

And render the moderation section in the desktop sidebar between tools nav and bottom section (around line 121, after tools nav closing):

```typescript
            {isModerator && (
              <>
                <div className="my-3 mx-1 border-t border-white/[0.06]" />
                <nav className="flex flex-col gap-1">
                  {moderationNav.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => handleNavClick(item)}
                      className={cn(
                        "flex items-center justify-center h-9 w-9 rounded-md transition-all duration-150 relative",
                        isActive(item.href)
                          ? "bg-violet-500/20 text-violet-300"
                          : "bg-transparent text-[#6B6760] hover:text-violet-300 hover:bg-violet-500/10"
                      )}
                      title={item.label}
                    >
                      {item.icon}
                      {isActive(item.href) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-violet-400 rounded-r" />
                      )}
                    </button>
                  ))}
                </nav>
              </>
            )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat(moderation): add moderation link to app sidebar"
```

---

## Task 28: Final verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual testing checklist**

1. Login as admin user
2. Navigate to `/moderacao` — should see Overview with stats and table
3. Click a report row — drawer opens with detail
4. Navigate to `/moderacao/reports` — full reports list with filters
5. Navigate to `/moderacao/usuarios` — user list with filters
6. Click a user — drawer opens with activity and actions
7. Go to `/questoes` — check that inline badges appear on reported comments
8. Logout and login as regular user — `/moderacao` should redirect to `/`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(moderation): complete moderation panel phase 1"
```
