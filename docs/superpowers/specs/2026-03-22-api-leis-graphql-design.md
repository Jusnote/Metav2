# API Leis GraphQL — Design Spec v1

**Date:** 2026-03-22
**Status:** Approved
**Parent spec:** `2026-03-20-lei-seca-api-architecture-design.md`
**Scope:** Standalone GraphQL API server for Brazilian law data (Fastify + Mercurius)

## Overview

Standalone Node.js API serving Brazilian law data via GraphQL. Reads from existing PostgreSQL database on Hetzner (CC + CP already uploaded, 1M+ laws in pipeline). No authentication in v1 — CORS-only. Deployed via Coolify on same Hetzner server.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Project location | Separate repo (`api-leis`) | Independent deploy, standalone product potential |
| Runtime | Node.js + TypeScript (`tsc` + `node`) | Mercurius is Fastify-native, zero compat risk |
| v1 scope | All 4 queries (leis, lei, dispositivos, busca) | Schema defined in parent spec, resolvers are straightforward |
| Search | PostgreSQL tsvector (`pt_unaccent` config) | Already configured, accent-insensitive search works |
| Auth v1 | None, CORS only | Public data, server has spare capacity |
| Auth v2 (future) | API key + fastify-rate-limit | For monetization, not implemented now |

## Project Structure

```
api-leis/
├── src/
│   ├── index.ts              ← Fastify + Mercurius setup, CORS, health check
│   ├── schema.ts             ← GraphQL schema (SDL string)
│   ├── resolvers/
│   │   ├── lei.ts            ← leis(), lei() resolvers
│   │   ├── dispositivo.ts    ← dispositivos() resolver
│   │   └── busca.ts          ← busca() resolver (tsvector)
│   ├── db.ts                 ← pg Pool singleton
│   └── types.ts              ← TypeScript interfaces
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

## Dependencies

```json
{
  "dependencies": {
    "fastify": "^5",
    "@fastify/cors": "^10",
    "mercurius": "^15",
    "pg": "^8"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/pg": "^8",
    "@types/node": "^22",
    "tsx": "^4"
  }
}
```

## GraphQL Schema

```graphql
type Query {
  leis(
    nivel: Nivel
    tipo: String
    status: Status
    offset: Int = 0
    limit: Int = 50
  ): LeisConnection!

  lei(id: String!): Lei

  dispositivos(
    leiId: String!
    path: String
    tipos: [TipoDispositivo!]
    incluirRevogados: Boolean = false
    offset: Int = 0
    limit: Int = 100
  ): DispositivosConnection!

  busca(
    termo: String!
    nivel: Nivel
    tipo: String
    leiId: String
    limit: Int = 20
  ): BuscaResult!
}

type Lei {
  id: String!
  titulo: String!
  ementa: String
  tipo: String!
  nivel: String!
  data: String
  status: String!
  hierarquia: JSON!
  stats: LeiStats!
}

type LeiStats {
  totalDispositivos: Int!
  totalArtigos: Int!
  totalRevogados: Int!
}

type Dispositivo {
  id: ID!
  tipo: TipoDispositivo!
  numero: String
  texto: String!
  epigrafe: String
  pena: String
  anotacoes: JSON
  links: JSON
  revogado: Boolean!
  path: String
  posicao: Int!
}

type BuscaResult {
  total: Int!
  hits: [BuscaHit!]!
}

type BuscaHit {
  dispositivo: Dispositivo!
  lei: Lei!
  highlight: String!
  score: Float!
}

type LeisConnection {
  nodes: [Lei!]!
  totalCount: Int!
}

type DispositivosConnection {
  nodes: [Dispositivo!]!
  totalCount: Int!
}

enum TipoDispositivo {
  ARTIGO PARAGRAFO INCISO ALINEA
  PENA EPIGRAFE SUBTITULO
  PARTE LIVRO TITULO CAPITULO SECAO SUBSECAO
  EMENTA PREAMBULO
}

enum Nivel { FEDERAL ESTADUAL MUNICIPAL }
enum Status { ATIVO REVOGADO }
```

**Design notes:**
- `hierarquia`, `anotacoes`, and `links` use `JSON` scalar (Mercurius built-in) — JSONB returned as-is. The parent spec defines typed `HierarquiaNode`/`Anotacao`/`ReferenciaCruzada` types; this is a deliberate v1 simplification. Typed fields can be added in v2 if frontend needs type-safe access.
- `raw_description` is intentionally excluded from the GraphQL schema — it contains raw HTML from JusBrasil and is only needed for re-processing, not for frontend consumption.
- `dispositivos.id` is `BIGINT` in PostgreSQL but `ID!` (string) in GraphQL. The `pg` driver returns BIGINT as string by default, which maps directly to GraphQL's `ID` scalar. Do not parse to `Number` — some `codeInt64` values may exceed `Number.MAX_SAFE_INTEGER`.
- `stats` is a field-level resolver on `Lei` — it only fires when the client requests it. In list queries (`leis`), clients should omit `stats` to avoid N+1 queries. For `lei()` single queries, stats are always available.
- `search_vector` columns in PostgreSQL use the `pt_unaccent` text search config (not `'portuguese'`). The parent spec shows `'portuguese'` but the actual DB was configured with `pt_unaccent` for accent-insensitive search. All tsvector queries must use `'pt_unaccent'` to match.
- All `limit` params are capped at 200 in the resolver (even if the client sends a higher value). This prevents full-table dumps.

## Resolver Details

### `leis(nivel, tipo, status, offset, limit) → LeisConnection`

```sql
SELECT *, COUNT(*) OVER() AS total_count
FROM leis
WHERE ($1::text IS NULL OR nivel = $1)
  AND ($2::text IS NULL OR tipo = $2)
  AND ($3::text IS NULL OR status = $3)
