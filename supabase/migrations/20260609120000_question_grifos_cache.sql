-- Cache do extrator de grifo ("Comentarios do professor"): question_id -> grifos (JSON).
-- On-demand + cache: o servidor (service-role) le/grava; o cliente nunca acessa direto.
-- prompt_version permite recomputar ao evoluir o prompt sem perder o cache antigo.

create table if not exists public.question_grifos_cache (
  id             uuid primary key default gen_random_uuid(),
  question_id    bigint not null,
  model          text not null,
  prompt_version integer not null default 1,
  tipo_estrutura text,
  grifos         jsonb not null,
  created_at     timestamptz not null default now()
);

create unique index if not exists qgc_unique_idx
  on public.question_grifos_cache (question_id, model, prompt_version);

create index if not exists qgc_question_idx
  on public.question_grifos_cache (question_id);

alter table public.question_grifos_cache enable row level security;
