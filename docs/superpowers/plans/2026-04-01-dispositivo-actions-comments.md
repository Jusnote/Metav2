# Dispositivo Actions Refactor + Inline Comments & Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the dispositivo gutter (like toggle + incidence + footer badges), extract shared comment components from questões, and implement a full inline comments + notes system for Lei Seca dispositivos.

**Architecture:** Three phases — (1) Database + types foundation, (2) Shared component extraction + gutter refactor, (3) Dispositivo comments/notes integration. Accordion behavior (one footer open at a time) managed by DispositivoList. All per-dispositivo data (likes, comment counts, note flags) fetched per-lei in batch to avoid N+1.

**Tech Stack:** Next.js 15, React 19, Supabase (PostgreSQL + RPCs + RLS), React Query, Platejs, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-01-dispositivo-actions-comments-design.md`

**Important:** This codebase is in a git worktree. The files on `main` branch differ from this worktree. Use `git show main:path/to/file` to read current main versions when needed, and merge main into this branch before starting implementation.

---

## Phase 1: Database + Types Foundation

### Task 1: Merge main into worktree branch

**Files:**
- No file changes — git operations only

- [ ] **Step 1: Merge main into current branch**

```bash
cd "D:\meta novo\Metav2\.claude\worktrees\questoes-filter-bar"
git merge main --no-edit
```

Expected: All main branch files (DispositivoActions, DispositivoRenderer, DispositivoList, etc.) now available in the worktree. Resolve conflicts if any.

- [ ] **Step 2: Verify key files exist**

```bash
ls src/components/lei-seca/dispositivos/DispositivoActions.tsx
ls src/components/lei-seca/dispositivos/DispositivoRenderer.tsx
ls src/components/lei-seca/dispositivos/DispositivoList.tsx
ls src/hooks/useDispositivoReactions.ts
```

Expected: All 4 files exist.

- [ ] **Step 3: Commit merge**

```bash
git add -A
git status
```

---

### Task 2: Create Supabase migration — tables, indexes, RLS

**Files:**
- Create: `supabase/migrations/20260401000000_dispositivo_comments_notes_likes.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================
-- Dispositivo Likes
-- =============================================================
create table dispositivo_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dispositivo_id text not null,
  lei_id text not null,
  created_at timestamptz default now(),
  unique(user_id, dispositivo_id)
);

alter table dispositivo_likes enable row level security;

create policy "Users can read own likes"
  on dispositivo_likes for select
  using (auth.uid() = user_id);

create policy "Users can insert own likes"
  on dispositivo_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on dispositivo_likes for delete
  using (auth.uid() = user_id);

create index idx_disp_likes_lei_user
  on dispositivo_likes (lei_id, user_id);

-- =============================================================
-- Dispositivo Comments
-- =============================================================
create table dispositivo_comments (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id text not null,
  lei_id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  root_id uuid references dispositivo_comments(id) on delete cascade,
  reply_to_id uuid references dispositivo_comments(id) on delete set null,
  content_json jsonb not null default '{}',
  content_text text not null default '',
  quoted_text text,
  is_pinned boolean default false,
  is_endorsed boolean default false,
  is_deleted boolean default false,
  is_author_shadowbanned boolean default false,
  upvote_count integer default 0,
  reply_count integer default 0,
  edit_count integer default 0,
  last_edited_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table dispositivo_comments enable row level security;

create policy "Users can read non-shadowbanned comments"
  on dispositivo_comments for select
  using (
    not is_author_shadowbanned
    or auth.uid() = user_id
  );

create policy "Users can insert own comments"
  on dispositivo_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own comments"
  on dispositivo_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on dispositivo_comments for delete
  using (auth.uid() = user_id);

create index idx_disp_comments_lookup
  on dispositivo_comments (lei_id, dispositivo_id, is_pinned desc, upvote_count desc);

create index idx_disp_comments_user
  on dispositivo_comments (user_id, created_at desc);

-- =============================================================
-- Dispositivo Comment Reactions
-- =============================================================
create table dispositivo_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references dispositivo_comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(user_id, comment_id, emoji)
);

alter table dispositivo_comment_reactions enable row level security;

create policy "Users can read all reactions"
  on dispositivo_comment_reactions for select
  using (true);

create policy "Users can insert own reactions"
  on dispositivo_comment_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own reactions"
  on dispositivo_comment_reactions for delete
  using (auth.uid() = user_id);

create index idx_disp_comment_reactions_comment
  on dispositivo_comment_reactions (comment_id);

-- =============================================================
-- Dispositivo Comment Upvotes
-- =============================================================
create table dispositivo_comment_upvotes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references dispositivo_comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, comment_id)
);

alter table dispositivo_comment_upvotes enable row level security;

create policy "Users can read all upvotes"
  on dispositivo_comment_upvotes for select
  using (true);

create policy "Users can insert own upvotes"
  on dispositivo_comment_upvotes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own upvotes"
  on dispositivo_comment_upvotes for delete
  using (auth.uid() = user_id);

create index idx_disp_comment_upvotes_comment
  on dispositivo_comment_upvotes (comment_id);

-- =============================================================
-- Dispositivo Notes (personal, one per user/dispositivo)
-- =============================================================
create table dispositivo_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dispositivo_id text not null,
  lei_id text not null,
  content_json jsonb not null default '{}',
  content_text text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, dispositivo_id)
);

alter table dispositivo_notes enable row level security;

create policy "Users can read own notes"
  on dispositivo_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on dispositivo_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on dispositivo_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notes"
  on dispositivo_notes for delete
  using (auth.uid() = user_id);

create index idx_disp_notes_user_disp
  on dispositivo_notes (user_id, dispositivo_id);
```

- [ ] **Step 2: Run migration against Supabase**

Run the SQL in the Supabase dashboard SQL editor or via CLI:

```bash
npx supabase db push
```

Expected: All 5 tables created with RLS policies and indexes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260401000000_dispositivo_comments_notes_likes.sql
git commit -m "feat(db): create dispositivo likes, comments, notes tables with RLS and indexes"
```

---

### Task 3: Create Supabase RPCs

**Files:**
- Create: `supabase/migrations/20260401000001_dispositivo_rpcs.sql`

- [ ] **Step 1: Write the RPCs migration**

