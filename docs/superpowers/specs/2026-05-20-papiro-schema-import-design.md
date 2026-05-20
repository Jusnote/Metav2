# PAPIRO — Schema Supabase + Importação de Taxonomia (piloto)

**Status:** spec aprovada após brainstorm
**Data:** 2026-05-20
**Autor:** Aldemir + Claude
**Branch:** `v3-mentoria`
**Projeto Supabase:** `xmtleqquivcukwgdexhc`

---

## 1. Contexto e motivação

O PAPIRO é o subsistema editorial/pedagógico do app de estudo jurídico/concursos: produz **resumos curados** organizados por uma **taxonomia hierárquica** validada pelo Arquiteto (pipeline externo que analisa fontes — Estratégia, Gran — e gera unidades pedagógicas autônomas).

Hoje o repositório já tem o schema `coaching.*` (migrations v3, May 2026), focado em **cronograma/FSRS/atividades** ("quando estudar"). PAPIRO é **complementar**: foca em "o que estudar" como unidade pedagógica autônoma — taxonomia, pré-requisitos, profundidade pedagógica, mapeamento de fontes, vínculo semântico futuro com questões.

A primeira matéria a entrar é **Informática → Redes e Internet** (22 temas), descrita no arquivo `taxonomia_materia_redes_internet_PAPIRO_v2.json` (formato do Arquiteto).

### Por que piloto isolado em schema próprio

Optamos por colocar PAPIRO em schema dedicado `papiro.*` (em vez de `public.*` como propunha o SQL original):

- **Não interfere com `coaching.*` v3** nem com a base v2 legada em `public.*`.
- **Valida a abordagem com 1 matéria** antes de decidir se PAPIRO substitui partes do `coaching.*` (resumos/hierarquia) ou se permanece paralelo.
- Se mais tarde quisermos que o cronograma do `coaching.*` puxe resumos do PAPIRO, basta uma tabela-ponte (`papiro.tema_subtopico_map`). Nada do que está hoje precisa quebrar.

### Por que `coaching.*` e PAPIRO não competem

| Dimensão | `coaching.*` | PAPIRO |
|---|---|---|
| Lente | "Quando/como estudar" — aulas, horas, cronograma, FSRS, atividades | "O que estudar" — taxonomia pedagógica autônoma |
| Hierarquia | disciplina→bloco→tópico→subtópico (ancorada em **aula**) | disciplina→macro_area→tema (ancorada em **slug do Arquiteto**) |
| Resumo | 1 por subtópico, só Plate JSONB | 1 por tema, md canônico + plate cache + versão |
| Pré-requisito | `pre_requisito_topico_id` inline (1 nível) | grafo `tema_prereq` (N-N) |
| Cronograma/FSRS | exclusivo | inexistente |

Sobreposição real: hierarquia de unidades e corpo de resumo. Tratamento: schemas separados no piloto; tabela-ponte se necessário no futuro.

---

## 2. Escopo do piloto

### Dentro

- **Schema `papiro.*`** com 5 tabelas: `disciplina`, `macro_area`, `tema`, `tema_prereq`, `resumo`.
- **Script TS genérico** (`scripts/papiro/generate-seed.ts`) que lê qualquer JSON no formato do Arquiteto e gera um arquivo `.sql` idempotente em `supabase/seed/papiro/`.
- **Idempotência** por chave natural (`slug` / `slug_hierarquico`), preservando dados ao reimportar.
- **Importação inicial** dos 22 temas de Informática → Redes e Internet.

### Fora (deliberadamente — pra fases seguintes)

- Tabelas `modulo`, `questao_vinculo`, `progresso_aluno` (definidas no SQL original do PAPIRO).
- Extensão `pgvector` e vínculo semântico resumo↔questão via embeddings Voyage.
- Pipeline de geração/edição de resumos (entra depois, via script separado de upsert por slug).
- Integração com `coaching.*` (tabela-ponte, lookups cruzados).
- UI/rotas no front consumindo PAPIRO — fora deste spec, decidir em brainstorm separado.

---

## 3. Decisões e trade-offs

