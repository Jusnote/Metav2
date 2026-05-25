-- =====================================================================
-- PAPIRO — Schema Supabase v1.0 (Fase 1: conteúdo liberado para todos)
-- =====================================================================
-- Filosofia:
--   - Conteúdo (disciplina/macro_area/tema/resumo/modulo/questao_vinculo)
--     é PÚBLICO para qualquer aluno autenticado.
--   - Progresso é PRIVADO por aluno.
--   - Escrita de conteúdo só via service_role (script de importação).
--   - O gancho de "matrícula por curso" virá na Fase 2 sem quebrar isto.
-- =====================================================================

-- ---------- EXTENSÕES ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
-- (Para a vinculação semântica futura com embeddings Voyage:)
-- create extension if not exists vector;

-- =====================================================================
-- 1. HIERARQUIA DE CONTEÚDO
-- =====================================================================

create table disciplina (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  ordem       int  not null default 0,
  criado_em   timestamptz not null default now()
);

create table macro_area (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references disciplina(id) on delete cascade,
  nome          text not null,
  slug          text not null unique,
  ordem         int  not null default 0,
  criado_em     timestamptz not null default now()
);

create table tema (
  id                  uuid primary key default gen_random_uuid(),
  macro_area_id       uuid not null references macro_area(id) on delete cascade,
  -- slug_hierarquico = exatamente o "id" que o Arquiteto gera na taxonomia
  -- ex: informatica.redes_internet.intranet_extranet_vpn
  slug_hierarquico    text not null unique,
  nome                text not null,
  descricao_breve     text,
  objetivo_pedagogico text,
  ordem_curricular    int  not null default 0,
  tempo_estudo_min    int,
  profundidade_estrat text,   -- alta | media | baixa | ausente
  profundidade_gran   text,
  conceitos_principais jsonb default '[]'::jsonb,
  criado_em           timestamptz not null default now()
);

-- Pré-requisitos: grafo tema -> tema (vem do campo pre_requisitos da taxonomia)
create table tema_prereq (
  tema_id         uuid not null references tema(id) on delete cascade,
  prereq_tema_id  uuid not null references tema(id) on delete cascade,
  primary key (tema_id, prereq_tema_id)
);

create table resumo (
  id              uuid primary key default gen_random_uuid(),
  tema_id         uuid not null references tema(id) on delete cascade,
  -- markdown canônico (fonte da verdade) + cache de render do Plate.js
  conteudo_md     text,
  conteudo_plate  jsonb,
  status          text not null default 'rascunho',  -- rascunho | revisao | publicado
  versao          int  not null default 1,
  atualizado_em   timestamptz not null default now(),
  unique (tema_id)   -- 1 resumo "vivo" por tema (versões antigas vão p/ histórico se quiser)
);

-- Módulos que compõem o resumo (saída da fase de Geração de Módulos)
create table modulo (
  id          uuid primary key default gen_random_uuid(),
  resumo_id   uuid not null references resumo(id) on delete cascade,
  subtopico   text not null,
  ordem       int  not null default 0,
  conteudo_md text,
  criado_em   timestamptz not null default now()
);

-- Vínculo resumo <-> questões do seu banco (preenchido depois via embeddings)
create table questao_vinculo (
  id           uuid primary key default gen_random_uuid(),
  resumo_id    uuid not null references resumo(id) on delete cascade,
  questao_id   uuid not null,        -- id da questão no seu banco de 130k
  similaridade real,                 -- score de cosseno (Voyage), opcional
  criado_em    timestamptz not null default now(),
  unique (resumo_id, questao_id)
);

-- =====================================================================
-- 2. PROGRESSO (privado por aluno)
-- =====================================================================

create table progresso_aluno (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references auth.users(id) on delete cascade,
  tema_id       uuid not null references tema(id) on delete cascade,
  status        text not null default 'nao_iniciado', -- nao_iniciado | em_andamento | concluido
  concluido_em  timestamptz,
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, tema_id)
);

-- =====================================================================
-- 3. ÍNDICES
-- =====================================================================

create index idx_macro_area_disciplina on macro_area(disciplina_id);
create index idx_tema_macro_area        on tema(macro_area_id);
create index idx_tema_ordem             on tema(macro_area_id, ordem_curricular);
create index idx_resumo_tema            on resumo(tema_id);
create index idx_resumo_status          on resumo(status);
create index idx_modulo_resumo          on modulo(resumo_id);
create index idx_qvinc_resumo           on questao_vinculo(resumo_id);
create index idx_prog_aluno             on progresso_aluno(aluno_id);

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================

-- ---- 4a. CONTEÚDO: leitura pública p/ autenticados, escrita só service_role ----
-- (sem policy de INSERT/UPDATE => alunos não escrevem; service_role ignora RLS)

alter table disciplina      enable row level security;
alter table macro_area      enable row level security;
alter table tema            enable row level security;
alter table tema_prereq     enable row level security;
alter table resumo          enable row level security;
alter table modulo          enable row level security;
alter table questao_vinculo enable row level security;

create policy "disciplina legivel" on disciplina
  for select to authenticated using (true);

create policy "macro_area legivel" on macro_area
  for select to authenticated using (true);

create policy "tema legivel" on tema
  for select to authenticated using (true);

create policy "tema_prereq legivel" on tema_prereq
  for select to authenticated using (true);

-- Só resumos PUBLICADOS aparecem para o aluno (rascunhos ficam invisíveis)
create policy "resumo publicado legivel" on resumo
  for select to authenticated using (status = 'publicado');

create policy "modulo legivel" on modulo
  for select to authenticated using (true);

create policy "questao_vinculo legivel" on questao_vinculo
  for select to authenticated using (true);

-- ---- 4b. PROGRESSO: cada aluno só o seu ----
alter table progresso_aluno enable row level security;

create policy "ve proprio progresso" on progresso_aluno
  for select to authenticated using (auth.uid() = aluno_id);

create policy "insere proprio progresso" on progresso_aluno
  for insert to authenticated with check (auth.uid() = aluno_id);

create policy "atualiza proprio progresso" on progresso_aluno
  for update to authenticated
  using (auth.uid() = aluno_id) with check (auth.uid() = aluno_id);

-- =====================================================================
-- 5. GANCHO PARA A FASE 2 (matrícula por curso) — NÃO ATIVAR AINDA
-- =====================================================================
-- Quando for vender curso por curso, crie a tabela abaixo e TROQUE a
-- policy "resumo publicado legivel" por uma que cheque matrícula ativa.
-- Nada do que está acima precisa ser refeito.
--
-- create table matricula (
--   id         uuid primary key default gen_random_uuid(),
--   aluno_id   uuid not null references auth.users(id) on delete cascade,
--   macro_area_id uuid not null references macro_area(id) on delete cascade,
--   ativa      boolean not null default true,
--   criado_em  timestamptz not null default now(),
--   unique (aluno_id, macro_area_id)
-- );
--
-- -- Substituiria a policy de leitura do resumo por:
-- -- using (
-- --   status = 'publicado' and exists (
-- --     select 1 from matricula m
-- --     join tema t on t.macro_area_id = m.macro_area_id
-- --     where t.id = resumo.tema_id
-- --       and m.aluno_id = auth.uid() and m.ativa
-- --   )
-- -- )
-- =====================================================================
