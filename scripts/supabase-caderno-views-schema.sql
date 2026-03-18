-- ============================================================
-- Caderno Saved Views - Schema Migration
-- ============================================================
-- "Ilusão dos Múltiplos Cadernos": saved filter presets that
-- look like separate notebooks but are just pre-applied filters.

create table if not exists caderno_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  color text default '#8b5cf6',
  icon text default 'notebook',

  -- Filter preset (jsonb)
  -- e.g. {"lei_id": "uuid-here"} or {"lei_id": "uuid", "provision_role": "inciso"}
  filters jsonb not null default '{}',

  position int not null default 0,
  created_at timestamptz default now()
);

alter table caderno_saved_views enable row level security;

create policy "Users can CRUD own saved views"
  on caderno_saved_views for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast user lookups
create index if not exists idx_caderno_saved_views_user
  on caderno_saved_views(user_id);
