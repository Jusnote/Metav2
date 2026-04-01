# API Leis GraphQL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone GraphQL API (Fastify + Mercurius) serving Brazilian law data from PostgreSQL.

**Architecture:** Separate Node.js + TypeScript project. Fastify HTTP server with Mercurius GraphQL plugin. Raw SQL via `pg` Pool against existing PostgreSQL on Hetzner (port 5434). No auth in v1, CORS-only.

**Tech Stack:** Node.js 22, TypeScript, Fastify 5, Mercurius 15, pg 8, Docker

**Spec:** `docs/superpowers/specs/2026-03-22-api-leis-graphql-design.md`

**Database:** Already running at `postgresql://leis:<password>@95.217.197.95:5434/leis` with CC (4939 dispositivos) + CP (3355 dispositivos) uploaded.

**Important DB details (from actual schema, not spec):**
- `leis` table has additional fields beyond spec: `apelido`, `estado`, `is_active`, `publisher` (JSONB), `parent_document` (JSONB), `published_date`, `updated_date`
- `dispositivos.tipo` values are UPPERCASE in the DB (e.g., `ARTIGO`, `PARAGRAFO`, `INCISO`) — process.js applies `.toUpperCase()` before saving. GraphQL enum matches directly, no conversion needed in resolvers
- `search_vector` uses `pt_unaccent` text search config — all tsquery calls must use `'pt_unaccent'`
- `id` in dispositivos is BIGINT — `pg` returns it as string, which maps to GraphQL `ID` scalar

**Project location:** New separate repo. Create at `D:\meta novo\api-leis\` (sibling to Metav2).

---

## File Structure

```
api-leis/
├── src/
│   ├── index.ts              ← Fastify server, CORS, Mercurius, health check, graceful shutdown
│   ├── schema.ts             ← GraphQL SDL string (all types, queries, enums)
│   ├── resolvers/
│   │   ├── lei.ts            ← leis() and lei() query resolvers + Lei.stats field resolver
│   │   ├── dispositivo.ts    ← dispositivos() query resolver
│   │   └── busca.ts          ← busca() query resolver (tsvector)
│   ├── db.ts                 ← pg Pool singleton, export pool + query helper
│   └── types.ts              ← TypeScript interfaces for DB rows and resolver args
├── tests/
│   ├── resolvers/
│   │   ├── lei.test.ts       ← Tests for leis/lei resolvers
│   │   ├── dispositivo.test.ts ← Tests for dispositivos resolver
│   │   └── busca.test.ts     ← Tests for busca resolver
├── Dockerfile
├── .dockerignore
├── .gitignore
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.dockerignore`, `.env.example`

- [ ] **Step 1: Create project directory and init git**

```bash
mkdir -p "/d/meta novo/api-leis" && cd "/d/meta novo/api-leis"
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "api-leis",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "node --import tsx --test tests/**/*.test.ts"
  },
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

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
```

- [ ] **Step 5: Create .dockerignore**

```
node_modules/
dist/
.env
.git/
tests/
```

- [ ] **Step 6: Create .env.example**

```env
DATABASE_URL=postgresql://leis:<password>@95.217.197.95:5434/leis
PORT=3001
CORS_ORIGINS=https://metav2.vercel.app,http://localhost:3000
NODE_ENV=development
```

- [ ] **Step 7: Install dependencies**

```bash
cd "/d/meta novo/api-leis" && npm install
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: project scaffold (Fastify + Mercurius + pg)"
```

---

## Task 2: Database Connection

**Files:**
- Create: `src/db.ts`

- [ ] **Step 1: Create src/db.ts**

```typescript
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

export { pool }
```

- [ ] **Step 2: Commit**

```bash
git add src/db.ts
git commit -m "feat: database pool connection"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

Define interfaces matching DB rows and GraphQL resolver args:

