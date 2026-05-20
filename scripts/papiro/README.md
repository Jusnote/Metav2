# PAPIRO — Importador de Taxonomia

Gera arquivos SQL idempotentes a partir de JSONs no formato do Arquiteto
e os deposita em `supabase/seed/papiro/`.

## Visão geral

```
scripts/papiro/input/<macro_area_slug>.json   (entrada do Arquiteto)
                  │
                  ▼  npx tsx scripts/papiro/generate-seed.ts ...
                  │
supabase/seed/papiro/<macro_area_slug>.sql    (saída idempotente)
                  │
                  ▼  cole no SQL Editor do Supabase Studio
                  │
papiro.* (5 tabelas no DB)
```

## Como rodar

```bash
npx tsx scripts/papiro/generate-seed.ts scripts/papiro/input/informatica_redes.json
```

Ou via npm script:

```bash
npm run papiro:seed -- scripts/papiro/input/informatica_redes.json
```

O script valida o JSON contra o Zod (`schema.ts`) e contra invariantes
semânticas. Falha em qualquer validação aborta antes de escrever o `.sql`.

## Pré-requisitos

1. Schema `papiro.*` aplicado no banco (rode antes a migration
   `supabase/migrations/20260520120000_papiro_001_schema.sql`).
2. `npx tsx` disponível (download automático na primeira execução; ou
   `npm i -D tsx` se preferir local).

## Idempotência

- UPSERT por `slug` (disciplina, macro_area) e `slug_hierarquico` (tema).
- Prereqs: `DELETE` per-macro-area + re-`INSERT` do conjunto atual.
- Temas no DB que sumiram do JSON: **preservados**; o seed emite
  `RAISE WARNING` no SQL Editor mostrando os órfãos.
- Rodar 2× = mesmo resultado.

## Validações antes de gerar SQL

1. JSON casa com `TaxonomiaSchema` (Zod).
2. `materia.id` tem 2 segmentos (`disciplina.macro_area`).
3. Cada `tema.id` começa com `materia.id + "."`.
4. `ordem_curricular` única (sem duplicada).
5. Cada `pre_requisitos[]` referencia um tema do mesmo JSON.
6. Sem ciclos no grafo de prereqs (DFS).
7. Slugs respeitam regex `^[a-z0-9_.]+$` (já no Zod via `.regex(...)`).

## Adicionar uma nova matéria

1. Coloque o JSON do Arquiteto em `scripts/papiro/input/<macro_area_slug>.json`.
2. Rode o gerador.
3. Revise o `.sql` gerado em `supabase/seed/papiro/`.
4. Cole o `.sql` no SQL Editor do Supabase.
5. Commit dos dois arquivos.

## Schema

Ver `scripts/papiro/schema.ts` (Zod) e
`supabase/migrations/20260520120000_papiro_001_schema.sql` (DDL).

Spec completa: `docs/superpowers/specs/2026-05-20-papiro-schema-import-design.md`.
