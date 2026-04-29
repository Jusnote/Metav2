# Taxonomia TEC — Direito Administrativo (Leva 1) Design

**Data:** 2026-04-28
**Autor:** Aldemir + Claude (brainstorm 058e4f90)
**Status:** Em revisão

## Contexto

A integração anterior (taxonomia GRAN) foi descartada em 2026-04-26 após validação UX revelar classificações erradas em volume relevante ("muita questão nada haver"). Decisão: usar a árvore oficial do TEC (que já classificou as questões via campo `questoes.assunto`), sem rerodar pipeline de classificação.

**Achado decisivo do diagnóstico:** match exato entre `questoes.assunto` e `taxonomia_nodes.nome` da árvore TEC cobre **97.07%** das questões de Direito Administrativo (113.810 mapeadas / 117.243 com assunto preenchido). Os 3% restantes são leis estaduais específicas tratadas como bucket "Outros".

## Goal

Filtro hierárquico de tópicos pra Direito Administrativo no app, baseado na árvore oficial do TEC, sem branding TEC visível ao aluno (renomeação fica pra Leva 2).

## Escopo

**Dentro:**
- Direito Administrativo apenas (Federal + Estadual + Municipal — 3 sub-árvores TEC unificadas via L1 sintéticos)
- Schema, pipeline de import, API, frontend completo
- Trigger Postgres pra sync automática `assunto → taxonomia_node_id`
- Bucket "Outros" pras 3% questões órfãs

**Fora:**
- Curadoria manual via UI (Leva 2)
- Renomeação dos nomes TEC ("não dar na cara") (Leva 2)
- Outras 106 matérias (Leva 3+)
- Detecção automática de drift TEC↔nossa árvore (Leva 2 ou backlog)

## Decisões já tomadas (referência rápida)

1. **Sync de novas questões:** trigger Postgres `BEFORE INSERT/UPDATE OF assunto, materia ON questoes`
2. **Órfãs (3%):** bucket sintético "Outros / Sem classificação"
3. **Captura JSON do TEC:** modo C+B — manual default (arquivos locais), opt-in HTTP fetch via flag `--fetch-from-tec`
4. **L1 sintéticos:** linhas físicas em `taxonomia_nodes` com `is_sintetico = TRUE`. Inseridos pelo pipeline somente quando matéria tem 2+ fontes.
5. **Reuso de código backup:** backend reaproveitado, frontend reescrito (TaxonomiaTreePicker novo), hooks reaproveitados
6. **Coluna na `questoes`:** `taxonomia_node_id` (não `assunto_canonical_id` que pertence a outro projeto, não `assunto_tec_id` por evitar branding externo)
7. **Matéria no DB:** mantida como está (`'Direito Administrativo'` engloba federal+estadual; `'Direito Administrativo Municipal'` separada). Sem migração de dados.

## Arquitetura

```
┌──────────────────────────────────────────────────────┐
│  Frontend (Next.js + React)                          │
│  - TaxonomiaTreePicker (novo, ~300 linhas)           │
│  - 5 hooks reaproveitados do backup                  │
│  - chips, recentes, contadores dinâmicos             │
└──────────────┬───────────────────────────────────────┘
               │ HTTP /api/v1/taxonomia/*
┌──────────────▼───────────────────────────────────────┐
│  Backend (FastAPI + SQLAlchemy)                      │
│  - 3 endpoints novos: árvore, materias, counts       │
│  - extensão de /questoes/search com ?node=           │
│  - cache Redis 5min nos counts                       │
└──────────────┬───────────────────────────────────────┘
               │ SQL
┌──────────────▼───────────────────────────────────────┐
│  Postgres                                            │
│  - tabela taxonomia_nodes (nós + L1 sintéticos)      │
│  - coluna questoes.taxonomia_node_id (FK)            │
│  - trigger BEFORE INSERT/UPDATE em questoes          │
│    resolve assunto → node_id automaticamente         │
└──────────────▲───────────────────────────────────────┘
               │ COPY/UPSERT
┌──────────────┴───────────────────────────────────────┐
│  Pipeline de import (Python script)                  │
│  - lê 3 JSONs (federal/estadual/municipal)           │
│  - gera 3 L1 sintéticos                              │
│  - faz diff vs estado atual no DB                    │
│  - apply atomicamente (transação)                    │
│  - backfill: UPDATE questoes SET                     │
│    taxonomia_node_id = lookup(assunto)               │
└──────────────────────────────────────────────────────┘
```