```typescript
// DB row types (what pg returns)
export interface LeiRow {
  id: string
  titulo: string
  apelido: string | null
  ementa: string | null
  tipo: string
  nivel: string
  estado: string | null
  data: Date | null
  status: string
  is_active: boolean
  hierarquia: unknown
  raw_metadata: unknown
  doc_id: number | null
  publisher: unknown
  parent_document: unknown
  published_date: string | null
  updated_date: string | null
  created_at: Date
  updated_at: Date
  // window function
  total_count?: string
}

export interface DispositivoRow {
  id: string          // BIGINT returned as string by pg
  lei_id: string
  tipo: string        // lowercase in DB
  numero: string | null
  texto: string
  raw_description: string
  epigrafe: string | null
  pena: string | null
  anotacoes: unknown
  links: unknown
  revogado: boolean
  posicao: number
  path: string | null
  created_at: Date
  updated_at: Date
  // window function
  total_count?: string
}

export interface LeiStatsRow {
  totalDispositivos: number
  totalArtigos: number
  totalRevogados: number
}

// Busca result row (join of dispositivos + leis)
export interface BuscaRow extends DispositivoRow {
  lei_id: string
  lei_titulo: string
  lei_ementa: string | null
  lei_tipo: string
  lei_nivel: string
  lei_data: Date | null
  lei_status: string
  lei_hierarquia: unknown
  lei_apelido: string | null
  highlight: string
  score: number
  total: string
}

// GraphQL resolver args
export interface LeisArgs {
  nivel?: string
  tipo?: string
  status?: string
  offset?: number
  limit?: number
}

export interface LeiArgs {
  id: string
}

export interface DispositivosArgs {
  leiId: string
  path?: string
  tipos?: string[]
  incluirRevogados?: boolean
  offset?: number
  limit?: number
}

export interface BuscaArgs {
  termo: string
  nivel?: string
  tipo?: string
  leiId?: string
  limit?: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: TypeScript types for DB rows and resolver args"
```

---

## Task 4: GraphQL Schema

**Files:**
- Create: `src/schema.ts`

- [ ] **Step 1: Create src/schema.ts**

Copy the SDL from the spec (`docs/superpowers/specs/2026-03-22-api-leis-graphql-design.md`, GraphQL Schema section). The schema string must include the `JSON` scalar declaration for Mercurius:

```typescript
export const schema = `
  scalar JSON

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
    apelido: String
    ementa: String
    tipo: String!
    nivel: String!
    data: String
    status: String!
    hierarquia: JSON!
    stats: LeiStats
  }

  type LeiStats {
    totalDispositivos: Int!
    totalArtigos: Int!
    totalRevogados: Int!
  }

  type Dispositivo {
    id: ID!
    tipo: String!
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
    PENA EPIGRAFE SUBTITULO CAPUT
    PARTE LIVRO TITULO CAPITULO SECAO SUBSECAO
    EMENTA PREAMBULO
  }

  enum Nivel { FEDERAL ESTADUAL MUNICIPAL }
  enum Status { ATIVO REVOGADO }
`
```

Notes:
- Added `apelido` field to `Lei` (exists in DB, useful for frontend)
- `stats` is nullable (field-level resolver, may not be requested)
- `tipo` on `Dispositivo` is `String!` not enum — DB has UPPERCASE values matching the enum, but some items may have `NAO_IDENTIFICADO` which is not in the enum. Using `String!` avoids GraphQL validation errors for edge cases
- Added `CAPUT` to enum (exists in DB data)
- `JSON` scalar declared for Mercurius compatibility

- [ ] **Step 2: Commit**

```bash
git add src/schema.ts
git commit -m "feat: GraphQL SDL schema"
```

---

## Task 5: Lei Resolvers

**Files:**
- Create: `src/resolvers/lei.ts`
- Create: `tests/resolvers/lei.test.ts`

- [ ] **Step 1: Create tests/resolvers/lei.test.ts**

Integration tests that hit the real DB (CC + CP are already uploaded):