ORDER BY titulo
LIMIT $4 OFFSET $5
```

Defaults: `limit = 50`, `offset = 0`.

### `lei(id) → Lei`

```sql
SELECT * FROM leis WHERE id = $1
```

`stats` resolved via:
```sql
SELECT
  count(*) AS "totalDispositivos",
  count(*) FILTER (WHERE tipo = 'ARTIGO') AS "totalArtigos",
  count(*) FILTER (WHERE revogado = true) AS "totalRevogados"
FROM dispositivos
WHERE lei_id = $1
```

### `dispositivos(leiId, path, tipos, incluirRevogados, offset, limit) → DispositivosConnection`

```sql
SELECT *, COUNT(*) OVER() AS total_count
FROM dispositivos
WHERE lei_id = $1
  AND ($2::text IS NULL OR path LIKE $2 || '%')
  AND ($3::text[] IS NULL OR tipo = ANY($3))
  AND ($4::boolean IS TRUE OR revogado = false)
ORDER BY posicao ASC
LIMIT $5 OFFSET $6
```

Defaults: `incluirRevogados = false`, `limit = 100`, `offset = 0`.

### `busca(termo, nivel, tipo, leiId, limit) → BuscaResult`

Uses `websearch_to_tsquery` (supports `"exact phrase"` and `-exclude` syntax). CTEs ensure `ts_headline` only runs on the final N rows, not all matches:

```sql
WITH query AS (
  SELECT websearch_to_tsquery('pt_unaccent', $1) AS q
),
matches AS (
  SELECT
    d.id, d.tipo, d.numero, d.texto, d.epigrafe, d.pena,
    d.anotacoes, d.links, d.revogado, d.path, d.posicao,
    d.lei_id, d.search_vector,
    ts_rank(d.search_vector, query.q) AS score
  FROM dispositivos d
  JOIN leis l ON d.lei_id = l.id
  CROSS JOIN query
  WHERE d.search_vector @@ query.q
    AND ($2::text IS NULL OR l.nivel = $2)
    AND ($3::text IS NULL OR l.tipo = $3)
    AND ($4::text IS NULL OR d.lei_id = $4)
),
ranked AS (
  SELECT *, COUNT(*) OVER() AS total
  FROM matches
  ORDER BY score DESC
  LIMIT $5
)
SELECT
  r.id, r.tipo, r.numero, r.texto, r.epigrafe, r.pena,
  r.anotacoes, r.links, r.revogado, r.path, r.posicao,
  r.score, r.total,
  l.id AS lei_id, l.titulo, l.ementa, l.tipo AS lei_tipo,
  l.nivel, l.data AS lei_data, l.status AS lei_status,
  l.hierarquia, l.apelido AS lei_apelido,
  ts_headline('pt_unaccent', r.texto, query.q,
    'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
  ) AS highlight
FROM ranked r
JOIN leis l ON r.lei_id = l.id
CROSS JOIN query
ORDER BY r.score DESC
```

Default: `limit = 20`.

**Performance rationale:** `ts_headline` is CPU-intensive (re-parses text to find word positions). Without the CTE structure, a search for "crime" matching 50k dispositivos would generate 50k highlights before applying LIMIT. With CTEs, only the final N rows get highlights.

### Lei.stats — Mercurius Loader (batched)

`stats` uses a Mercurius Loader (native DataLoader) to prevent N+1 queries. When a client requests `leis(limit:50) { nodes { stats } }`, all 50 stats are resolved in a single query:

```sql
SELECT
  lei_id,
  count(*)::int AS "totalDispositivos",
  count(*) FILTER (WHERE tipo = 'ARTIGO')::int AS "totalArtigos",
  count(*) FILTER (WHERE revogado = true)::int AS "totalRevogados"
FROM dispositivos
WHERE lei_id = ANY($1)
GROUP BY lei_id
```

## Server Setup (src/index.ts)

```typescript
// Pseudocode structure
const app = Fastify({ logger: true })

app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') ?? [
    'https://metav2.vercel.app',
    'http://localhost:3000'
  ]
})

app.register(mercurius, {
  schema,
  resolvers,
  graphiql: process.env.NODE_ENV !== 'production'
})

app.get('/health', async () => ({ status: 'ok' }))

app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
```

## Database Connection (src/db.ts)

```typescript
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10
})
```

## Environment Variables

```env
DATABASE_URL=postgresql://leis:<password>@95.217.197.95:5434/leis
PORT=3001
CORS_ORIGINS=https://metav2.vercel.app,http://localhost:3000
NODE_ENV=production
```

## Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/index.js"]
```

## Coolify Deployment

- New service "API Leis" in existing project on Hetzner
- Source: Git repo (after push)
- Build: Dockerfile
- Port: 3001
- Env vars configured in Coolify dashboard
- Domain: to be configured later (IP:port works for initial testing)

## v2 Roadmap (not in scope)

- API key authentication (`x-api-key` header)
- Rate limiting (`fastify-rate-limit`, 100 req/min per IP)
- Typesense integration for search (typo tolerance, facets)
- Semantic search via Voyage-4-large embeddings
- WebSocket subscriptions for real-time updates