**Princípios:**
- Single source of truth: `taxonomia_nodes` no Postgres. Tudo (frontend, API, busca) deriva dela.
- Trigger é o coração: `assunto → node_id` é resolvido sempre, nunca pela aplicação. Zero drift.
- Sintéticos são linhas físicas — frontend e backend tratam tudo igual, sem if-else.
- Trabalho incremental: dá pra entregar, validar com Direito Adm, expandir pras 106 sem mudar arquitetura.

## Schema

### Tabela `taxonomia_nodes` (nova)

```sql
CREATE TABLE taxonomia_nodes (
    id              SERIAL PRIMARY KEY,
    id_externo      INTEGER UNIQUE,               -- ID do TEC (NULL pros sintéticos)
    materia         VARCHAR(100) NOT NULL,        -- 'Direito Administrativo'
    materia_slug    VARCHAR(50)  NOT NULL,        -- 'direito-administrativo'
    fonte           VARCHAR(20)  NOT NULL,        -- 'federal' | 'estadual' | 'municipal' | 'sintetico'
    nome            VARCHAR(300) NOT NULL,
    hierarquia      VARCHAR(20),                  -- '01', '02.01', '14.03.07' (NULL pros sintéticos)
    nivel           SMALLINT NOT NULL,            -- 0 (sintético) | 1 | 2 | 3 | 4
    parent_id       INTEGER REFERENCES taxonomia_nodes(id) ON DELETE RESTRICT,
    ordem           SMALLINT NOT NULL DEFAULT 0,
    is_sintetico    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_nodes_materia_slug ON taxonomia_nodes(materia_slug);
CREATE INDEX idx_tax_nodes_materia_fonte ON taxonomia_nodes(materia, fonte);
CREATE INDEX idx_tax_nodes_parent ON taxonomia_nodes(parent_id);
CREATE INDEX idx_tax_nodes_nome ON taxonomia_nodes(nome);
```

### Coluna nova em `questoes`

```sql
ALTER TABLE questoes
    ADD COLUMN taxonomia_node_id INTEGER REFERENCES taxonomia_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_questoes_tax_node ON questoes(taxonomia_node_id);
```

### Trigger de sincronização

```sql
CREATE OR REPLACE FUNCTION resolve_taxonomia_node()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assunto IS NULL OR NEW.assunto = '' THEN
        NEW.taxonomia_node_id := NULL;
    ELSE
        SELECT id INTO NEW.taxonomia_node_id
        FROM taxonomia_nodes
        WHERE nome = NEW.assunto
          AND materia = NEW.materia
          AND is_sintetico = FALSE
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resolve_taxonomia
    BEFORE INSERT OR UPDATE OF assunto, materia ON questoes
    FOR EACH ROW EXECUTE FUNCTION resolve_taxonomia_node();
```

### Pontos de design importantes

1. **`materia` é constraint do match** — questão de "Direito Administrativo" só matcha nó cuja `taxonomia_nodes.materia = 'Direito Administrativo'`. Evita ambiguidade entre matérias.
2. **L1 sintéticos pra Direito Administrativo (3 linhas físicas no DB):**
   ```
   id=1, fonte='sintetico', nome='Direito Administrativo Federal',          nivel=0, parent_id=NULL
   id=2, fonte='sintetico', nome='Direito Administrativo Estadual e do DF', nivel=0, parent_id=NULL
   id=3, fonte='sintetico', nome='Direito Administrativo Municipal',        nivel=0, parent_id=NULL
   ```
   Cada nó TEC L1 tem `parent_id` apontando pra um sintético. **O nó "Outros / Sem classificação" NÃO é linha no DB** — é virtual, computado pelo endpoint da árvore quando há questões com `taxonomia_node_id IS NULL`.
3. **Trigger ignora sintéticos no lookup** — questão real só matcha nó TEC real. Filtro pelo L1 funciona via "todos descendentes do sintético" (recursive CTE no endpoint).
4. **`ON DELETE SET NULL` em `questoes.taxonomia_node_id`** — se um nó for deletado, questões viram órfãs e caem no bucket "Outros" automaticamente.
5. **Sem tabela de versions, sem audit log, sem junction `questao_topico`.** YAGNI: a Leva 1 só precisa do estado atual da árvore.
6. **Sintéticos são opt-in pelo pipeline:** matérias com 1 fonte (ex: Direito Penal) não têm sintéticos, TEC L1s têm `parent_id = NULL` direto.

