-- Marcações na questão: Atenção (cor + triângulo + tipo + nota) e Grifo comum (só cor).
-- Uma única tabela cobre os dois tipos via `kind`. Âncora por quote+contexto (prefix/suffix).

create table if not exists public.question_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id bigint not null,
  target      text not null,                       -- 'enunciado' | 'alt:A'...
  kind        text not null check (kind in ('plain','attention')),
  color       text not null,
  type        text check (type in ('pegadinha','chave','cuidado','sacada','revisar')),
  quote       text not null,
  prefix      text not null default '',
  suffix      text not null default '',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists qh_user_question_idx on public.question_highlights (user_id, question_id);
create index if not exists qh_user_type_idx     on public.question_highlights (user_id, type);
create index if not exists qh_user_created_idx  on public.question_highlights (user_id, created_at desc);

alter table public.question_highlights enable row level security;

create policy "qh_select_own" on public.question_highlights
  for select using (auth.uid() = user_id);
create policy "qh_insert_own" on public.question_highlights
  for insert with check (auth.uid() = user_id);
create policy "qh_update_own" on public.question_highlights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "qh_delete_own" on public.question_highlights
  for delete using (auth.uid() = user_id);