```sql
-- =============================================================
-- toggle_dispositivo_like: insert or delete, returns 'liked' | 'unliked'
-- =============================================================
create or replace function toggle_dispositivo_like(
  p_dispositivo_id text,
  p_lei_id text
)
returns text
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
begin
  select id into v_existing
  from dispositivo_likes
  where user_id = v_user_id and dispositivo_id = p_dispositivo_id;

  if v_existing is not null then
    delete from dispositivo_likes where id = v_existing;
    return 'unliked';
  else
    insert into dispositivo_likes (user_id, dispositivo_id, lei_id)
    values (v_user_id, p_dispositivo_id, p_lei_id);
    return 'liked';
  end if;
end;
$$;

-- =============================================================
-- get_dispositivo_likes: returns liked dispositivo IDs for a lei
-- =============================================================
create or replace function get_dispositivo_likes(
  p_lei_id text,
  p_user_id uuid
)
returns table(dispositivo_id text)
language sql stable security definer
as $$
  select dispositivo_id
  from dispositivo_likes
  where lei_id = p_lei_id and user_id = p_user_id;
$$;

-- =============================================================
-- get_dispositivo_comments_with_votes: full comment data with user state
-- =============================================================
create or replace function get_dispositivo_comments_with_votes(
  p_dispositivo_id text,
  p_lei_id text,
  p_user_id uuid
)
returns table(
  id uuid,
  dispositivo_id text,
  lei_id text,
  user_id uuid,
  root_id uuid,
  reply_to_id uuid,
  content_json jsonb,
  content_text text,
  quoted_text text,
  is_pinned boolean,
  is_endorsed boolean,
  is_deleted boolean,
  is_author_shadowbanned boolean,
  upvote_count integer,
  reply_count integer,
  edit_count integer,
  last_edited_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  has_upvoted boolean,
  reaction_counts jsonb,
  user_reactions jsonb,
  author_email text,
  author_name text,
  author_avatar_url text
)
language sql stable security definer
as $$
  select
    c.id, c.dispositivo_id, c.lei_id, c.user_id,
    c.root_id, c.reply_to_id,
    c.content_json, c.content_text, c.quoted_text,
    c.is_pinned, c.is_endorsed, c.is_deleted, c.is_author_shadowbanned,
    c.upvote_count, c.reply_count, c.edit_count,
    c.last_edited_at, c.created_at, c.updated_at,
    -- has_upvoted
    exists(
      select 1 from dispositivo_comment_upvotes u
      where u.comment_id = c.id and u.user_id = p_user_id
    ) as has_upvoted,
    -- reaction_counts: {"❤️": 3, "🔥": 1}
    coalesce(
      (select jsonb_object_agg(r.emoji, r.cnt)
       from (select emoji, count(*)::int as cnt
             from dispositivo_comment_reactions
             where comment_id = c.id
             group by emoji) r),
      '{}'::jsonb
    ) as reaction_counts,
    -- user_reactions: ["❤️"]
    coalesce(
      (select jsonb_agg(emoji)
       from dispositivo_comment_reactions
       where comment_id = c.id and user_id = p_user_id),
      '[]'::jsonb
    ) as user_reactions,
    -- author info from auth.users
    au.email as author_email,
    coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name') as author_name,
    au.raw_user_meta_data->>'avatar_url' as author_avatar_url
  from dispositivo_comments c
  left join auth.users au on au.id = c.user_id
  where c.dispositivo_id = p_dispositivo_id
    and c.lei_id = p_lei_id
    and (not c.is_author_shadowbanned or c.user_id = p_user_id)
  order by c.is_pinned desc, c.upvote_count desc, c.created_at asc;
$$;

-- =============================================================
-- toggle_dispositivo_comment_upvote
-- =============================================================
create or replace function toggle_dispositivo_comment_upvote(
  p_comment_id uuid
)
returns text
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
begin
  select id into v_existing
  from dispositivo_comment_upvotes
  where user_id = v_user_id and comment_id = p_comment_id;

  if v_existing is not null then
    delete from dispositivo_comment_upvotes where id = v_existing;
    update dispositivo_comments set upvote_count = greatest(upvote_count - 1, 0)
    where id = p_comment_id;
    return 'removed';
  else
    insert into dispositivo_comment_upvotes (user_id, comment_id)
    values (v_user_id, p_comment_id);
    update dispositivo_comments set upvote_count = upvote_count + 1
    where id = p_comment_id;
    return 'added';
  end if;
end;
$$;

-- =============================================================
-- toggle_dispositivo_comment_reaction
-- =============================================================
create or replace function toggle_dispositivo_comment_reaction(
  p_comment_id uuid,
  p_emoji text
)
returns text
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
begin
  select id into v_existing
  from dispositivo_comment_reactions
  where user_id = v_user_id and comment_id = p_comment_id and emoji = p_emoji;

  if v_existing is not null then
    delete from dispositivo_comment_reactions where id = v_existing;
    return 'removed';
  else
    insert into dispositivo_comment_reactions (user_id, comment_id, emoji)
    values (v_user_id, p_comment_id, p_emoji);
    return 'added';
  end if;
end;
$$;

-- =============================================================
-- handle_dispositivo_soft_delete: soft delete with reply_count update
-- =============================================================
create or replace function handle_dispositivo_soft_delete(
  p_comment_id uuid
)
returns void
language plpgsql security definer
as $$
declare
  v_root_id uuid;
begin
  select root_id into v_root_id
  from dispositivo_comments where id = p_comment_id;

  update dispositivo_comments
  set is_deleted = true, content_json = '{}', content_text = '', updated_at = now()
  where id = p_comment_id and user_id = auth.uid();

  if v_root_id is not null then
    update dispositivo_comments
    set reply_count = greatest(reply_count - 1, 0)
    where id = v_root_id;
  end if;
end;
$$;

-- =============================================================
-- Batch RPCs for gutter badges (per-lei, avoids N+1)
-- =============================================================
create or replace function get_dispositivo_comment_counts(
  p_lei_id text
)
returns table(dispositivo_id text, count bigint)
language sql stable security definer
as $$
  select dispositivo_id, count(*)
  from dispositivo_comments
  where lei_id = p_lei_id
    and root_id is null
    and not is_deleted
  group by dispositivo_id;
$$;

create or replace function get_dispositivo_note_flags(
  p_lei_id text,
  p_user_id uuid
)
returns table(dispositivo_id text)
language sql stable security definer
as $$
  select dispositivo_id
  from dispositivo_notes
  where lei_id = p_lei_id and user_id = p_user_id;
$$;
```

- [ ] **Step 2: Run RPCs migration**