## Pipeline de import

### Estrutura de diretórios

```
verus_api/
├── data/taxonomia/direito-administrativo/
│   ├── federal.json
│   ├── estadual.json
│   └── municipal.json
└── scripts/
    └── import_taxonomia.py
```

### Fases

```
Fase 1 — LOAD (em memória, sem tocar DB)
    1.1 Lê os 3 JSONs (ou faz fetch HTTP se --fetch-from-tec)
    1.2 Parse recursivo, extrai todos os nós
    1.3 Adiciona 3 L1 sintéticos no topo
    1.4 Reparenta nós TEC L1 → seu sintético correspondente

Fase 2 — DIFF + VALIDATE
    2.1 Lê estado atual da taxonomia_nodes (matéria atual)
    2.2 Calcula:
         - ADDED:    id_externo não existe no DB
         - RENAMED:  mesmo id_externo, nome diferente
         - MOVED:    mesmo id_externo, parent diferente
         - DELETED:  id_externo no DB mas não no JSON novo
    2.3 Sanity checks:
         - Sem ciclos no parent_id
         - Nenhum DELETED com questoes apontando (refusa sem --force)
         - L1 sintéticos sempre presentes
    2.4 Imprime DIFF SUMMARY humano
         (+ adicionados, ~ renomeados, → movidos, - deletados)

Fase 3 — APPLY (transação)
    3.1 BEGIN
    3.2 INSERT/UPDATE/DELETE em taxonomia_nodes (folhas primeiro)
    3.3 Backfill: UPDATE questoes SET taxonomia_node_id = lookup(assunto)
        WHERE materia = 'Direito Administrativo'
          AND assunto IS NOT NULL
        - Trigger desabilitado durante backfill (performance)
        - Re-habilitado antes do COMMIT
    3.4 COMMIT (ou ROLLBACK se algo falhar)
```

### CLI

```bash
# Modo C (default — recomendado)
python scripts/import_taxonomia.py --materia "Direito Administrativo" \
    --files data/taxonomia/direito-administrativo/{federal,estadual,municipal}.json

# Modo dry-run
python scripts/import_taxonomia.py --materia "Direito Administrativo" \
    --files data/taxonomia/direito-administrativo/*.json --dry-run

# Modo B (opt-in — fetch HTTP do TEC)
python scripts/import_taxonomia.py --materia "Direito Administrativo" --fetch-from-tec
```

### Performance esperada

- 848 nós × INSERT/UPDATE = milissegundos
- UPDATE em 137k questões com índice em `assunto` = ~5-10 segundos
- Total: pipeline roda em < 30 segundos pra Direito Adm

## API endpoints

### `GET /api/v1/taxonomia/materias`

Lista matérias com taxonomia. Frontend usa pra decidir se renderiza TreePicker.

```json
[
  {
    "slug": "direito-administrativo",
    "nome": "Direito Administrativo",
    "fontes": ["federal", "estadual", "municipal"],
    "total_nodes": 851,
    "total_questoes_classificadas": 113810,
    "last_updated": "2026-04-28T03:14:22Z"
  }
]
```

Cache: ETag (poucas matérias, raramente muda).

### `GET /api/v1/taxonomia/{materia_slug}`

Árvore completa, recursive nested. Backend monta a partir das linhas físicas em `taxonomia_nodes` + adiciona o nó virtual "Outros" no fim quando há questões órfãs.

```json
{
  "materia": "Direito Administrativo",
  "fontes": ["federal", "estadual", "municipal"],
  "tree": [
    {
      "id": 1,
      "nome": "Direito Administrativo Federal",
      "is_sintetico": true,
      "children": [
        {
          "id": 100,
          "nome": "Origem, Conceito e Fontes do Direito Administrativo",
          "hierarquia": "01",
          "is_sintetico": false,
          "children": []
        }
      ]
    },
    {
      "id": "outros",
      "nome": "Outros / Sem classificação",
      "is_sintetico": true,
      "is_virtual": true,
      "children": []
    }
  ]
}
```