```typescript
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import mercurius from 'mercurius'
import { schema } from '../../src/schema.js'
import { leiResolvers } from '../../src/resolvers/lei.js'

let app: FastifyInstance

before(async () => {
  app = Fastify()
  app.register(mercurius, {
    schema,
    resolvers: { Query: leiResolvers.Query, Lei: leiResolvers.Lei },
  })
  await app.ready()
})

after(async () => {
  await app.close()
})

describe('leis query', () => {
  it('returns a list of laws with totalCount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ leis { nodes { id titulo tipo nivel } totalCount } }',
      },
    })
    const body = JSON.parse(res.payload)
    assert.ok(body.data.leis.totalCount >= 2, 'should have at least CC + CP')
    assert.ok(body.data.leis.nodes.length >= 2)
    assert.ok(body.data.leis.nodes[0].id)
    assert.ok(body.data.leis.nodes[0].titulo)
  })

  it('filters by nivel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ leis(nivel: FEDERAL) { nodes { id nivel } totalCount } }',
      },
    })
    const body = JSON.parse(res.payload)
    for (const lei of body.data.leis.nodes) {
      assert.equal(lei.nivel, 'FEDERAL')
    }
  })

  it('respects limit and offset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ leis(limit: 1, offset: 0) { nodes { id } totalCount } }',
      },
    })
    const body = JSON.parse(res.payload)
    assert.equal(body.data.leis.nodes.length, 1)
    assert.ok(body.data.leis.totalCount >= 2)
  })
})

describe('lei query', () => {
  it('returns a single law by id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ lei(id: "decreto-lei-2848-1940") { id titulo tipo nivel ementa hierarquia } }',
      },
    })
    const body = JSON.parse(res.payload)
    assert.equal(body.data.lei.id, 'decreto-lei-2848-1940')
    assert.ok(body.data.lei.titulo.includes('2.848'))
    assert.ok(body.data.lei.hierarquia)
  })

  it('returns null for non-existent id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ lei(id: "nao-existe-123") { id } }',
      },
    })
    const body = JSON.parse(res.payload)
    assert.equal(body.data.lei, null)
  })

  it('resolves stats as field-level resolver', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ lei(id: "decreto-lei-2848-1940") { id stats { totalDispositivos totalArtigos totalRevogados } } }',
      },
    })
    const body = JSON.parse(res.payload)
    assert.ok(body.data.lei.stats.totalDispositivos > 0)
    assert.ok(body.data.lei.stats.totalArtigos > 0)
    assert.ok(body.data.lei.stats.totalRevogados >= 0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/d/meta novo/api-leis"
npm test
```

Expected: FAIL — `src/resolvers/lei.js` does not exist yet.

- [ ] **Step 3: Implement src/resolvers/lei.ts**

```typescript
import { pool } from '../db.js'
import type { LeisArgs, LeiArgs, LeiRow, LeiStatsRow } from '../types.js'

const MAX_LIMIT = 200

export const leiResolvers = {
  Query: {
    async leis(_: unknown, args: LeisArgs) {
      const limit = Math.min(args.limit ?? 50, MAX_LIMIT)
      const offset = args.offset ?? 0

      const { rows } = await pool.query<LeiRow & { total_count: string }>(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM leis
         WHERE ($1::text IS NULL OR nivel = $1)
           AND ($2::text IS NULL OR tipo = $2)
           AND ($3::text IS NULL OR status = $3)
         ORDER BY titulo
         LIMIT $4 OFFSET $5`,
        [args.nivel ?? null, args.tipo ?? null, args.status ?? null, limit, offset]
      )

      const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0

      return {
        nodes: rows.map(mapLei),
        totalCount,
      }
    },

    async lei(_: unknown, args: LeiArgs) {
      const { rows } = await pool.query<LeiRow>(
        'SELECT * FROM leis WHERE id = $1',
        [args.id]
      )
      return rows.length > 0 ? mapLei(rows[0]) : null
    },
  },

  // Lei.stats uses a Mercurius Loader to batch N+1 queries.
  // See leiLoaders below — registered in index.ts via mercurius loaders option.
}

