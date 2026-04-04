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
    exists(
      select 1 from dispositivo_comment_upvotes u
      where u.comment_id = c.id and u.user_id = p_user_id
    ) as has_upvoted,
    coalesce(
      (select jsonb_object_agg(r.emoji, r.cnt)
       from (select emoji, count(*)::int as cnt
             from dispositivo_comment_reactions
             where comment_id = c.id
             group by emoji) r),
      '{}'::jsonb
    ) as reaction_counts,
    coalesce(
      (select jsonb_agg(emoji)
       from dispositivo_comment_reactions
       where comment_id = c.id and user_id = p_user_id),
      '[]'::jsonb
    ) as user_reactions,
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
