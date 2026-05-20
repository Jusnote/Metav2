-- =====================================================================
-- PAPIRO — Schema piloto v1 (5 tabelas em papiro.*)
-- Spec: docs/superpowers/specs/2026-05-20-papiro-schema-import-design.md
--
-- Filosofia:
--   - Conteúdo (disciplina/macro_area/tema/tema_prereq/resumo)
--     é PÚBLICO para qualquer aluno autenticado.
--   - Resumo só aparece quando status='publicado'.
--   - Escrita só via service_role (script de importação ignora RLS).
--   - Schema dedicado `papiro.*` — não interfere com coaching.* nem public.*
-- =====================================================================

create extension if not exists "pgcrypto";

create schema if not exists papiro;
grant usage on schema papiro to authenticated, service_role;

-- =====================================================================
-- 1. HIERARQUIA DE CONTEÚDO
-- =====================================================================

create table papiro.disciplina (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  ordem       int  not null default 0,
  criado_em   timestamptz not null default now()
);

create table papiro.macro_area (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references papiro.disciplina(id) on delete cascade,
  nome          text not null,
  slug          text not null unique,
  ordem         int  not null default 0,
  criado_em     timestamptz not null default now()
);

create table papiro.tema (
  id                   uuid primary key default gen_random_uuid(),
  macro_area_id        uuid not null references papiro.macro_area(id) on delete cascade,
  -- slug_hierarquico = exatamente o "id" que o Arquiteto gera na taxonomia
  -- ex: informatica.redes_internet.intranet_extranet_vpn
  slug_hierarquico     text not null unique,
  nome                 text not null,
  descricao_breve      text,
  objetivo_pedagogico  text,
  ordem_curricular     int  not null default 0,
  tempo_estudo_min     int,
  profundidade_estrat  text,  -- alta | media | baixa | ausente
  profundidade_gran    text,  -- idem
  conceitos_principais jsonb not null default '[]'::jsonb,
  mapeamento_paginas   jsonb not null default '{}'::jsonb,  -- {"estrategia":[...],"gran":[...]}
  criado_em            timestamptz not null default now(),
  unique (macro_area_id, ordem_curricular)
);

-- Pré-requisitos: grafo tema -> tema (vem do campo pre_requisitos da taxonomia)
create table papiro.tema_prereq (
  tema_id        uuid not null references papiro.tema(id) on delete cascade,
  prereq_tema_id uuid not null references papiro.tema(id) on delete cascade,
  primary key (tema_id, prereq_tema_id),
  check (tema_id <> prereq_tema_id)
);

create table papiro.resumo (
  id              uuid primary key default gen_random_uuid(),
  tema_id         uuid not null unique references papiro.tema(id) on delete cascade,
  -- markdown canônico (fonte da verdade) + cache de render do Plate.js
  conteudo_md     text,
  conteudo_plate  jsonb,
  status          text not null default 'rascunho'
                  check (status in ('rascunho', 'revisao', 'publicado')),
  versao          int  not null default 1,
  atualizado_em   timestamptz not null default now()
);

-- =====================================================================
-- 2. ÍNDICES
-- =====================================================================

create index idx_macro_area_disciplina  on papiro.macro_area(disciplina_id);
create index idx_tema_macro_area        on papiro.tema(macro_area_id);
create index idx_tema_ordem             on papiro.tema(macro_area_id, ordem_curricular);
create index idx_prereq_prereq          on papiro.tema_prereq(prereq_tema_id);
create index idx_resumo_publicado       on papiro.resumo(status) where status = 'publicado';

-- =====================================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================================

alter table papiro.disciplina  enable row level security;
alter table papiro.macro_area  enable row level security;
alter table papiro.tema        enable row level security;
alter table papiro.tema_prereq enable row level security;
alter table papiro.resumo      enable row level security;

create policy "papiro_disciplina_read"  on papiro.disciplina
  for select to authenticated using (true);

create policy "papiro_macro_area_read"  on papiro.macro_area
  for select to authenticated using (true);

create policy "papiro_tema_read"        on papiro.tema
  for select to authenticated using (true);

create policy "papiro_prereq_read"      on papiro.tema_prereq
  for select to authenticated using (true);

create policy "papiro_resumo_publicado_read" on papiro.resumo
  for select to authenticated using (status = 'publicado');

-- (sem policy de INSERT/UPDATE/DELETE → escrita só via service_role)

-- =====================================================================
-- 4. GRANTS
-- =====================================================================

-- Tabelas atuais
grant select on all tables in schema papiro to authenticated;
grant all    on all tables in schema papiro to service_role;

-- Blindagem para tabelas futuras (modulo, questao_vinculo, progresso_aluno...)
alter default privileges in schema papiro
  grant select on tables to authenticated;
alter default privileges in schema papiro
  grant all on tables to service_role;

-- =====================================================================
-- 5. NOTIFY POSTGREST
-- =====================================================================
notify pgrst, 'reload schema';