- 4 raízes pra Direito Administrativo: 3 sintéticos físicos (Federal/Estadual/Municipal) + 1 virtual ("Outros") computado on-the-fly
- "Outros" só aparece quando `COUNT(*) FROM questoes WHERE taxonomia_node_id IS NULL AND materia = X > 0`
- Construída via recursive CTE no Postgres + nesting em Python
- ETag forte: hash do `MAX(updated_at)` da matéria
- 304 Not Modified quando nada mudou

### `POST /api/v1/taxonomia/{materia_slug}/counts`

Contadores dinâmicos por filtro aplicado.

Request:
```json
{
  "banca": ["CEBRASPE (CESPE)"],
  "ano": [2023, 2024],
  "excluir_anuladas": true,
  "excluir_desatualizadas": false
}
```

Response — flat `node_id → count`:
```json
{
  "1": 45123,
  "2": 4290,
  "100": 1234
}
```

- Cache Redis 5min, key = `counts:{slug}:{sha256(body)}`
- Counts agregados (incluem descendentes via recursive CTE)
- Sem filtros → 304 idêntico ao tree estático

### `GET /api/v1/questoes/search` — extensão

Adiciona query param `node` (numérico, repetível):

```
GET /api/v1/questoes/search?materia=Direito+Administrativo&node=101&node=102&banca=CEBRASPE
```

- Pra cada `node`, expande pros descendentes via recursive CTE
- `WHERE taxonomia_node_id IN (descendentes)`
- Multi-`node` = OR

**Bucket "Outros":** `?node=outros` (string especial) → traduz pra `WHERE taxonomia_node_id IS NULL`.

Resposta de cada questão ganha campo:
```json
{
  "taxonomia": {
    "node_id": 101,
    "path": ["Direito Administrativo Federal", "Atos Administrativos"],
    "is_sintetico_root": "Federal"
  }
}
```

### Performance estimada

- Tree endpoint: <50ms (cached via ETag)
- Counts endpoint: <200ms primeiro hit, <5ms cached
- Search com `?node=`: <100ms

## Frontend

### Estrutura de arquivos

```
src/
├── components/questoes/
│   ├── TaxonomiaTreePicker.tsx        (NOVO, ~300 linhas)
│   ├── QuestoesFilterPopover.tsx      (modifica)
│   └── FilterChipsBidirectional.tsx   (modifica)
├── hooks/
│   ├── useMaterias.ts                 (REUSO leve)
│   ├── useTaxonomia.ts                (REUSO leve)
│   ├── useTaxonomiaCounts.ts          (REUSO + prefetch)
│   ├── useTaxonomiaRecentes.ts        (REUSO — localStorage)
│   └── useNodeChipResolver.ts         (REUSO — para chips mostrarem path)
└── contexts/
    └── QuestoesContext.tsx            (modifica — adiciona nodeIds)
```

### Layout do TaxonomiaTreePicker

```
┌─────────────────────────────────────────────────────┐
│ 🔍  Buscar tópico...                          [✕]   │
├─────────────────────────────────────────────────────┤
│ Recentes:                                           │
│   • Atos Administrativos · 1.234                    │
│   • Lei nº 8.112/1990 · 2.456                       │
├─────────────────────────────────────────────────────┤
│ ▼ 📁 Direito Administrativo Federal     [137.209]   │
│    ▶ 01. Origem, Conceito e Fontes      [   234]    │
│    ▼ 03. Atos Administrativos           [ 8.234]    │
│       ☐ Conceito de Atos Administrativos[ 1.234]    │
│       ☐ Mérito Administrativo           [   456]    │
│ ▶ 📁 Direito Administrativo Estadual    [ 13.000]   │
│ ▶ 📁 Direito Administrativo Municipal   [    463]   │
│ ▶ 📁 Outros / Sem classificação         [  3.433]   │
└─────────────────────────────────────────────────────┘
```

### Comportamentos

- **Counts dinâmicos:** atualizam quando outros filtros mudam, com pulse animation suave.
- **Esconder nós com 0 questões:** toggle no header (default ON).
- **Search:** fuse.js sobre `nome` + `hierarquia`. Match parcial expande paths até cada match.
- **Multi-seleção OR:** checkbox por nó; clicar num pai não marca filhos automaticamente.
- **L1 sintéticos colapsados:** Federal aberto por default, Estadual/Municipal/Outros colapsados.
- **Recentes:** top 5 IDs do localStorage, ordenados por timestamp. Limite 20 entradas, FIFO.
- **Tooltip de path:** hover em qualquer nó mostra path completo "Direito Administrativo › Federal › 03. Atos Administrativos".

