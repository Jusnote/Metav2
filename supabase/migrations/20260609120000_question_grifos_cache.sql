-- Cache do extrator de grifo ("Comentários do professor"): question_id -> grifos (JSON).
-- On-demand + cache: o servidor (service-role) lê/grava; o cliente nunca acessa a tabela direto.
-- prompt_version permite recomputar ao evoluir o prompt sem perder o cache antigo.

create table if not exists public.question_grifos_cache (
  id             uuid primary key default gen_random_uuid(),
  question_id    bigint not null,
  model          text not null,
  prompt_version int  not null default 1,
  tipo_estrutura text,
  grifos         jsonb not null,           -- [{target,trecho,prefix,suffix,tipo_armadilha,tooltip}]
  created_at     timestamptz not null default now(),
  unique (question_id, model, prompt_version)
);

create index if not exists qgc_question_idx on public.question_grifos_cache (question_id);

-- RLS ligado, sem policies: só a service-role key (servidor) acessa; anon/authenticated ficam bloqueados.
alter table public.question_grifos_cache enable row level security;
