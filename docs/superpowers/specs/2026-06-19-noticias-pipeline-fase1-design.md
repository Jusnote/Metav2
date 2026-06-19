# Spec — Portal de Notícias de Concursos · Fase 1 (Ingestão + Storage)

**Data:** 2026-06-19
**Status:** aprovado para implementação (pendente revisão final do Aldemir)
**Escopo desta spec:** apenas a Fase 1 (fundação do pipeline). Fases 2–4 descritas em "Roadmap" só para contexto.

---

## 1. Visão geral e objetivo

Construir a base de um portal de notícias de concursos públicos dentro do ecossistema MetaV2/verus_api. A Fase 1 entrega **somente o pipeline de ingestão e armazenamento**: um worker que, de hora em hora, busca notícias de concurso de duas APIs (NewsData.io + GNews.io), deduplica e grava num schema próprio do Postgres de produção.

**Sem UI, sem API pública, sem enriquecimento por IA nesta fase.** O critério de sucesso é puramente de dados: olhar a tabela `noticias.itens` enchendo com notícias relevantes, frescas e sem duplicatas, de forma idempotente (rodar o cron N vezes não cria lixo).

### Por que esta ordem

A ingestão é a fundação — Fases 2 (enriquecimento IA), 3 (páginas SEO) e 4 (feed in-app) todas dependem de ter notícia limpa no banco. Entregar o pipeline isolado é verificável sozinho e destrava o resto.

### Tese do produto (contexto, não escopo da Fase 1)

Agregar notícia não nos torna o maior portal — legalmente só exibimos título + resumo curto + link para a fonte. O fosso é que o MetaV2 já tem **banco de questões (3,29M), editais e cronograma**: a notícia vira porta de entrada para o estudo ("saiu o edital → 1.240 questões dessa banca → monte o cronograma"). O enriquecimento por IA (Fase 2) é o que torna cada página original o suficiente para **ranquear** no Google (não só indexar) e converter visitante em aluno.

---

## 2. Decisões travadas

| Item | Decisão | Motivo |
|---|---|---|
| Fontes | NewsData.io (primária) + GNews.io (secundária) | Únicas 2 das 5 APIs testadas com boa cobertura de concurso BR (114 e 7.422 itens), imagem e descrição prontas. Validado em 2026-06-19. |
| Runtime | Container dedicado no Coolify do servidor **95.217.197.95** | Servidor de produção (dedicado, 16 cores, 62GB, ocioso). Co-localiza notícia com as questões → JOIN local nas fases seguintes. |
| Storage | Schema `noticias.*` no Postgres de produção (container pgvector pg17 `u40kcogk...`, db `postgres`) | Mesmo banco das questões (3,29M) → o match notícia↔questões (Fase 2) é JOIN local, não chamada cross-service. |
| Fila/cache | Redis já existente no 95 | Lock de execução agora; fila de enriquecimento na Fase 2. |
| Dedup | Normalização de URL + constraint `UNIQUE(normalized_url)` + upsert idempotente | Simples e robusto. Dedup por similaridade de título fica para depois (nice-to-have). |
| Linguagem | Python (httpx + SQLAlchemy/asyncpg) | Stack que o time já domina; Fase 2 usa Anthropic em Python. |
| Repositório | **Repo novo dedicado** (ex.: `concursos-news`), NÃO dentro do verus_api | O worker compartilha o banco, não o código (escreve no schema `noticias.*` próprio). Bounded context separado: dependências isoladas, imagem menor, raio de explosão menor (não quebra o build da API de produção). O Coolify trata como Application separada de qualquer forma. |
| Gestão do schema | Alembic próprio, com `version_table_schema='noticias'` | Independente do `alembic_version` do verus_api (schema `public`). |
| Agendamento | Scheduler in-process (APScheduler) no worker long-running | Container autocontido, sem depender de cron de host/Coolify. |
| Publicação | Coluna `status` default `pending` já criada | Moderação antes de publicar (decisão do produto). Workflow de aprovação é Fase 3. |
| Segredos | Chaves das APIs e DSN do banco via variáveis de ambiente | Nunca hardcoded/commitado. |

---

## 3. Arquitetura da Fase 1