### Estado em `QuestoesContext`

```typescript
type QuestoesFilters = {
  materias: string[];
  bancas: string[];
  anos: number[];
  // ...
  nodeIds: (number | 'outros')[];  // NOVO
};
```

URL serialization: `?node=101&node=102&node=outros`

### Decisões UX importantes

1. **Backend retorna IDs numéricos, frontend trabalha sempre com IDs** — nunca compara strings de matéria/nome. Evita o bug do anterior (`materiasComTax` slug vs nome humano).
2. **Bucket "Outros"** tem nó sintético com `id = 'outros'` (string especial); frontend trata igual aos outros, backend traduz pra `IS NULL`.
3. **Hooks separados por responsabilidade** — `useTaxonomia` só busca árvore, `useTaxonomiaCounts` só counts dinâmicos.
4. **Sem reset entre matérias** — `nodeIds` persiste; nós inválidos pra matéria atual são ignorados na render mas mantidos no estado.

## Erros e edge cases

### Pipeline

| Cenário | Tratamento |
|---|---|
| JSON malformado | Aborta antes de tocar DB |
| Ciclo no `parent_id` | Detecta no Fase 2, aborta |
| DELETE com questões apontando | Lista quantas, exige `--force` |
| `id_externo` duplicado | Aborta — sinal de bug ou regra TEC mudou |
| Conexão DB cai no meio | ROLLBACK automático |
| L1 sintéticos somem do topo | Erro fatal — pipeline não pode operar sem eles |
| Re-execução da mesma versão | Idempotente — UPSERT detecta zero diff e finaliza em <1s |

### Trigger Postgres

| Cenário | Tratamento |
|---|---|
| Backfill bulk de 137k questões | Desabilita trigger, UPDATE com lookup explícito (CTE), re-habilita |
| INSERT com `assunto` que não bate | `taxonomia_node_id` fica NULL — bucket "Outros" pega na UI |
| `assunto` modificado pra string vazia | Trigger seta `taxonomia_node_id = NULL` |
| `materia` modificada (raro) | Trigger reavalia |
| Deadlock entre trigger e import | Advisory lock no script previne 100% |

### API

| Cenário | Tratamento |
|---|---|
| Slug inexistente | 404 com lista das matérias disponíveis |
| `?node=999999` (ID inexistente) | 400 com mensagem clara |
| `?node=outros` sem órfãs | Lista vazia, status 200 |
| Recursive CTE com ciclo | LIMIT depth=10, corta antes de loop |
| Redis indisponível | Cai pra query direta — slowdown mas não quebra |
| Concurrent counts mesma chave | SETNX 5s — primeiro calcula, outros aguardam |

### Frontend

| Cenário | Tratamento |
|---|---|
| API tree 500 | Fallback FlatList tradicional + toast discreto |
| Cache stale após import | ETag mismatch força refetch automático |
| Counts em loading | Valor estático cinza claro + spinner, fade pra dinâmico |
| `nodeIds` no estado mas matéria mudou | Mantém IDs, renderiza chips só dos válidos |
| URL com 50 `?node=` | Funciona — cabe ~200 params em URL |
| localStorage cheio | Catch silencioso, evict oldest, limite 20 |
| Search sem resultado | Mensagem clara "Nenhum tópico encontrado" |
| Mobile <600px | Picker vira drawer full-height bottom sheet |

### Dados

| Cenário | Tratamento |
|---|---|
| `assunto` com espaço extra ou typo | Não matcha, fica em "Outros" — admin investiga |
| TEC renomeia nó entre imports | Diff detecta via `id_externo` igual + `nome` diferente, faz UPDATE |
| TEC remove nó | Diff detecta; refusa se houver questões apontando (sem flag); com flag, FK joga pra "Outros" |
| Questão criada **durante** o import | Advisory lock serializa |

## Testing

### Backend — testes automáticos

```
verus_api/tests/taxonomia/
├── test_trigger.py
├── test_import_load.py
├── test_import_diff.py
├── test_import_apply.py
├── test_endpoint_materias.py
├── test_endpoint_tree.py
├── test_endpoint_counts.py
└── test_search_with_node.py
```