Run the SQL in the Supabase dashboard SQL editor or via CLI:

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260401000001_dispositivo_rpcs.sql
git commit -m "feat(db): add dispositivo RPCs — likes, comments, upvotes, reactions, batch counts"
```

---

### Task 4: Create shared comment types

**Files:**
- Create: `src/types/comments.ts`
- Modify: `src/types/question-comments.ts`

- [ ] **Step 1: Create the shared BaseComment interface**

Create `src/types/comments.ts`:

```typescript
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
  has_upvoted: boolean;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  author_email?: string;
  author_name?: string;
  author_avatar_url?: string;
}

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
```

- [ ] **Step 2: Update QuestionComment to extend BaseComment**

In `src/types/question-comments.ts`, replace the `QuestionComment` interface and remove duplicated types:

```typescript
import type { BaseComment, CommentSortOption, CommentDraft } from './comments';

export type { CommentSortOption, CommentDraft };
export { REACTION_EMOJIS } from './comments';

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
```

- [ ] **Step 3: Verify no import breaks**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to QuestionComment, CommentSortOption, CommentDraft, or REACTION_EMOJIS.

- [ ] **Step 4: Commit**

```bash
git add src/types/comments.ts src/types/question-comments.ts
git commit -m "feat(types): extract BaseComment interface, QuestionComment extends it"
```

---

## Phase 2: Shared Components + Gutter Refactor

### Task 5: Extract shared comment components from questões

**Files:**
- Create: `src/components/shared/comments/CommentItem.tsx`
- Create: `src/components/shared/comments/CommentEditor.tsx`
- Create: `src/components/shared/comments/CommentStatic.tsx`
- Create: `src/components/shared/comments/CommentVoteButton.tsx`
- Create: `src/components/shared/comments/CommentReactionButtons.tsx`
- Create: `src/components/shared/comments/CommentContextMenu.tsx`
- Create: `src/components/shared/comments/MobileCommentEditor.tsx`
- Create: `src/components/shared/comments/MobileEditorToolbar.tsx`
- Create: `src/components/shared/comments/MobileToolbarSheet.tsx`
- Modify: `src/components/questoes/comments/CommunityComments.tsx` (update imports)
- Modify: `src/components/questoes/comments/QuestionCommentsSection.tsx` (update imports if needed)

This is a large task. The approach:

1. **Move** each file from `questoes/comments/` to `shared/comments/` with the new name
2. **Generalize** the component props to accept `BaseComment` instead of `QuestionComment` where applicable
3. **Update imports** in the questões orchestrators to point to the new shared location
4. **Leave** `CommunityComments.tsx`, `CommunityCommentReplies.tsx`, `PrivateNote.tsx`, and `QuestionCommentsSection.tsx` in `questoes/comments/` — they are domain-specific orchestrators

- [ ] **Step 1: Create the shared directory and move files**

For each file, read the current version from main, update the type imports to use `BaseComment` where the component doesn't need `question_id`, and write to the new location.

Key changes per file:
- `CommentItem.tsx`: Change prop type from `QuestionComment` to `BaseComment`. Replace `questionId: number` prop with `entityType: string` and `entityId: string | number`. Import `BaseComment` from `@/types/comments`. Add optional `outdatedThreshold?: string` prop — if `comment.created_at < outdatedThreshold`, render amber badge "⚠️ Comentário anterior à última atualização da lei".
- `CommentEditor.tsx`: Already generic (accepts `onSubmit`, `mode`, etc.) — move as-is, only update mobile imports. Add optional `onChange?: (content_json, content_text) => void` callback for unmount save ref pattern.
- `CommentStatic.tsx`: No type dependencies — move as-is.
- `CommentVoteButton.tsx`: No type dependencies — move as-is.
- `CommentReactionButtons.tsx`: Change `questionId` prop to `entityType` + `entityId`. The hook call changes — the parent passes toggle handler as a prop instead of the component calling hooks directly. This decouples the reaction logic from the comment system.
- `CommentContextMenu.tsx`: No type dependencies — move as-is.
- `MobileCommentEditor.tsx`: Move as-is, update internal imports.
- `MobileEditorToolbar.tsx`: Move as-is.
- `MobileToolbarSheet.tsx`: Move as-is.

Also check for `CollapsedThread.tsx` and `CommunityCommentReplies.tsx` — if they exist in `questoes/comments/`, they should also be moved to shared (they handle thread collapsing and reply rendering).

**Draft hook:** The existing `useCommentDraft` uses localStorage with key `comment_draft_{questionId}_{context}`. When moving to shared, make the key format `comment_draft_{entityType}_{entityId}_{context}` to avoid collisions (per Section 11.2 of spec). The `CommentEditor` shared component should accept `entityType` and `entityId` props to construct the correct draft key.

- [ ] **Step 2: Update all imports in questões orchestrators**

In `CommunityComments.tsx`, replace:
```typescript
// Before
import { CommunityCommentItem } from './CommunityCommentItem';
import { CommunityCommentEditor } from './CommunityCommentEditor';
import { CommunityCommentStatic } from './CommunityCommentStatic';

// After
import { CommentItem } from '@/components/shared/comments/CommentItem';
import { CommentEditor } from '@/components/shared/comments/CommentEditor';
```

In `CommunityCommentItem.tsx` (if kept as wrapper), update to re-export or redirect. Or delete entirely if `CommentItem` is used directly.

- [ ] **Step 3: Verify questões still work**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/comments/ src/components/questoes/comments/
git commit -m "refactor: extract shared comment components from questões"
```

---

### Task 6: Create dispositivo likes hooks

**Files:**
- Create: `src/hooks/useDispositivoLikes.ts`

- [ ] **Step 1: Write the hooks**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Fetches all liked dispositivo IDs for a lei (single batch request).
 * Returns a Set<string> for O(1) lookups in DispositivoGutter.
 */
export function useDispositivoLikes(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-likes', leiId],
    queryFn: async () => {
      if (!leiId || !user?.id) return new Set<string>();

      const { data, error } = await (supabase as any).rpc('get_dispositivo_likes', {
        p_lei_id: leiId,
        p_user_id: user.id,
      });

      if (error) throw error;
      return new Set<string>((data ?? []).map((r: { dispositivo_id: string }) => r.dispositivo_id));
    },
    enabled: !!leiId && !!user?.id,
    staleTime: 60 * 1000,
  });
}

/**
 * Toggle like on a dispositivo. Optimistic update on the likes Set.
 */