function mapLei(row: LeiRow) {
  return {
    id: row.id,
    titulo: row.titulo,
    apelido: row.apelido,
    ementa: row.ementa,
    tipo: row.tipo,
    nivel: row.nivel,
    data: row.data ? row.data.toISOString().split('T')[0] : null,
    status: row.status,
    hierarquia: row.hierarquia,
  }
}

// Mercurius Loader for Lei.stats — batches all stats requests into one query
export const leiLoaders = {
  Lei: {
    stats: async (
      queries: Array<{ obj: { id: string } }>,
    ) => {
      const ids = queries.map(q => q.obj.id)
      const { rows } = await pool.query<LeiStatsRow & { lei_id: string }>(
        `SELECT
           lei_id,
           count(*)::int AS "totalDispositivos",
           count(*) FILTER (WHERE tipo = 'ARTIGO')::int AS "totalArtigos",
           count(*) FILTER (WHERE revogado = true)::int AS "totalRevogados"
         FROM dispositivos
         WHERE lei_id = ANY($1)
         GROUP BY lei_id`,
        [ids]
      )
      const statsMap = new Map(rows.map(r => [r.lei_id, r]))
      return ids.map(id => statsMap.get(id) ?? {
        totalDispositivos: 0, totalArtigos: 0, totalRevogados: 0,
      })
    },
  },
}
```

Notes:
- `tipo = 'ARTIGO'` (uppercase) — process.js saves all tipos in UPPERCASE
- `::int` cast on count to avoid string return
- `mapLei` converts Date to ISO string for GraphQL
- `MAX_LIMIT` capped at 200
- `leiLoaders` uses Mercurius Loader pattern to batch Lei.stats — if client requests `leis(limit:50) { nodes { stats } }`, all 50 stats are resolved in a single `GROUP BY` query instead of 50 individual queries

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All lei tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resolvers/lei.ts tests/
git commit -m "feat: lei and leis query resolvers with tests"
```

---

## Task 6: Dispositivo Resolver

**Files:**
- Create: `src/resolvers/dispositivo.ts`
- Create: `tests/resolvers/dispositivo.test.ts`

- [ ] **Step 1: Create tests/resolvers/dispositivo.test.ts**

```typescript
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import mercurius from 'mercurius'
import { schema } from '../../src/schema.js'
import { dispositivoResolvers } from '../../src/resolvers/dispositivo.js'

let app: FastifyInstance

before(async () => {
  app = Fastify()
  app.register(mercurius, {
    schema,
    resolvers: { Query: dispositivoResolvers.Query },
  })
  await app.ready()
})

after(async () => {
  await app.close()
})

describe('dispositivos query', () => {
  it('returns dispositivos for Codigo Penal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ dispositivos(leiId: "decreto-lei-2848-1940", limit: 5) {
          nodes { id tipo texto posicao } totalCount
        } }`,
      },
    })
    const body = JSON.parse(res.payload)
    assert.ok(body.data.dispositivos.totalCount > 100, 'CP has thousands of dispositivos')
    assert.equal(body.data.dispositivos.nodes.length, 5)
    // Should be ordered by posicao
    const posicoes = body.data.dispositivos.nodes.map((n: { posicao: number }) => n.posicao)
    assert.deepEqual(posicoes, [...posicoes].sort((a: number, b: number) => a - b))
  })

  it('filters by tipos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ dispositivos(leiId: "decreto-lei-2848-1940", tipos: [ARTIGO], limit: 3) {
          nodes { id tipo }
        } }`,
      },
    })
    const body = JSON.parse(res.payload)
    for (const node of body.data.dispositivos.nodes) {
      assert.equal(node.tipo, 'ARTIGO')
    }
  })

  it('excludes revogados by default', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ dispositivos(leiId: "decreto-lei-2848-1940") {
          nodes { revogado } totalCount
        } }`,
      },
    })
    const body = JSON.parse(res.payload)
    for (const node of body.data.dispositivos.nodes) {
      assert.equal(node.revogado, false)
    }
  })

  it('filters by path prefix', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ dispositivos(leiId: "decreto-lei-2848-1940", path: "parte-geral", limit: 5) {
          nodes { path }
        } }`,
      },
    })
    const body = JSON.parse(res.payload)
    for (const node of body.data.dispositivos.nodes) {
      assert.ok(
        node.path === null || node.path.startsWith('parte-geral'),
        `path should start with parte-geral, got: ${node.path}`
      )
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `src/resolvers/dispositivo.js` does not exist.

- [ ] **Step 3: Implement src/resolvers/dispositivo.ts**

```typescript
import { pool } from '../db.js'
import type { DispositivosArgs, DispositivoRow } from '../types.js'