```
  [NewsData.io]        [GNews.io]
        \                  /
         ▼                ▼
   ┌──────────────────────────────┐
   │  PROVIDER LAYER              │  cada provider busca e normaliza
   │  NewsDataProvider           │  → formato único NewsItem
   │  GNewsProvider              │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │  DEDUP                       │  normaliza URL → descarta duplicata
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │  REPOSITORY (upsert)         │  ON CONFLICT (normalized_url) DO NOTHING
   └──────────────┬───────────────┘
                  ▼
        Postgres: noticias.itens   (+ Redis lock)
                  ▲
   ┌──────────────┴───────────────┐
   │  SCHEDULER (APScheduler)     │  dispara o ciclo de hora em hora
   └──────────────────────────────┘
```

### Componentes (cada um com propósito, interface e dependências)

**1. Provider layer** — `providers/`
- *Propósito:* isolar o detalhe de cada API atrás de uma interface única. A camada de dedup/repo não sabe (nem liga) de onde a notícia veio.
- *Interface:* `Provider.fetch(since: datetime) -> list[NewsItem]`
- *Implementações:* `NewsDataProvider` (`q="concurso edital"&country=br`, paginação via `nextPage`), `GNewsProvider` (`q="concurso edital"&lang=pt&country=br&max=10`).
- *Depende de:* httpx, chaves via env.

**2. Normalizador** — `providers/normalize.py`
- *Propósito:* mapear o JSON cru de cada API para o `NewsItem` canônico.
- *Depende de:* nada além dos tipos.

**3. Dedup** — `dedup.py`
- *Propósito:* gerar `normalized_url` e decidir se o item é novo.
- *Interface:* `normalize_url(url: str) -> str`
- *Depende de:* nada (função pura — fácil de testar).

**4. Repository** — `repository.py`
- *Propósito:* persistir `NewsItem` em `noticias.itens` de forma idempotente.
- *Interface:* `upsert_many(items: list[NewsItem]) -> InsertStats` (retorna inseridos/ignorados).
- *Depende de:* SQLAlchemy/asyncpg, DSN via env.

**5. Scheduler / entrypoint** — `worker.py`
- *Propósito:* orquestrar o ciclo (lock Redis → fetch de cada provider → dedup → upsert → log), de hora em hora.
- *Depende de:* APScheduler, Redis, os componentes acima.

---

## 4. Contrato do `NewsItem` (formato canônico)

```python
@dataclass
class NewsItem:
    provider: str            # 'newsdata' | 'gnews'
    external_id: str | None  # id do artigo na origem, se houver
    source_name: str         # ex.: "Folha Dirigida", "G1"
    title: str
    description: str | None
    url: str                 # link original (manda o usuário pra fonte)
    image_url: str | None
    published_at: datetime   # timezone-aware (UTC)
    lang: str                # ex.: "pt"
    category: list[str] | None   # só NewsData
    keywords: list[str] | None   # só NewsData
    raw: dict                # payload bruto do provider (auditoria/reprocesso)
```

Campos que a GNews não fornece (`category`, `keywords`, `external_id` em alguns casos) entram como `None` — o consumidor trata ausência.

---

## 5. Schema do banco — `noticias.itens`

```sql
CREATE SCHEMA IF NOT EXISTS noticias;

CREATE TABLE noticias.itens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        text        NOT NULL,             -- 'newsdata' | 'gnews'
    external_id     text,                              -- id na origem (nullable)
    source_name     text        NOT NULL,
    title           text        NOT NULL,
    description     text,
    url             text        NOT NULL,
    normalized_url  text        NOT NULL,
    image_url       text,
    published_at    timestamptz NOT NULL,
    lang            text,
    category        text[],
    keywords        text[],
    raw             jsonb       NOT NULL,
    status          text        NOT NULL DEFAULT 'pending',  -- pending|approved|published|rejected
    fetched_at      timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_itens_normalized_url ON noticias.itens (normalized_url);
CREATE INDEX ix_itens_published_at ON noticias.itens (published_at DESC);
CREATE INDEX ix_itens_status       ON noticias.itens (status);
```

**Gestão do schema:** alembic próprio do repo de notícias, configurado com `version_table_schema='noticias'` — totalmente independente do `alembic_version` do verus_api (que vive no schema `public` do mesmo banco). Assim os dois serviços evoluem o banco sem colidir.