| Decisão | Escolha | Trade-off |
|---|---|---|
| Schema | `papiro.*` (isolado) | Custo: schema novo precisa de grants + RLS explícitos. Ganho: não polui public, não toca em coaching. |
| Tabelas no piloto | 5 (sem modulo/questao_vinculo/progresso_aluno) | Custo: adicionar depois requer mais migrations. Ganho: foco no mínimo necessário pra rodar end-to-end. |
| Coluna nova `tema.mapeamento_paginas` | jsonb `{"estrategia": [...], "gran": [...]}` | Custo: divergência do SQL original. Ganho: insumo direto do gerador de resumos da próxima fase, sem ter que voltar no JSON. |
| Chave natural | `slug` (disciplina, macro_area) e `slug_hierarquico` (tema) | Custo: dependência do Arquiteto produzir IDs estáveis. Ganho: UPSERT determinístico, diff legível, reimport sem duplicar. |
| Convenção de slug | Prefixos encadeados (`informatica` ⊂ `informatica.redes_internet` ⊂ `informatica.redes_internet.tema`) | Custo: nenhum. Ganho: evita colisão entre disciplinas, invariante verificável. |
| Resumo | Só schema; sem dados no seed | Custo: UI precisa lidar com "tema sem resumo". Ganho: ausência de row = estado honesto "em breve"; evita esqueleto vazio que código teria que distinguir. |
| Reimport | Update + warning de órfãos | Custo: warning fica no log do SQL Editor, não bloqueia. Ganho: não destrutivo; órfãos visíveis sem perda automática de dado. |
| Grants | `GRANT ON ALL TABLES` (atuais) + `ALTER DEFAULT PRIVILEGES` (futuras) | Custo: dois statements em vez de um. Ganho: tabelas novas em migrations futuras herdam grants automaticamente. |
| Geração do SQL | Script TS gera arquivo idempotente; user aplica manualmente no SQL Editor | Custo: dois passos. Ganho: review humano do .sql antes de tocar o DB; script TS fica offline (não precisa de service_role local). |

---

## 4. Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│ scripts/papiro/                                                  │
│   ├─ input/                                                      │
│   │   └─ informatica_redes.json    (taxonomia do Arquiteto)      │
│   ├─ schema.ts                     (Zod do JSON do Arquiteto)    │
│   ├─ generate-seed.ts              (lê JSON → emite .sql)        │
│   └─ README.md                                                   │
│                                                                  │
│             │ npm run papiro:seed -- scripts/papiro/input/X.json │
│             ▼                                                    │
│ supabase/seed/papiro/                                            │
│   └─ informatica_redes.sql         (gerado, idempotente)         │
│                                                                  │
│             │ user aplica no SQL Editor do Supabase Studio       │
│             ▼                                                    │
│ Supabase Postgres (project xmtleqquivcukwgdexhc)                 │
│   schema papiro.*                                                │
│     ├─ disciplina                                                │
│     ├─ macro_area                                                │
│     ├─ tema           (5 tabelas, criadas via migration)         │
│     ├─ tema_prereq                                               │
│     └─ resumo                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Responsabilidade | Depende de |
|---|---|---|
| `supabase/migrations/20260520120000_papiro_001_schema.sql` | Criar schema, 5 tabelas, índices, RLS, grants | Postgres + pgcrypto |
| `scripts/papiro/schema.ts` | Definir Zod do JSON do Arquiteto + validar invariantes | zod (já no projeto) |
| `scripts/papiro/generate-seed.ts` | Pipeline: parse → validate → topological sort → emit SQL → write file | tsx, fs, schema.ts |
| `scripts/papiro/input/<macro_area_slug>.json` | Entrada bruta do Arquiteto (commitada no git) | — |
| `supabase/seed/papiro/<macro_area_slug>.sql` | Saída idempotente (commitada no git) | — |

---

## 5. Schema SQL (DDL final)

Migration `supabase/migrations/20260520120000_papiro_001_schema.sql`:

```sql
-- =====================================================================
-- PAPIRO — Schema piloto v1 (5 tabelas em papiro.*)
-- =====================================================================

create extension if not exists "pgcrypto";

create schema if not exists papiro;
grant usage on schema papiro to authenticated, service_role;

-- ---------- 1. HIERARQUIA DE CONTEÚDO ----------

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
  slug_hierarquico     text not null unique,
  nome                 text not null,
  descricao_breve      text,
  objetivo_pedagogico  text,
  ordem_curricular     int  not null default 0,
  tempo_estudo_min     int,
  profundidade_estrat  text,
  profundidade_gran    text,
  conceitos_principais jsonb not null default '[]'::jsonb,
  mapeamento_paginas   jsonb not null default '{}'::jsonb,
  criado_em            timestamptz not null default now(),
  unique (macro_area_id, ordem_curricular)
);

create table papiro.tema_prereq (
  tema_id        uuid not null references papiro.tema(id) on delete cascade,
  prereq_tema_id uuid not null references papiro.tema(id) on delete cascade,
  primary key (tema_id, prereq_tema_id),
  check (tema_id <> prereq_tema_id)
);

create table papiro.resumo (
  id              uuid primary key default gen_random_uuid(),
  tema_id         uuid not null unique references papiro.tema(id) on delete cascade,
  conteudo_md     text,
  conteudo_plate  jsonb,
  status          text not null default 'rascunho'
                  check (status in ('rascunho', 'revisao', 'publicado')),
  versao          int  not null default 1,
  atualizado_em   timestamptz not null default now()
);

-- ---------- 2. ÍNDICES ----------

create index idx_macro_area_disciplina  on papiro.macro_area(disciplina_id);
create index idx_tema_macro_area        on papiro.tema(macro_area_id);
create index idx_tema_ordem             on papiro.tema(macro_area_id, ordem_curricular);
create index idx_prereq_prereq          on papiro.tema_prereq(prereq_tema_id);
create index idx_resumo_publicado       on papiro.resumo(status) where status = 'publicado';

-- ---------- 3. ROW LEVEL SECURITY ----------

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

-- (sem policies de INSERT/UPDATE/DELETE → escrita só via service_role)

-- ---------- 4. GRANTS ----------

grant select on all tables in schema papiro to authenticated;
grant all    on all tables in schema papiro to service_role;

alter default privileges in schema papiro
  grant select on tables to authenticated;
alter default privileges in schema papiro
  grant all on tables to service_role;

-- ---------- 5. NOTIFY POSTGREST ----------

notify pgrst, 'reload schema';
```

### Diferenças vs `papiro_schema_supabase.sql` original

| Mudança | Por quê |
|---|---|
| Schema `papiro` em vez de `public` | Piloto isolado |
| Nova coluna `tema.mapeamento_paginas jsonb` | Insumo do gerador de resumos da próxima fase |
| `unique (macro_area_id, ordem_curricular)` em tema | Defesa em profundidade da validação no script |
| `check (tema_id <> prereq_tema_id)` em tema_prereq | Impede auto-prereq no DB |
| `conceitos_principais not null default '[]'::jsonb` | Sempre array, evita NULL spurious |
| `status` check constraint inline | Era comentário; agora restrição real |
| Removido: `modulo`, `questao_vinculo`, `progresso_aluno` | Não no piloto |
| `GRANT ... ON ALL TABLES` + `ALTER DEFAULT PRIVILEGES` | Schema novo + blindagem de futuras tabelas |
| `NOTIFY pgrst, 'reload schema'` | Faz PostgREST recarregar pra Studio mostrar tabelas novas |

---

## 6. Mapeamento JSON → SQL

### Campos usados

| Campo JSON | Coluna destino |
|---|---|
| `materia.id`.split('.')[0] | `papiro.disciplina.slug` |
| `materia.disciplina` | `papiro.disciplina.nome` |
| `materia.id` | `papiro.macro_area.slug` |
| `materia.macro_area` | `papiro.macro_area.nome` |
| `temas_papiro[].id` | `papiro.tema.slug_hierarquico` |
| `temas_papiro[].nome` | `papiro.tema.nome` |
| `temas_papiro[].descricao_breve` | `papiro.tema.descricao_breve` |
| `temas_papiro[].objetivo_pedagogico` | `papiro.tema.objetivo_pedagogico` |
| `temas_papiro[].ordem_curricular` | `papiro.tema.ordem_curricular` |
| `temas_papiro[].tempo_estudo_estimado_minutos` | `papiro.tema.tempo_estudo_min` |
| `temas_papiro[].conceitos_principais` | `papiro.tema.conceitos_principais` (jsonb) |
| `temas_papiro[].mapeamento_fontes.estrategia.profundidade` | `papiro.tema.profundidade_estrat` |
| `temas_papiro[].mapeamento_fontes.gran.profundidade` | `papiro.tema.profundidade_gran` |
| `temas_papiro[].mapeamento_fontes.{estrategia,gran}.paginas` | `papiro.tema.mapeamento_paginas` (jsonb) |
| `temas_papiro[].pre_requisitos[]` | `papiro.tema_prereq` (uma row por par) |

### Convenção de slug (chave natural)

