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