---

## 6. Lógica de deduplicação

`normalize_url(url)`:
1. lowercase no host;
2. remove fragmento (`#...`);
3. remove query params de tracking (`utm_*`, `fbclid`, `gclid`, `ref`, etc.) — mantém params que mudam o conteúdo;
4. remove barra final redundante;
5. força `https` quando o host suporta (ou normaliza o esquema).

A mesma matéria sindicada (ex.: O Dia aparecendo no NewsData e no GNews) colapsa na mesma `normalized_url` e o upsert ignora a segunda via `ON CONFLICT (normalized_url) DO NOTHING`.

*Fora de escopo da Fase 1:* dedup por similaridade de título (para casos onde a URL difere mas a notícia é a mesma). Anotado como melhoria futura.

---

## 7. Agendamento, quota e custo

- **Frequência:** 1×/hora (configurável via env `NOTICIAS_INGEST_INTERVAL_MIN`, default 60).
- **Quota por ciclo:** NewsData ~1–2 créditos (1–2 páginas), GNews 1 requisição.
- **Consumo diário:** ~48 créditos NewsData (de 200 free/dia) e ~24 req GNews (de 100 free/dia). Folga grande — dá até pra rodar a cada 30 min se quiser.
- **Lock:** chave Redis com TTL impede ciclos sobrepostos (se um ciclo demorar mais que o intervalo).

---

## 8. Tratamento de erros

- **Isolamento por provider:** falha numa API não derruba a outra — cada `fetch` é try/except próprio; o ciclo segue com o que conseguiu.
- **Quota estourada (HTTP 429):** loga, faz back-off e pula até o próximo ciclo (não derruba o worker).
- **Item malformado:** validação no normalizador; item inválido é descartado com log (não aborta o lote).
- **Banco indisponível:** o ciclo falha e loga; o próximo ciclo reprocessa (idempotência garante que nada duplica).
- **Observabilidade:** cada ciclo loga `{provider, buscados, novos, ignorados, erros, duração}`.

---

## 9. Como verificar (critérios de aceite)

**Testes unitários:**
- `normalize_url`: tabela de casos (utm, fragmento, barra final, host maiúsculo, mesma matéria de 2 fontes → mesma URL).
- Normalizadores: usar fixtures dos JSONs reais capturados em 2026-06-19 (NewsData e GNews) → asserir mapeamento correto pro `NewsItem`.

**Teste de integração (dev):**
- Rodar 1 ciclo contra as APIs reais → asserir que `noticias.itens` recebeu linhas com `title`, `url`, `published_at` preenchidos.
- Rodar o ciclo **de novo** → asserir que a contagem **não** cresce com duplicatas (idempotência).

**Verificação manual:**
- `SELECT count(*), provider FROM noticias.itens GROUP BY provider;` cresce a cada hora.
- Amostra de 10 linhas: títulos são de concurso, datas recentes, sem duplicatas óbvias.

---

## 10. Fora de escopo da Fase 1 (roadmap)

| Fase | Entrega |
|---|---|
| **2. Enriquecimento IA** | Classifica notícia por órgão/banca/cargo/matéria; gera análise original (anti-duplicata p/ SEO); casa com questões (JOIN local) e editais (GraphQL). Fila no Redis. |
| **3. Páginas públicas SEO** | Rotas Next.js **server-rendered** `/noticias` + `/noticias/[slug]` (o SPA atual não indexa) + sitemap + CTAs de conversão. Workflow de moderação (pending→published). |
| **4. Feed in-app** | Superfície de retenção para o usuário logado, reusando o mesmo banco/API. |

---

## 11. Notas de infraestrutura

- Servidor de produção: **95.217.197.95** (dedicado, Coolify). Container novo do worker entra aqui.
- Postgres de produção: container pgvector pg17 `u40kcogk488gc8w8ok0sgkow`, db `postgres` — onde vivem as 3,29M questões e onde o schema `noticias.*` será criado.
- A API de editais (para o match da Fase 2) também roda no 95 (GraphQL via sslip.io) — a confirmar no plano da Fase 2 se o match pode ser JOIN local ou via GraphQL.
- O servidor antigo 78.46.230.137 foi desativado em 2026-06-19 (não usar em nenhuma config).