export function useToggleDispositivoLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dispositivoId, leiId }: { dispositivoId: string; leiId: string }) => {
      const { data, error } = await (supabase as any).rpc('toggle_dispositivo_like', {
        p_dispositivo_id: dispositivoId,
        p_lei_id: leiId,
      });
      if (error) throw error;
      return data as string; // 'liked' | 'unliked'
    },
    onMutate: async ({ dispositivoId, leiId }) => {
      const queryKey = ['dispositivo-likes', leiId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey);

      queryClient.setQueryData<Set<string>>(queryKey, (old) => {
        const next = new Set(old);
        if (next.has(dispositivoId)) {
          next.delete(dispositivoId);
        } else {
          next.add(dispositivoId);
        }
        return next;
      });

      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispositivo-likes', variables.leiId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDispositivoLikes.ts
git commit -m "feat: add useDispositivoLikes and useToggleDispositivoLike hooks"
```

---

### Task 7: Create incidência stub hook

**Files:**
- Create: `src/hooks/useLeiIncidencia.ts`

- [ ] **Step 1: Write the stub hook**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Fetches question incidence data for all dispositivos in a lei.
 * Returns a Record<dispositivoId, count> dictionary.
 *
 * STUB: Returns empty dict until FastAPI endpoint is ready.
 * When ready, replace queryFn with actual API call.
 */
export function useLeiIncidencia(leiId: string | undefined) {
  return useQuery({
    queryKey: ['lei-incidencia', leiId],
    queryFn: async (): Promise<Record<string, number>> => {
      // TODO: Replace with actual FastAPI call when pipeline is ready
      // const res = await fetch(`${FASTAPI_URL}/incidencia/${leiId}`);
      // return res.json();
      return {};
    },
    enabled: !!leiId,
    staleTime: 5 * 60 * 1000, // 5 min — incidence data is stable
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLeiIncidencia.ts
git commit -m "feat: add useLeiIncidencia stub hook (returns empty until FastAPI ready)"
```

---

### Task 8: Create batch badge hooks (comment counts + note flags)

**Files:**
- Create: `src/hooks/useDispositivoBadges.ts`

- [ ] **Step 1: Write the batch hooks**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Fetches comment counts for all dispositivos in a lei (single batch request).
 * Returns Record<dispositivoId, count> for gutter badge display.
 */
export function useDispositivoCommentCounts(leiId: string | undefined) {
  return useQuery({
    queryKey: ['dispositivo-comment-counts', leiId],
    queryFn: async () => {
      if (!leiId) return {} as Record<string, number>;

      const { data, error } = await (supabase as any).rpc('get_dispositivo_comment_counts', {
        p_lei_id: leiId,
      });

      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[row.dispositivo_id] = Number(row.count);
      }
      return map;
    },
    enabled: !!leiId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches which dispositivos the user has notes for (single batch request).
 * Returns Set<dispositivoId> for gutter badge display.
 */
export function useDispositivoNoteFlags(leiId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dispositivo-note-flags', leiId],
    queryFn: async () => {
      if (!leiId || !user?.id) return new Set<string>();

      const { data, error } = await (supabase as any).rpc('get_dispositivo_note_flags', {
        p_lei_id: leiId,
        p_user_id: user.id,
      });

      if (error) throw error;
      return new Set<string>((data ?? []).map((r: { dispositivo_id: string }) => r.dispositivo_id));
    },
    enabled: !!leiId && !!user?.id,
    staleTime: 30 * 1000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDispositivoBadges.ts
git commit -m "feat: add batch hooks for comment counts and note flags (per-lei)"
```

---

### Task 9: Create DispositivoGutter component

**Files:**
- Create: `src/components/lei-seca/dispositivos/DispositivoGutter.tsx`

- [ ] **Step 1: Write the pure presentational gutter component**

```typescript
'use client';

interface DispositivoGutterProps {
  liked: boolean;
  onToggleLike: () => void;
  incidencia: number | null;
  commentsCount: number;
  hasNote: boolean;
  footerOpen: boolean;
  onToggleFooter: () => void;
}

export function DispositivoGutter({
  liked,
  onToggleLike,
  incidencia,
  commentsCount,
  hasNote,
  footerOpen,
  onToggleFooter,
}: DispositivoGutterProps) {
  const hasContent = liked || commentsCount > 0 || hasNote;

  return (
    <div
      className={`flex items-center flex-shrink-0 ml-3 pt-[6px] transition-opacity duration-200 ${
        hasContent ? 'opacity-100' : 'opacity-0 group-hover/disp:opacity-100'
      }`}
    >
      {/* Zone 1: Like toggle */}
      <div className="flex items-center px-[5px]">
        <button
          onClick={onToggleLike}
          className={`w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
            liked
              ? 'text-[15px] hover:bg-[#f5f5f4] hover:scale-110'
              : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#dc7c7c]'
          }`}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
        >
          {liked ? '❤️' : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </button>
      </div>

      <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

      {/* Zone 2: Question incidence */}
      <div className="flex items-center gap-[3px] px-[5px]">
        {incidencia !== null && incidencia > 0 ? (
          <span className="flex items-center gap-[2px] px-[5px] py-[2px] rounded-lg text-[12px] font-[Inter,sans-serif]">
            🔥 <span className="text-[9px] text-[#bbb] font-semibold">{incidencia}</span>
          </span>
        ) : (
          <span className="text-[9px] text-[#ddd] font-[Inter,sans-serif] px-[2px]">—</span>
        )}
      </div>

      <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

      {/* Zone 3: More + badges */}
      <div className="flex items-center px-[5px]">
        <button
          onClick={onToggleFooter}
          className={`h-[26px] flex items-center gap-[3px] px-[5px] rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
            footerOpen
              ? 'bg-[#f0f0ef] text-[#555]'
              : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#888]'
          }`}
          aria-label="Ações do dispositivo"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
          {(commentsCount > 0 || hasNote) && (
            <span className="flex items-center gap-[2px] ml-[1px]">
              {commentsCount > 0 && (
                <span className="flex items-center gap-[1px] text-[9px] font-[Inter,sans-serif] text-[#7c3aed]">
                  💬<span className="text-[8px] font-bold">{commentsCount}</span>
                </span>
              )}
              {commentsCount > 0 && hasNote && (
                <span className="w-px h-[8px] bg-[#e8e8e6]" />
              )}
              {hasNote && (
                <span className="text-[9px] text-[#d97706]">✏️</span>
              )}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoGutter.tsx
git commit -m "feat: add DispositivoGutter pure component (like + incidence + badges)"
```

---

### Task 10: Refactor DispositivoRenderer — remove render prop, use DispositivoGutter

**Files:**
- Modify: `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx`

- [ ] **Step 1: Rewrite DispositivoRenderer**

Read the current file, then replace the `DispositivoActions` usage with direct composition. Key changes:

1. Remove `DispositivoActions` import
2. Add `DispositivoGutter` import
3. Add `footerOpen`, `onToggleFooter`, `liked`, `onToggleLike`, `incidencia`, `commentsCount`, `hasNote` as props
4. Remove the render prop `children(gutter, below)` pattern
5. Compose directly: flex row with content + gutter, footer below

New props interface additions:
```typescript
interface Props {
  // ... existing props (item, leiId, leiSecaMode, showRevogados, grifos, etc.) ...
  footerOpen: boolean;
  onToggleFooter: () => void;
  liked: boolean;
  onToggleLike: () => void;
  incidencia: number | null;
  commentsCount: number;
  hasNote: boolean;
}
```

The render section becomes:
```tsx
return (
  <div className="group/disp" id={`disp_${item.id}`}>
    <div className="flex items-start">
      <div className="flex-1 min-w-0">{content}</div>
      {leiId && (
        <DispositivoGutter
          liked={liked}
          onToggleLike={onToggleLike}
          incidencia={incidencia}
          commentsCount={commentsCount}
          hasNote={hasNote}
          footerOpen={footerOpen}
          onToggleFooter={onToggleFooter}
        />
      )}
    </div>
    {footerOpen && (
      <DispositivoFooter
        texto={item.texto}
        dispositivoId={String(item.id)}
        leiId={leiId!}
        commentsCount={commentsCount}
        hasNote={hasNote}
        onReport={() => { setReportOpen(true); onToggleFooter(); }}
      />
    )}
    {reportOpen && (
      <LeiReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        dispositivoId={String(item.id)}
        leiId={leiId!}
        dispositivoTipo={item.tipo}
        dispositivoNumero={String(item.posicao)}
        dispositivoTexto={item.texto}
      />
    )}
    {/* grifo notes unchanged */}
    {noteOpenGrifo && onSaveNote && (
      <GrifoNoteInline grifoId={noteOpenGrifo.id} color={noteOpenGrifo.color} initialNote={noteOpenGrifo.note} onSave={onSaveNote} onCancel={() => grifoPopupStore.closeNote()} />
    )}
    {!noteOpenGrifo && grifosWithNotes.length > 0 && <NoteBadge grifos={grifosWithNotes} />}
  </div>
);
```

Note: `id={`disp_${item.id}`}` added for deep linking (Section 12.2 of spec).

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoRenderer.tsx
git commit -m "refactor: replace DispositivoActions render prop with direct DispositivoGutter composition"
```

---

### Task 11: Refactor DispositivoList — accordion + batch data

**Files:**
- Modify: `src/components/lei-seca/dispositivos/DispositivoList.tsx`

- [ ] **Step 1: Add accordion state and new props to DispositivoList**

Key changes:
1. Add `useState<string | null>(null)` for `openFooterId` (accordion)
2. Add new props: `likesSet`, `incidenciaMap`, `commentCountsMap`, `noteFlagsSet`, `onToggleLike`
3. Pass all data down to `DispositivoRenderer`
4. Remove `reactionsMap` and `onToggleReaction` props (old reaction system)

```typescript
interface DispositivoListProps {
  dispositivos: Dispositivo[]
  leiId?: string
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifosByDispositivo?: Map<string, Grifo[]>
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  onSaveNote?: (grifoId: string, note: string) => void
  // New: batch data from parent
  likesSet?: Set<string>
  onToggleLike?: (dispositivoId: string) => void
  incidenciaMap?: Record<string, number>
  commentCountsMap?: Record<string, number>
  noteFlagsSet?: Set<string>
}
```

In the render, pass data to `DispositivoRenderer`:
```tsx
<DispositivoRenderer
  item={entry.item}
  leiId={leiId}
  leiSecaMode={leiSecaMode}
  showRevogados={showRevogados}
  grifos={grifosByDispositivo?.get(entry.item.id) ?? []}
  onGrifoClick={onGrifoClick}
  onSaveNote={onSaveNote}
  noteOpenGrifoId={noteOpenGrifoId}
  // Accordion
  footerOpen={openFooterId === String(entry.item.id)}
  onToggleFooter={() => setOpenFooterId(prev =>
    prev === String(entry.item.id) ? null : String(entry.item.id)
  )}
  // Batch data
  liked={likesSet?.has(String(entry.item.id)) ?? false}
  onToggleLike={() => onToggleLike?.(String(entry.item.id))}
  incidencia={incidenciaMap?.[String(entry.item.id)] ?? null}
  commentsCount={commentCountsMap?.[String(entry.item.id)] ?? 0}
  hasNote={noteFlagsSet?.has(String(entry.item.id)) ?? false}
/>
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoList.tsx
git commit -m "refactor: add accordion state and batch data props to DispositivoList"
```

---

### Task 12: Update LeiSecaPage — wire new hooks, remove old ones

**Files:**
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Replace old hooks with new ones**

Key changes:
1. Remove `useDispositivoReactions` and `useToggleDispositivoReaction` imports
2. Remove `leiCommentsStore` and `useLeiCommentsOpen` imports
3. Add imports for new hooks: `useDispositivoLikes`, `useToggleDispositivoLike`, `useLeiIncidencia`, `useDispositivoCommentCounts`, `useDispositivoNoteFlags`
4. Remove `LeiCommentsPanel` dynamic import
5. Wire new data to `DispositivoList` props

```typescript
// New hook calls
const { data: likesSet } = useDispositivoLikes(currentLeiId);
const toggleLike = useToggleDispositivoLike();
const { data: incidenciaMap } = useLeiIncidencia(currentLeiId);
const { data: commentCountsMap } = useDispositivoCommentCounts(currentLeiId);
const { data: noteFlagsSet } = useDispositivoNoteFlags(currentLeiId);

const handleToggleLike = useCallback((dispositivoId: string) => {
  if (!currentLeiId) return;
  toggleLike.mutate({ dispositivoId, leiId: currentLeiId });
}, [currentLeiId, toggleLike]);
```

Pass to `DispositivoList`:
```tsx
<DispositivoList
  dispositivos={dispositivos}
  leiId={currentLeiId}
  leiSecaMode={leiSecaMode}
  showRevogados={showRevogados}
  grifosByDispositivo={grifosByDispositivo}
  onGrifoClick={handleGrifoClick}
  onSaveNote={handleSaveNote}
  likesSet={likesSet}
  onToggleLike={handleToggleLike}
  incidenciaMap={incidenciaMap}
  commentCountsMap={commentCountsMap}
  noteFlagsSet={noteFlagsSet}
/>
```

Remove the old `LeiCommentsPanel` from the sidebar render, and the `mobilePanel === 'comments'` MobileSheet.

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/views/LeiSecaPage.tsx
git commit -m "refactor: wire new hooks in LeiSecaPage, remove old reactions and comments panel"
```

---

## Phase 3: Comments + Notes Integration

### Task 13: Create parametrized comment hooks for dispositivos

**Files:**
- Create: `src/hooks/useDispositivoComments.ts`
- Create: `src/hooks/useDispositivoCommentMutations.ts`
- Create: `src/hooks/useToggleDispositivoCommentUpvote.ts`
- Create: `src/hooks/useToggleDispositivoCommentReaction.ts`

- [ ] **Step 1: Write useDispositivoComments**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DispositivoComment } from '@/types/comments';

export function useDispositivoComments(dispositivoId: string | null, leiId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['comments', 'dispositivo', dispositivoId, leiId],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any).rpc('get_dispositivo_comments_with_votes', {
        p_dispositivo_id: dispositivoId!,
        p_lei_id: leiId!,
        p_user_id: user.id,
      });
      if (error) throw error;
      return (data ?? []) as DispositivoComment[];
    },
    enabled: !!dispositivoId && !!leiId && !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 2: Write useDispositivoCommentMutations**

Mirror `useCommentMutations.ts` but targeting `dispositivo_comments` table. Include `createComment`, `editComment`, `deleteComment`, `pinComment`, `endorseComment`. All mutations invalidate `['comments', 'dispositivo', dispositivoId, leiId]` and also `['dispositivo-comment-counts', leiId]`.

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useDispositivoCommentMutations(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const commentKey = ['comments', 'dispositivo', dispositivoId, leiId];
  const countKey = ['dispositivo-comment-counts', leiId];

  const createComment = useMutation({
    mutationFn: async (params: {
      content_json: Record<string, unknown>;
      content_text: string;
      root_id?: string | null;
      reply_to_id?: string | null;
      quoted_text?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('dispositivo_comments').insert({
        dispositivo_id: dispositivoId!,
        lei_id: leiId!,
        user_id: user.id,
        content_json: params.content_json,
        content_text: params.content_text,
        root_id: params.root_id ?? null,
        reply_to_id: params.reply_to_id ?? null,
        quoted_text: params.quoted_text ?? null,
      }).select().single();
      if (error) throw error;

      // Increment reply_count on root if this is a reply
      if (params.root_id) {
        await supabase.from('dispositivo_comments')
          .update({ reply_count: supabase.sql`reply_count + 1` } as any)
          .eq('id', params.root_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKey });
      queryClient.invalidateQueries({ queryKey: countKey });
    },
  });

  const editComment = useMutation({
    mutationFn: async (params: { commentId: string; content_json: Record<string, unknown>; content_text: string }) => {
      const { error } = await supabase.from('dispositivo_comments')
        .update({
          content_json: params.content_json,
          content_text: params.content_text,
          edit_count: supabase.sql`edit_count + 1` as any,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKey });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await (supabase as any).rpc('handle_dispositivo_soft_delete', {
        p_comment_id: commentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKey });
      queryClient.invalidateQueries({ queryKey: countKey });
    },
  });

  const pinComment = useMutation({
    mutationFn: async ({ commentId, isPinned }: { commentId: string; isPinned: boolean }) => {
      const { error } = await supabase.from('dispositivo_comments')
        .update({ is_pinned: isPinned })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKey });
    },
  });

  const endorseComment = useMutation({
    mutationFn: async ({ commentId, isEndorsed }: { commentId: string; isEndorsed: boolean }) => {
      const { error } = await supabase.from('dispositivo_comments')
        .update({ is_endorsed: isEndorsed })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKey });
    },
  });

  return {
    createComment: createComment.mutateAsync,
    editComment: editComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
    pinComment: pinComment.mutateAsync,
    endorseComment: endorseComment.mutateAsync,
    isCreating: createComment.isPending,
    isEditing: editComment.isPending,
    isDeleting: deleteComment.isPending,
    isPinning: pinComment.isPending,
    isEndorsing: endorseComment.isPending,
  };
}
```

- [ ] **Step 3: Write useToggleDispositivoCommentUpvote**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DispositivoComment } from '@/types/comments';

export function useToggleDispositivoCommentUpvote(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['comments', 'dispositivo', dispositivoId, leiId];

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await (supabase as any).rpc('toggle_dispositivo_comment_upvote', {
        p_comment_id: commentId,
      });
      if (error) throw error;
      return data as string;
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DispositivoComment[]>(queryKey);

      queryClient.setQueryData<DispositivoComment[]>(queryKey, (old) =>
        (old ?? []).map(c =>
          c.id === commentId
            ? { ...c, has_upvoted: !c.has_upvoted, upvote_count: c.has_upvoted ? c.upvote_count - 1 : c.upvote_count + 1 }
            : c
        )
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
```

- [ ] **Step 4: Write useToggleDispositivoCommentReaction**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DispositivoComment } from '@/types/comments';

export function useToggleDispositivoCommentReaction(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['comments', 'dispositivo', dispositivoId, leiId];

  return useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      const { data, error } = await (supabase as any).rpc('toggle_dispositivo_comment_reaction', {
        p_comment_id: commentId,
        p_emoji: emoji,
      });
      if (error) throw error;
      return data as string;
    },
    onMutate: async ({ commentId, emoji }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DispositivoComment[]>(queryKey);

      queryClient.setQueryData<DispositivoComment[]>(queryKey, (old) =>
        (old ?? []).map(c => {
          if (c.id !== commentId) return c;
          const hasReaction = c.user_reactions.includes(emoji);
          const newUserReactions = hasReaction
            ? c.user_reactions.filter(e => e !== emoji)
            : [...c.user_reactions, emoji];
          const newCounts = { ...c.reaction_counts };
          if (hasReaction) {
            newCounts[emoji] = (newCounts[emoji] ?? 1) - 1;
            if (newCounts[emoji] <= 0) delete newCounts[emoji];
          } else {
            newCounts[emoji] = (newCounts[emoji] ?? 0) + 1;
          }
          return { ...c, user_reactions: newUserReactions, reaction_counts: newCounts };
        })
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDispositivoComments.ts src/hooks/useDispositivoCommentMutations.ts src/hooks/useToggleDispositivoCommentUpvote.ts src/hooks/useToggleDispositivoCommentReaction.ts
git commit -m "feat: add dispositivo comment hooks (fetch, mutations, upvote, reaction)"
```

---

### Task 14: Create useDispositivoNote hook

**Files:**
- Create: `src/hooks/useDispositivoNote.ts`

- [ ] **Step 1: Write the hook (mirrors useQuestionNote)**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DispositivoNote } from '@/types/comments';

export function useDispositivoNote(dispositivoId: string | null, leiId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['dispositivo-note', dispositivoId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.from('dispositivo_notes')
        .select('*')
        .eq('dispositivo_id', dispositivoId!)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as DispositivoNote | null;
    },
    enabled: !!dispositivoId && !!user,
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (params: { content_json: Record<string, unknown>; content_text: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('dispositivo_notes')
        .upsert({
          user_id: user.id,
          dispositivo_id: dispositivoId!,
          lei_id: leiId!,
          content_json: params.content_json,
          content_text: params.content_text,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,dispositivo_id' })
        .select()
        .single();
      if (error) throw error;
      return data as DispositivoNote;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      // Also update the note flags batch cache
      queryClient.invalidateQueries({ queryKey: ['dispositivo-note-flags', leiId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('dispositivo_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('dispositivo_id', dispositivoId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      queryClient.invalidateQueries({ queryKey: ['dispositivo-note-flags', leiId] });
    },
  });

  return {
    note: query.data ?? null,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDispositivoNote.ts
git commit -m "feat: add useDispositivoNote hook (upsert, delete, cache sync)"
```

---

### Task 15: Create DispositivoNote component

**Files:**
- Create: `src/components/lei-seca/comments/DispositivoNote.tsx`

- [ ] **Step 1: Write the component (mirrors PrivateNote pattern)**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispositivoNote } from '@/hooks/useDispositivoNote';
import { CommentEditor } from '@/components/shared/comments/CommentEditor';
import { CommentStatic } from '@/components/shared/comments/CommentStatic';
import { Pencil, Trash2 } from 'lucide-react';

interface DispositivoNoteProps {
  dispositivoId: string;
  leiId: string;
}

export function DispositivoNote({ dispositivoId, leiId }: DispositivoNoteProps) {
  const { note, isLoading, save, remove, isSaving, isRemoving } = useDispositivoNote(dispositivoId, leiId);
  const [isEditing, setIsEditing] = useState(false);

  // Auto-open editor if no note exists after loading
  useEffect(() => {
    if (!isLoading && !note) setIsEditing(true);
  }, [isLoading, note]);

  // Unmount save: keep current value in ref, save on cleanup
  const contentRef = useRef<{ content_json: Record<string, unknown>; content_text: string } | null>(null);
  const savedRef = useRef(note);
  savedRef.current = note;

  useEffect(() => {
    return () => {
      const current = contentRef.current;
      const saved = savedRef.current;
      if (current && current.content_text && current.content_text !== (saved?.content_text ?? '')) {
        save(current); // fire-and-forget on unmount
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="mt-1 px-3 py-3 bg-[#fffdf5] rounded-[8px] animate-pulse">
        <div className="h-3 bg-amber-100 rounded w-2/3 mb-2" />
        <div className="h-3 bg-amber-100 rounded w-1/2" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="mt-1" style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
        <CommentEditor
          mode="note"
          initialValue={note?.content_json ? [note.content_json] as any : undefined}
          placeholder="Escreva sua anotação pessoal..."
          isSubmitting={isSaving}
          onSubmit={async (content_json, content_text) => {
            contentRef.current = { content_json, content_text };
            await save({ content_json, content_text });
            setIsEditing(false);
          }}
          onCancel={() => {
            if (note) setIsEditing(false);
          }}
          onChange={(content_json, content_text) => {
            contentRef.current = { content_json, content_text };
          }}
        />
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="mt-1 px-3 py-3 bg-[#fffdf5] border border-[#fef3c7] rounded-[8px]" style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <CommentStatic content={note.content_json} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 rounded text-amber-600/60 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            aria-label="Editar nota"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={async () => {
              await remove();
              setIsEditing(true);
            }}
            disabled={isRemoving}
            className="p-1 rounded text-amber-600/40 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Excluir nota"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/comments/DispositivoNote.tsx
git commit -m "feat: add DispositivoNote component with auto-save on unmount"
```

---

### Task 16: Create DispositivoCommunityComments orchestrator

**Files:**
- Create: `src/components/lei-seca/comments/DispositivoCommunityComments.tsx`

- [ ] **Step 1: Write the orchestrator (mirrors CommunityComments pattern)**

This is the largest component. It mirrors `CommunityComments.tsx` but for dispositivos. Key differences:
- Uses `useDispositivoComments(dispositivoId, leiId)` instead of `useQuestionComments(questionId)`
- Uses `useDispositivoCommentMutations(dispositivoId, leiId)` instead of `useCommentMutations(questionId)`
- Uses `useToggleDispositivoCommentUpvote` and `useToggleDispositivoCommentReaction`
- Accepts optional `leiUpdatedAt` for outdated comment badge (Section 12.1)
- Same threading, sorting, editor management, mobile collapse logic

Props:
```typescript
interface DispositivoCommunityCommentsProps {
  dispositivoId: string;
  leiId: string;
  leiUpdatedAt?: string; // For outdated badge
}
```

The component follows the exact same structure as `CommunityComments.tsx`:
- Fetch comments via hook
- Derive roots, replies, repliesByRoot, sortedRoots
- Manage `activeEditor` state (new | reply | edit)
- Render: sort controls, comment list (with collapse on mobile), editor
- Pass `entityType: 'dispositivo'` and `entityId: dispositivoId` to shared `CommentItem`

For the outdated badge, pass `outdatedThreshold={leiUpdatedAt}` to each `CommentItem`. The `CommentItem` shared component renders:
```tsx
{outdatedThreshold && new Date(comment.created_at) < new Date(outdatedThreshold) && (
  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
    ⚠️ Comentário anterior à última atualização da lei
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/comments/DispositivoCommunityComments.tsx
git commit -m "feat: add DispositivoCommunityComments orchestrator with outdated badge"
```

---

### Task 17: Create DispositivoCommentsSection tab switcher

**Files:**
- Create: `src/components/lei-seca/comments/DispositivoCommentsSection.tsx`

- [ ] **Step 1: Write the tab switcher (mirrors QuestionCommentsSection)**

```typescript
'use client';

import { DispositivoCommunityComments } from './DispositivoCommunityComments';
import { DispositivoNote } from './DispositivoNote';

interface DispositivoCommentsSectionProps {
  dispositivoId: string;
  leiId: string;
  activeSection: 'comunidade' | 'nota' | null;
  leiUpdatedAt?: string;
}

export function DispositivoCommentsSection({
  dispositivoId,
  leiId,
  activeSection,
  leiUpdatedAt,
}: DispositivoCommentsSectionProps) {
  if (!activeSection) return null;

  return (
    <div style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
      {activeSection === 'comunidade' && (
        <DispositivoCommunityComments
          dispositivoId={dispositivoId}
          leiId={leiId}
          leiUpdatedAt={leiUpdatedAt}
        />
      )}
      {activeSection === 'nota' && (
        <DispositivoNote
          dispositivoId={dispositivoId}
          leiId={leiId}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/comments/DispositivoCommentsSection.tsx
git commit -m "feat: add DispositivoCommentsSection tab switcher"
```

---

### Task 18: Update DispositivoFooter — connect real components

**Files:**
- Modify: `src/components/lei-seca/dispositivos/DispositivoFooter.tsx`

- [ ] **Step 1: Replace placeholder content with real components**

Key changes:
1. Import `DispositivoCommentsSection`
2. Replace the placeholder `<div>` blocks in the tab content area with the real `DispositivoCommentsSection`
3. Add `leiUpdatedAt` prop for outdated badge

The footer bar layout (tabs + actions) stays the same. Only the tab content changes:

```tsx
// Replace the placeholder blocks:
// Before:
{activeTab === 'comunidade' && (
  <div className="...">sistema completo em breve</div>
)}

// After:
<DispositivoCommentsSection
  dispositivoId={dispositivoId}
  leiId={leiId}
  activeSection={activeTab}
  leiUpdatedAt={leiUpdatedAt}
/>
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoFooter.tsx
git commit -m "feat: connect real comments and notes to DispositivoFooter"
```

---

## Phase 4: Cleanup + Polish

### Task 19: Delete old files

**Files:**
- Delete: `src/components/lei-seca/dispositivos/DispositivoActions.tsx`
- Delete: `src/components/lei-seca/dispositivos/ReactionPicker.tsx`
- Delete: `src/components/lei-seca/dispositivos/CommunityPopover.tsx`
- Delete: `src/stores/leiCommentsStore.ts`
- Delete: `src/components/lei-seca/lei-comments-panel.tsx`
- Delete: `src/hooks/useDispositivoReactions.ts`

- [ ] **Step 1: Remove old files**

```bash
git rm src/components/lei-seca/dispositivos/DispositivoActions.tsx
git rm src/components/lei-seca/dispositivos/ReactionPicker.tsx
git rm src/components/lei-seca/dispositivos/CommunityPopover.tsx
git rm src/stores/leiCommentsStore.ts
git rm src/components/lei-seca/lei-comments-panel.tsx
git rm src/hooks/useDispositivoReactions.ts
```

- [ ] **Step 2: Verify no remaining imports of deleted files**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any broken imports found.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete old DispositivoActions, ReactionPicker, CommunityPopover, leiCommentsStore"
```

---

### Task 20: Add deep linking support

**Files:**
- Modify: `src/components/lei-seca/dispositivos/DispositivoList.tsx`

- [ ] **Step 1: Add hash scroll + comment highlight on mount**

Add a `useEffect` in `DispositivoList` that:
1. Checks `window.location.hash` for `#disp_<id>`
2. Checks `URLSearchParams` for `commentId`
3. If hash found: scroll to element, open footer (set `openFooterId`)
4. If `commentId` found: the `DispositivoCommunityComments` component handles highlighting via its own URL param check

```typescript
useEffect(() => {
  const hash = window.location.hash;
  if (hash.startsWith('#disp_')) {
    const dispId = hash.replace('#disp_', '');
    // Wait for DOM to render
    requestAnimationFrame(() => {
      const el = document.getElementById(`disp_${dispId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setOpenFooterId(dispId);
      }
    });
  }
}, [dispositivos]); // Run when dispositivos load
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoList.tsx
git commit -m "feat: add deep linking — scroll to dispositivo + auto-open footer from URL hash"
```

---

### Task 21: Final verification

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: No new errors.

- [ ] **Step 3: Build**

```bash
npm run build:dev
```

Expected: Build succeeds.

- [ ] **Step 4: Manual testing checklist**

Open a lei in the browser and verify:
1. Gutter shows ♡ (like toggle works)
2. Gutter shows 🔥 with `—` (incidência stub)
3. Gutter shows ··· (click opens footer)
4. Accordion: opening one footer closes the previous
5. Footer tabs: Comunidade + Nota
6. Comments: create, reply, edit, delete, upvote, react
7. Note: create, edit, delete, auto-save on blur
8. Badges: 💬N updates when comments are added, ✏️ appears when note is saved
9. Mobile: footer inline, editor as sheet, comments collapsed

---

## File Map Summary

### New Files (13)
```
supabase/migrations/20260401000000_dispositivo_comments_notes_likes.sql
supabase/migrations/20260401000001_dispositivo_rpcs.sql
src/types/comments.ts
src/hooks/useDispositivoLikes.ts
src/hooks/useLeiIncidencia.ts
src/hooks/useDispositivoBadges.ts
src/hooks/useDispositivoComments.ts
src/hooks/useDispositivoCommentMutations.ts
src/hooks/useToggleDispositivoCommentUpvote.ts
src/hooks/useToggleDispositivoCommentReaction.ts
src/hooks/useDispositivoNote.ts
src/components/lei-seca/dispositivos/DispositivoGutter.tsx
src/components/lei-seca/comments/DispositivoNote.tsx
src/components/lei-seca/comments/DispositivoCommunityComments.tsx
src/components/lei-seca/comments/DispositivoCommentsSection.tsx
```

### Moved Files (9) — questões → shared
```
src/components/shared/comments/CommentItem.tsx
src/components/shared/comments/CommentEditor.tsx
src/components/shared/comments/CommentStatic.tsx
src/components/shared/comments/CommentVoteButton.tsx
src/components/shared/comments/CommentReactionButtons.tsx
src/components/shared/comments/CommentContextMenu.tsx
src/components/shared/comments/MobileCommentEditor.tsx
src/components/shared/comments/MobileEditorToolbar.tsx
src/components/shared/comments/MobileToolbarSheet.tsx
```

### Modified Files (5)
```
src/types/question-comments.ts
src/components/questoes/comments/CommunityComments.tsx (import paths)
src/components/lei-seca/dispositivos/DispositivoRenderer.tsx
src/components/lei-seca/dispositivos/DispositivoList.tsx
src/components/lei-seca/dispositivos/DispositivoFooter.tsx
src/views/LeiSecaPage.tsx
```

### Deleted Files (6)
```
src/components/lei-seca/dispositivos/DispositivoActions.tsx
src/components/lei-seca/dispositivos/ReactionPicker.tsx
src/components/lei-seca/dispositivos/CommunityPopover.tsx
src/stores/leiCommentsStore.ts
src/components/lei-seca/lei-comments-panel.tsx
src/hooks/useDispositivoReactions.ts
```