const MAX_LIMIT = 200

export const dispositivoResolvers = {
  Query: {
    async dispositivos(_: unknown, args: DispositivosArgs) {
      const limit = Math.min(args.limit ?? 100, MAX_LIMIT)
      const offset = args.offset ?? 0
      const incluirRevogados = args.incluirRevogados ?? false

      const { rows } = await pool.query<DispositivoRow & { total_count: string }>(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM dispositivos
         WHERE lei_id = $1
           AND ($2::text IS NULL OR path LIKE $2 || '%')
           AND ($3::text[] IS NULL OR tipo = ANY($3))
           AND ($4::boolean IS TRUE OR revogado = false)
         ORDER BY posicao ASC
         LIMIT $5 OFFSET $6`,
        [args.leiId, args.path ?? null, args.tipos ?? null, incluirRevogados, limit, offset]
      )

      const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0

      return {
        nodes: rows.map(mapDispositivo),
        totalCount,
      }
    },
  },
}

export function mapDispositivo(row: DispositivoRow) {
  return {
    id: row.id,
    tipo: row.tipo,
    numero: row.numero,
    texto: row.texto,
    epigrafe: row.epigrafe,
    pena: row.pena,
    anotacoes: row.anotacoes,
    links: row.links,
    revogado: row.revogado,
    path: row.path,
    posicao: row.posicao,
  }
}
```

Key: `args.tipos` comes as uppercase from GraphQL enum, converted to lowercase for DB comparison.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All dispositivo tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resolvers/dispositivo.ts tests/resolvers/dispositivo.test.ts
git commit -m "feat: dispositivos query resolver with tests"
```

---

## Task 7: Busca Resolver

**Files:**
- Create: `src/resolvers/busca.ts`
- Create: `tests/resolvers/busca.test.ts`

- [ ] **Step 1: Create tests/resolvers/busca.test.ts**

```typescript
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import mercurius from 'mercurius'
import { schema } from '../../src/schema.js'
import { buscaResolvers } from '../../src/resolvers/busca.js'
import { leiResolvers } from '../../src/resolvers/lei.js'

let app: FastifyInstance

before(async () => {
  app = Fastify()
  app.register(mercurius, {
    schema,
    resolvers: {
      Query: { ...leiResolvers.Query, ...buscaResolvers.Query },
      Lei: leiResolvers.Lei,
    },
  })
  await app.ready()
})

after(async () => {
  await app.close()
})

describe('busca query', () => {
  it('finds "homicidio" in Codigo Penal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ busca(termo: "homicidio") {
          total
          hits { dispositivo { id texto } lei { id titulo } highlight score }
        } }`,
      },
    })
    const body = JSON.parse(res.payload)
    assert.ok(body.data.busca.total > 0, 'should find homicidio')
    assert.ok(body.data.busca.hits[0].highlight.includes('<mark>'))
    assert.ok(body.data.busca.hits[0].score > 0)
  })

  it('accent-insensitive search works', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ busca(termo: "homicidio") { total } }`,
      },
    })
    const withoutAccent = JSON.parse(res.payload)

    const res2 = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ busca(termo: "homicídio") { total } }`,
      },
    })
    const withAccent = JSON.parse(res2.payload)

    assert.equal(withoutAccent.data.busca.total, withAccent.data.busca.total,
      'search with and without accent should return same count')
  })

  it('filters by leiId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ busca(termo: "artigo", leiId: "decreto-lei-2848-1940") {
          hits { lei { id } }
        } }`,
      },
    })
    const body = JSON.parse(res.payload)
    for (const hit of body.data.busca.hits) {
      assert.equal(hit.lei.id, 'decreto-lei-2848-1940')
    }
  })

  it('returns empty for nonsense term', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ busca(termo: "xyzqwerty12345") { total hits { dispositivo { id } } } }`,
      },
    })
    const body = JSON.parse(res.payload)
    assert.equal(body.data.busca.total, 0)
    assert.equal(body.data.busca.hits.length, 0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `src/resolvers/busca.js` does not exist.

- [ ] **Step 3: Implement src/resolvers/busca.ts**

```typescript
import { pool } from '../db.js'
import type { BuscaArgs, BuscaRow } from '../types.js'
import { mapDispositivo } from './dispositivo.js'