- `disciplina.slug` = 1º segmento (`informatica`)
- `macro_area.slug` = `materia.id` inteiro (`informatica.redes_internet`)
- `tema.slug_hierarquico` = `temas_papiro[].id` (`informatica.redes_internet.fundamentos_redes`)

**Invariante**: `tema.slug_hierarquico` SEMPRE começa com `macro_area.slug + "."`.

### Campos não usados no piloto

Preservados no JSON, ignorados pelo seed:
`mapeamento_fontes.{estrategia,gran}.documento`, `mapeamento_fontes.{estrategia,gran}.observacoes`, `justificativa_pedagogica`, `temas_relacionados`, `alertas_e_observacoes.*`.

---

## 7. Script generator (TS → SQL)

### Layout

```
scripts/papiro/
  ├─ input/
  │   └─ informatica_redes.json    (movido de public/Resumos/)
  ├─ schema.ts                     (Zod do JSON)
  ├─ generate-seed.ts              (lê JSON → emite .sql)
  └─ README.md
```

### Execução

`package.json` ganha script:
```json
"papiro:seed": "tsx scripts/papiro/generate-seed.ts"
```

Comando:
```bash
npm run papiro:seed -- scripts/papiro/input/informatica_redes.json
```

### Fluxo (5 etapas; falha em qualquer aborta sem escrever arquivo)

1. **Parse + validate JSON** — Zod do formato do Arquiteto.
2. **Validate invariantes**:
   - `materia.id` tem exatamente 2 segmentos.
   - Cada `temas_papiro[].id` começa com `materia.id + "."`.
   - Cada `pre_requisitos[]` referencia um `temas_papiro[].id` do mesmo JSON.
   - Sem ciclos no grafo de prereqs (DFS).
   - **Sem `ordem_curricular` duplicada** entre temas.
   - **Slugs respeitam regex** `^[a-z0-9_.]+$` (minúsculas, dígitos, ponto, underscore).
3. **Topological sort** dos temas pra emitir UPSERTs em ordem (defensivo; FK e UPSERT por slug já tolerariam ordem qualquer, mas ajuda legibilidade).
4. **Emit SQL** idempotente em `BEGIN ... COMMIT` (template estruturado).
5. **Write file** em `supabase/seed/papiro/<macro_area_slug>.sql`.

### Estrutura do SQL emitido

```sql
BEGIN;

-- 1) UPSERT disciplina (por slug)
INSERT INTO papiro.disciplina (nome, slug, ordem)
VALUES (...)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome;

-- 2) UPSERT macro_area (resolve disciplina_id por slug)
INSERT INTO papiro.macro_area (disciplina_id, nome, slug, ordem)
SELECT d.id, ..., ..., 0 FROM papiro.disciplina d WHERE d.slug = '...'
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome;

-- 3) UPSERT temas (por slug_hierarquico, um INSERT por tema, ordenado)
INSERT INTO papiro.tema (...)
SELECT m.id, ... FROM papiro.macro_area m WHERE m.slug = '...'
ON CONFLICT (slug_hierarquico) DO UPDATE SET
  nome = EXCLUDED.nome, descricao_breve = EXCLUDED.descricao_breve, ...;

-- 4) DELETE+INSERT dos prereqs do escopo desta macro_area
DELETE FROM papiro.tema_prereq
WHERE tema_id IN (SELECT id FROM papiro.tema WHERE macro_area_id = (
  SELECT id FROM papiro.macro_area WHERE slug = '...'
));

INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)
SELECT t1.id, t2.id
FROM papiro.tema t1, papiro.tema t2
WHERE t1.slug_hierarquico = '...' AND t2.slug_hierarquico = '...';
-- (uma row por par)

-- 5) Warning de órfãos (temas no DB que não estão no JSON atual)
DO $$
DECLARE orfaos TEXT[];
BEGIN
  SELECT array_agg(slug_hierarquico) INTO orfaos
  FROM papiro.tema
  WHERE macro_area_id = (SELECT id FROM papiro.macro_area WHERE slug = '...')
    AND slug_hierarquico NOT IN ('...', '...');  -- lista do JSON
  IF array_length(orfaos, 1) > 0 THEN
    RAISE WARNING 'PAPIRO: % temas órfãos no DB (não no JSON atual): %',
      array_length(orfaos, 1), orfaos;
  END IF;
END $$;

COMMIT;
```

### Garantias de idempotência

