-- ============================================================
-- Caderno Tematico - Schema Migration
-- ============================================================

-- Table: cadernos (thematic notebooks)
create table if not exists cadernos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  color text default '#8b5cf6',
  icon text default 'notebook',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table cadernos enable row level security;

create policy "Users can CRUD own cadernos"
  on cadernos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Table: caderno_items (provisions saved into notebooks)
create table if not exists caderno_items (
  id uuid primary key default gen_random_uuid(),
  caderno_id uuid not null references cadernos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Provision identity
  lei_id text not null,
  artigo_numero text not null,
  provision_slug text not null,
  provision_role text not null,
  provision_text text not null,

  -- Lei metadata (cached at save time)
  lei_sigla text,
  lei_nome text,
  artigo_contexto text,

  -- Hierarchical context (parent provisions for display)
  context_chain jsonb default '[]',

  -- Ordering & annotation
  position int not null default 0,
  note text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Prevent duplicate provisions in same caderno
  unique(caderno_id, provision_slug)
);

alter table caderno_items enable row level security;

create policy "Users can CRUD own caderno_items"
  on caderno_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists idx_caderno_items_caderno on caderno_items(caderno_id);
create index if not exists idx_caderno_items_slug on caderno_items(provision_slug);
create index if not exists idx_cadernos_user on cadernos(user_id);