const MAX_LIMIT = 200

export const buscaResolvers = {
  Query: {
    async busca(_: unknown, args: BuscaArgs) {
      const limit = Math.min(args.limit ?? 20, MAX_LIMIT)

      const { rows } = await pool.query<BuscaRow>(
        `WITH query AS (
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
           l.id AS lei_id, l.titulo AS lei_titulo, l.ementa AS lei_ementa,
           l.tipo AS lei_tipo, l.nivel AS lei_nivel,
           l.data AS lei_data, l.status AS lei_status,
           l.hierarquia AS lei_hierarquia, l.apelido AS lei_apelido,
           ts_headline('pt_unaccent', r.texto, query.q,
             'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
           ) AS highlight
         FROM ranked r
         JOIN leis l ON r.lei_id = l.id
         CROSS JOIN query
         ORDER BY r.score DESC`,
        [args.termo, args.nivel ?? null, args.tipo ?? null, args.leiId ?? null, limit]
      )

      const total = rows.length > 0 ? parseInt(rows[0].total, 10) : 0

      return {
        total,
        hits: rows.map(row => ({
          dispositivo: mapDispositivo(row),
          lei: {
            id: row.lei_id,
            titulo: row.lei_titulo,
            apelido: row.lei_apelido,
            ementa: row.lei_ementa,
            tipo: row.lei_tipo,
            nivel: row.lei_nivel,
            data: row.lei_data ? (row.lei_data as Date).toISOString().split('T')[0] : null,
            status: row.lei_status,
            hierarquia: row.lei_hierarquia,
          },
          highlight: row.highlight,
          score: row.score,
        })),
      }
    },
  },
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All busca tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resolvers/busca.ts tests/resolvers/busca.test.ts
git commit -m "feat: busca resolver with pt_unaccent tsvector search"
```

---

## Task 8: Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import mercurius from 'mercurius'
import { schema } from './schema.js'
import { leiResolvers, leiLoaders } from './resolvers/lei.js'
import { dispositivoResolvers } from './resolvers/dispositivo.js'
import { buscaResolvers } from './resolvers/busca.js'
import { pool } from './db.js'

const app = Fastify({ logger: true })

// CORS
await app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') ?? [
    'https://metav2.vercel.app',
    'http://localhost:3000',
  ],
})

// GraphQL
await app.register(mercurius, {
  schema,
  resolvers: {
    Query: {
      ...leiResolvers.Query,
      ...dispositivoResolvers.Query,
      ...buscaResolvers.Query,
    },
  },
  loaders: leiLoaders,
  graphiql: process.env.NODE_ENV !== 'production',
})

// Health check
app.get('/health', async () => {
  // Verify DB is reachable
  await pool.query('SELECT 1')
  return { status: 'ok' }
})

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...')
  await app.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Start
const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
app.log.info(`GraphQL API listening on http://localhost:${port}/graphiql`)
```

- [ ] **Step 2: Test dev server manually**

```bash
cd "/d/meta novo/api-leis"
# Create .env with real DATABASE_URL
cp .env.example .env
# Edit .env with real password
npm run dev
```

Open `http://localhost:3001/graphiql` in browser. Run:
```graphql
{
  leis { nodes { id titulo } totalCount }
}
```

Expected: Returns CC + CP.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: Fastify server entry point with CORS, GraphiQL, graceful shutdown"
```

---

## Task 9: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create Dockerfile**

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

- [ ] **Step 2: Test Docker build locally**

```bash
cd "/d/meta novo/api-leis"
docker build -t api-leis .
docker run --rm -p 3001:3001 --env-file .env api-leis
```

Open `http://localhost:3001/health` — expected: `{"status":"ok"}`

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: multi-stage Dockerfile with healthcheck"
```

---

## Task 10: Run Full Test Suite and Final Verification

- [ ] **Step 1: Run all tests**

```bash
cd "/d/meta novo/api-leis"
npm test
```

Expected: All tests PASS (lei, dispositivo, busca).

- [ ] **Step 2: Run dev server and test all 4 queries manually in GraphiQL**

```bash
npm run dev
```

Test each query in GraphiQL at `http://localhost:3001/graphiql`:

```graphql
# 1. List leis
{ leis(limit: 2) { nodes { id titulo tipo } totalCount } }

# 2. Single lei with stats
{ lei(id: "lei-10406-2002") { id titulo stats { totalDispositivos totalArtigos } hierarquia } }

# 3. Dispositivos with filters
{ dispositivos(leiId: "decreto-lei-2848-1940", tipos: [ARTIGO], limit: 3) { nodes { id tipo texto posicao } totalCount } }

# 4. Busca
{ busca(termo: "homicidio") { total hits { dispositivo { texto } lei { titulo } highlight score } } }
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build
```

Expected: `dist/` folder created with `.js` files, no TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: ready for deployment"
```

---

## Task 11: Deploy to Coolify

This task is manual — configure via Coolify dashboard on Hetzner.

- [ ] **Step 1: Push repo to GitHub**

```bash
cd "/d/meta novo/api-leis"
# Create repo on GitHub first, then:
git remote add origin <github-url>
git push -u origin main
```

- [ ] **Step 2: Configure Coolify**

1. Open Coolify dashboard on Hetzner
2. In the existing project, add new Service → "Docker" type
3. Connect to the GitHub repo
4. Set build method: Dockerfile
5. Set port: 3001
6. Add env vars:
   - `DATABASE_URL=postgresql://leis:<password>@95.217.197.95:5434/leis` (NOT localhost — container's localhost is its own network, not the host. Use host IP or Docker bridge `172.17.0.1` if firewall blocks external IP from containers)
   - `PORT=3001`
   - `CORS_ORIGINS=https://metav2.vercel.app,http://localhost:3000`
   - `NODE_ENV=production`
7. Deploy

- [ ] **Step 3: Test deployed API**

```bash
curl -X POST http://95.217.197.95:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ leis { totalCount } }"}'
```

Expected: `{"data":{"leis":{"totalCount":2}}}`

- [ ] **Step 4: Test from frontend (localhost:3000)**

Open browser console on localhost:3000:
```javascript
fetch('http://95.217.197.95:3001/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ leis { nodes { id titulo } totalCount } }' })
}).then(r => r.json()).then(console.log)
```

Expected: Returns CC + CP, no CORS errors.