- Rodar 2× = mesmo resultado (ON CONFLICT DO UPDATE em todas as hierarquias).
- Prereqs sempre refletem o JSON atual (DELETE per-tema-da-macro-area antes do INSERT).
- Tema removido do JSON não some do DB; emite `RAISE WARNING` visível no SQL Editor.
- Reimport com JSON novo preserva `papiro.resumo` (FK por `tema.id`; tema com mesmo slug mantém o mesmo UUID).

---

## 8. Fluxo de execução

### Primeira vez

1. **Mover input**: `public/Resumos/taxonomia_materia_redes_internet_PAPIRO_v2.json` → `scripts/papiro/input/informatica_redes.json` (renomeado pra padronizar).
2. **Aplicar migration**: cole o conteúdo de `supabase/migrations/20260520120000_papiro_001_schema.sql` no SQL Editor do Supabase Studio e execute. Verificar que `papiro.*` aparece no painel.
3. **Gerar seed**: `npm run papiro:seed -- scripts/papiro/input/informatica_redes.json` → escreve `supabase/seed/papiro/informatica_redes.sql`.
4. **Revisar o .sql gerado** (diff humano).
5. **Aplicar seed**: cole o `.sql` no SQL Editor; ver "Success. No rows returned" + (se houver) o warning de órfãos.
6. **Commit**: ambos os arquivos (`scripts/papiro/*`, `supabase/migrations/...`, `supabase/seed/papiro/...`, `package.json`).

### Reimport (taxonomia atualizada)

1. Atualizar o JSON em `scripts/papiro/input/<macro_area_slug>.json`.
2. Rodar gerador de novo (sobrescreve o `.sql`).
3. Revisar diff do `.sql` (git diff).
4. Aplicar no SQL Editor.
5. Conferir warnings de órfãos (se algum tema sumiu do JSON, decidir manualmente o que fazer).
6. Commit.

### Nova matéria

Mesma sequência da primeira vez, com novo JSON em `scripts/papiro/input/<nova_macro_area>.json`.

---

## 9. Limites de teste / verificação

- **Schema**: depois de aplicar a migration, conferir no Supabase Studio que `papiro.disciplina`, `macro_area`, `tema`, `tema_prereq`, `resumo` aparecem com RLS habilitado.
- **Seed**: depois de aplicar, query rápida:
  ```sql
  select count(*) from papiro.disciplina;   -- 1
  select count(*) from papiro.macro_area;   -- 1
  select count(*) from papiro.tema;         -- 22
  select count(*) from papiro.tema_prereq;  -- ~30+ (depende dos prereqs)
  select count(*) from papiro.resumo;       -- 0 (correto — sem dados)
  ```
- **Idempotência**: re-aplicar o `.sql` deve dar mesmo resultado, sem erro, sem duplicação.
- **Warning de órfãos**: testar removendo 1 tema do JSON, regerando, aplicando — esperar `RAISE WARNING` no log.

---

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Slug do Arquiteto muda no futuro (renome) | UPDATE manual em `papiro.tema.slug_hierarquico` antes de re-importar, ou aceitar como tema novo e marcar o antigo |
| RLS bloquear PostgREST quando consumir do front | Grants explícitos + `notify pgrst, 'reload schema'` na migration |
| Conflito futuro com `coaching.*` (resumos duplicados) | Decidir no brainstorm da Fase 2; tabela-ponte se necessário |
| `ALTER DEFAULT PRIVILEGES` não pegar em tabelas criadas por outro role | Garantir que todas as migrations PAPIRO rodem como `postgres` (default no Supabase) |
| Erro humano: aplicar seed antes da migration | A migration cria o schema; aplicar seed antes falha com "schema papiro does not exist" — erro óbvio, sem dano |

---

## 11. Próximas fases (fora deste spec)

- **Resumo content**: script separado de upsert por slug, lendo md/plate gerado pelo pipeline editorial.
- **Tabelas extras**: `modulo` (composição interna do resumo), `questao_vinculo` (embeddings Voyage), `progresso_aluno` (tracking do aluno).
- **UI**: rotas/páginas no front consumindo `papiro.tema`, `papiro.resumo` — brainstorm próprio.
- **Integração com `coaching.*`**: tabela-ponte `papiro.tema_subtopico_map` se o cronograma for puxar resumo do PAPIRO.
- **Novas matérias**: rodar o mesmo gerador com JSONs do Arquiteto para Direito Adm, Direito Penal, etc.