Casos críticos:
- Trigger seta NULL pra `assunto` que não bate
- Trigger ignora sintéticos no lookup
- Diff detecta rename via `id_externo` igual + `nome` diferente
- DELETE com questões apontando bloqueia sem `--force`
- Recursive CTE para na profundidade 10
- Redis down → counts ainda funcionam

### Frontend — testes automáticos

Casos críticos:
- `useQuestoesV2.fetchQuestoes` serializa `nodeIds` na URL como `?node=` (este é EXATAMENTE o bug do GRAN — teste explícito obrigatório)
- `materiasComTax` no popover usa ID/slug, nunca nome humano
- Picker re-renderiza quando matéria muda
- Recentes deduplica e limita corretamente

### End-to-end manual — checklist obrigatório

Reproduz fluxo do aluno do clique até o SQL final, no ambiente real.

```
1. Login → Questões → seleciona "Direito Administrativo" na pill Matéria
   ✓ Pill "Assuntos" abre TaxonomiaTreePicker (não FlatList)

2. Estrutura inicial
   ✓ 4 grupos L0: Federal (~137k), Estadual (~13k), Municipal (~463), Outros (~3.4k)
   ✓ Federal expandido, demais colapsados

3. Marca "03. Atos Administrativos"
   ✓ Chip aparece, URL ganha "?node=<id>", lista filtra
   ✓ Tooltip do chip: "Federal › 03. Atos Administrativos"

4. Adiciona "11. Improbidade Administrativa"
   ✓ Segundo chip, lista vira OR dos dois

5. Adiciona Banca = CESPE
   ✓ Counts no picker atualizam (pulse)

6. Marca "Direito Administrativo Estadual"
   ✓ Filtra ~13k questões com assunto estadual

7. Marca "Outros / Sem classificação"
   ✓ Filtra 3.4k órfãs (IS NULL no backend)

8. Recentes persistem após reload (localStorage)

9. Search no picker funciona com paths expandidos

10. Performance: tree <300ms, counts <500ms, filtro <800ms

11. Mobile: bottom sheet, scroll, chips quebram linha

12. URL com ?node= é restaurada após logout/login
```

### Smoke tests pós-deploy

```bash
curl -I https://api.../api/v1/taxonomia/materias                              # 200
curl https://api.../api/v1/taxonomia/direito-administrativo | jq '.tree | length'  # 4
curl -X POST https://api.../api/v1/taxonomia/direito-administrativo/counts \
    -d '{"banca":["CEBRASPE (CESPE)"]}' -H "Content-Type: application/json" | jq 'length'
```

### Testes de carga (1× antes de release)

- 100 requests concorrentes em `/counts` → P95 < 1s
- 1000 requests em `/tree` (cached) → P95 < 50ms
- Backfill bulk em base de teste com 1M questões → < 60s

## Lições do GRAN incorporadas

1. **Validação manual end-to-end obrigatória** antes de cada task ser marcada done. Per-task review não pegou drift cross-stack.
2. **Trigger Postgres ao invés de aplicação** — elimina classe inteira de bugs de drift entre fluxos (admin, ETL, importação).
3. **Frontend sempre usa IDs, nunca strings de matéria/nome** — evita o bug `materiasComTax` (slug vs nome humano).
4. **Sem LLM/embedding nesta leva** — TEC é a fonte da verdade, classificação determinística por match exato.
5. **Schema mínimo (YAGNI)** — sem versions, audit log, junction. Pode adicionar na Leva 2 se demandar curadoria manual.

## Follow-ups (Levas seguintes)

- **Leva 2 — curadoria manual via UI:** admin reassign questões individuais, adiciona aliases, renomeia nós ("não dar na cara TEC"). Brainstorm dedicado.
- **Leva 3+ — outras 106 matérias:** mesmo pipeline, capturar JSONs do TEC por matéria, importar. Algumas matérias terão estrutura diferente (1 fonte só, ou outras divisões).
- **Drift detection:** painel admin lista órfãs por padrão de lei (`Lei nº X` regex), permite bulk-reassign ou criação de nó sintético.
- **Reaproveitar `assunto_canonical_id`:** se matching pipeline retomar, decide se converge nas mesmas IDs ou mantém colunas separadas.

## Open questions (resolver no plan)

Nenhuma — todas as decisões arquiteturais foram fechadas no brainstorm.
