# Editais Moderacao Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GraphQL mutations to the api-editais backend for admin CRUD on editais, cargos, disciplinas, and topicos, with role-based auth and audit logging.

**Architecture:** Extend the existing Fastify/Mercurius GraphQL API with mutation resolvers. Add admin role verification via Supabase REST API (cached 5min). Create local `admin_log` table for audit trail. All mutations protected by admin-only auth.

**Tech Stack:** Fastify 5, Mercurius 15, PostgreSQL (pg), Node.js 22, TypeScript

**Working directory:** `D:\meta novo\api-editais`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/migrate-admin-log.sql` | SQL migration for admin_log table |
| Create | `src/admin-auth.ts` | Admin role verification via Supabase REST API |
| Create | `src/admin-log.ts` | Audit logging helper |
| Create | `src/resolvers/mutations.ts` | All mutation resolvers |
| Modify | `src/schema.ts` | Add mutation types, inputs, admin log query |
| Modify | `src/types.ts` | Add mutation-related TypeScript types |
| Modify | `src/index.ts` | Register mutation resolvers |
| Modify | `src/auth.ts` | Expose JWT payload on request for downstream use |

---

### Task 1: Create admin_log table

**Files:**
- Create: `scripts/migrate-admin-log.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- scripts/migrate-admin-log.sql
-- Audit log for admin actions on editais data

CREATE TABLE IF NOT EXISTS admin_log (
  id SERIAL PRIMARY KEY,
  actor_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL,
  details JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_target ON admin_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_log_actor ON admin_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_log_criado ON admin_log(criado_em DESC);
```

- [ ] **Step 2: Run the migration against the database**

```bash
psql "postgresql://editais:vda4FRtsSLXfjJIWRBRuqh1pClhF6tn8HZxopbVvM7tUogAQuvdxPGzbIHENWYEk@95.217.197.95:5435/editais" -f scripts/migrate-admin-log.sql
```

Expected output: `CREATE TABLE` and `CREATE INDEX` x3.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-admin-log.sql
git commit -m "feat(admin): add admin_log table migration"
```

---

### Task 2: Expose JWT payload on request + admin auth

**Files:**
- Modify: `src/auth.ts`
- Create: `src/admin-auth.ts`

- [ ] **Step 1: Modify auth.ts to store JWT payload on request**

Add the decoded payload to `request.jwtPayload` so downstream resolvers can access the user ID. In `src/auth.ts`, after the `validateJwt` call succeeds, attach the payload:

Replace the try/catch block at the end of `authHook` (lines 66-71):

```typescript
  try {
    const payload = validateJwt(token, secret)
    // Attach payload for downstream use (resolvers, admin-auth)
    ;(request as any).jwtPayload = payload
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token'
    return reply.status(401).send({ error: message })
  }
```

Also export `validateJwt` so it can be reused:

Change `function validateJwt` to `export function validateJwt`.

- [ ] **Step 2: Create src/admin-auth.ts**

This module checks if the authenticated user has the 'admin' role by querying the Supabase `user_roles` table via REST API. Caches results for 5 minutes.

```typescript
// src/admin-auth.ts

interface RoleCache {
  role: string
  expiresAt: number
}

const cache = new Map<string, RoleCache>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function requireAdmin(request: any): Promise<string> {
  const payload = request.jwtPayload
  if (!payload?.sub) {
    throw new Error('Not authenticated')
  }

  const userId: string = payload.sub

  // Check cache
  const cached = cache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.role !== 'admin') {
      throw new Error('Admin access required')
    }
    return userId
  }

  // Query Supabase for role
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase config missing for role check')
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}&select=role`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  )

  if (!res.ok) {
    throw new Error('Failed to verify admin role')
  }

  const rows = await res.json() as { role: string }[]
  const role = rows[0]?.role ?? 'user'

  // Cache result
  cache.set(userId, { role, expiresAt: Date.now() + CACHE_TTL })

  if (role !== 'admin') {
    throw new Error('Admin access required')
  }

  return userId
}
```

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts src/admin-auth.ts
git commit -m "feat(admin): add admin role verification via Supabase REST API"
```

---

### Task 3: Audit logging helper

**Files:**
- Create: `src/admin-log.ts`

- [ ] **Step 1: Create the logging helper**

```typescript
// src/admin-log.ts
import { pool } from './db.js'

interface LogEntry {
  actorId: string
  targetType: 'edital' | 'cargo' | 'disciplina' | 'topico'
  targetId: number
  action: string
  details?: Record<string, unknown>
}

export async function logAdminAction(entry: LogEntry): Promise<void> {
  await pool.query(
    `INSERT INTO admin_log (actor_id, target_type, target_id, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.actorId, entry.targetType, entry.targetId, entry.action, JSON.stringify(entry.details ?? {})]
  )
}

export async function getAdminLog(targetType: string, targetId: number) {
  const { rows } = await pool.query(
    `SELECT id, actor_id, target_type, target_id, action, details, criado_em
     FROM admin_log
     WHERE target_type = $1 AND target_id = $2
     ORDER BY criado_em DESC
     LIMIT 50`,
    [targetType, targetId]
  )
  return rows.map(r => ({
    id: r.id,
    actorId: r.actor_id,
    targetType: r.target_type,
    targetId: r.target_id,
    action: r.action,
    details: JSON.stringify(r.details),
    criadoEm: r.criado_em.toISOString(),
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin-log.ts
git commit -m "feat(admin): add audit log helper (insert + query)"
```

---

### Task 4: Add mutation types to GraphQL schema

**Files:**
- Modify: `src/schema.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add TypeScript types for mutations in src/types.ts**

Append to the end of the file:

```typescript
// Admin mutation types
export interface EditalInput {
  nome?: string
  sigla?: string
  esfera?: string
  tipo?: string
  descricao?: string
  dataPublicacao?: string
  dataEncerramento?: string
  dataInicioInscricao?: string
  dataFimInscricao?: string
  link?: string
  cidade?: string
  previsto?: boolean
  cancelado?: boolean
  autorizado?: boolean
  ativo?: boolean
  destaque?: boolean
}

export interface CargoInput {
  nome?: string
  vagas?: number
  remuneracao?: number
  dataProva?: string
  ativo?: boolean
}

export interface DisciplinaInput {
  nome?: string
  nomeEdital?: string
  ativo?: boolean
}

export interface TopicoInput {
  nome?: string
  ordem?: number
  ativo?: boolean
}

export interface MutationResult {
  success: boolean
  message: string | null
  id: number | null
}

export interface BulkResult {
  success: boolean
  affected: number
}

// Mutation arg types
export interface CriarEditalArgs { input: EditalInput }
export interface AtualizarEditalArgs { id: number; input: EditalInput }
export interface DeletarArgs { id: number }
export interface CriarCargoArgs { editalId: number; input: CargoInput }
export interface AtualizarCargoArgs { id: number; input: CargoInput }
export interface CriarDisciplinaArgs { cargoId: number; input: DisciplinaInput }
export interface AtualizarDisciplinaArgs { id: number; input: DisciplinaInput }
export interface CriarTopicoArgs { disciplinaId: number; input: TopicoInput }
export interface AtualizarTopicoArgs { id: number; input: TopicoInput }
export interface ReordenarTopicosArgs { disciplinaId: number; topicoIds: number[] }
export interface BulkAtivarArgs { tipo: string; ids: number[]; ativo: boolean }
export interface BulkDeletarArgs { tipo: string; ids: number[] }
export interface AdminLogArgs { targetType: string; targetId: number }
```

- [ ] **Step 2: Add mutation schema to src/schema.ts**

Append the following to the schema string, before the closing backtick:

```graphql
  input EditalInput {
    nome: String
    sigla: String
    esfera: String
    tipo: String
    descricao: String
    dataPublicacao: String
    dataEncerramento: String
    dataInicioInscricao: String
    dataFimInscricao: String
    link: String
    cidade: String
    previsto: Boolean
    cancelado: Boolean
    autorizado: Boolean
    ativo: Boolean
    destaque: Boolean
  }

  input CargoInput {
    nome: String
    vagas: Int
    remuneracao: Int
    dataProva: String
    ativo: Boolean
  }

  input DisciplinaInput {
    nome: String
    nomeEdital: String
    ativo: Boolean
  }

  input TopicoInput {
    nome: String
    ordem: Int
    ativo: Boolean
  }

  type MutationResult {
    success: Boolean!
    message: String
    id: Int
  }

  type BulkResult {
    success: Boolean!
    affected: Int!
  }

  type AdminLogEntry {
    id: Int!
    actorId: String!
    targetType: String!
    targetId: Int!
    action: String!
    details: String
    criadoEm: String!
  }

  extend type Query {
    adminLog(targetType: String!, targetId: Int!): [AdminLogEntry!]!
  }

  type Mutation {
    criarEdital(input: EditalInput!): MutationResult!
    atualizarEdital(id: Int!, input: EditalInput!): MutationResult!
    deletarEdital(id: Int!): MutationResult!

    criarCargo(editalId: Int!, input: CargoInput!): MutationResult!
    atualizarCargo(id: Int!, input: CargoInput!): MutationResult!
    deletarCargo(id: Int!): MutationResult!

    criarDisciplina(cargoId: Int!, input: DisciplinaInput!): MutationResult!
    atualizarDisciplina(id: Int!, input: DisciplinaInput!): MutationResult!
    deletarDisciplina(id: Int!): MutationResult!

    criarTopico(disciplinaId: Int!, input: TopicoInput!): MutationResult!
    atualizarTopico(id: Int!, input: TopicoInput!): MutationResult!
    deletarTopico(id: Int!): MutationResult!
    reordenarTopicos(disciplinaId: Int!, topicoIds: [Int!]!): MutationResult!

    bulkAtivar(tipo: String!, ids: [Int!]!, ativo: Boolean!): BulkResult!
    bulkDeletar(tipo: String!, ids: [Int!]!): BulkResult!
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/schema.ts src/types.ts
git commit -m "feat(admin): add mutation types and GraphQL schema"
```

---

### Task 5: Implement mutation resolvers

**Files:**
- Create: `src/resolvers/mutations.ts`

- [ ] **Step 1: Create the mutations resolver file**

This is the largest file. It contains all CRUD mutations for the 4 entity types, plus bulk operations and reordering. Every mutation calls `requireAdmin()` first, validates input, executes the SQL, and logs the action.

```typescript
// src/resolvers/mutations.ts
import { pool } from '../db.js'
import { requireAdmin } from '../admin-auth.js'
import { logAdminAction, getAdminLog } from '../admin-log.js'
import type {
  MutationResult, BulkResult,
  CriarEditalArgs, AtualizarEditalArgs, DeletarArgs,
  CriarCargoArgs, AtualizarCargoArgs,
  CriarDisciplinaArgs, AtualizarDisciplinaArgs,
  CriarTopicoArgs, AtualizarTopicoArgs,
  ReordenarTopicosArgs, BulkAtivarArgs, BulkDeletarArgs,
  AdminLogArgs,
} from '../types.js'

const VALID_TIPOS = ['edital', 'cargo', 'disciplina', 'topico'] as const
const TABLE_MAP: Record<string, string> = {
  edital: 'editais',
  cargo: 'cargos',
  disciplina: 'disciplinas',
  topico: 'topicos',
}

function ok(id?: number, message?: string): MutationResult {
  return { success: true, message: message ?? null, id: id ?? null }
}

function fail(message: string): MutationResult {
  return { success: false, message, id: null }
}

// --- Duplicate check helper ---
async function checkDuplicate(
  table: string,
  nameField: string,
  name: string,
  parentField: string,
  parentId: number,
  excludeId?: number,
): Promise<string | null> {
  const excludeClause = excludeId ? ` AND id != $3` : ''
  const params = excludeId ? [name, parentId, excludeId] : [name, parentId]
  const { rows } = await pool.query(
    `SELECT id FROM ${table} WHERE LOWER(${nameField}) = LOWER($1) AND ${parentField} = $2${excludeClause} LIMIT 1`,
    params,
  )
  return rows.length > 0 ? `Ja existe um item com o nome "${name}" neste nivel` : null
}

// ========================
// EDITAL MUTATIONS
// ========================

async function criarEdital(_: unknown, args: CriarEditalArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { input } = args

  if (!input.nome) return fail('Nome e obrigatorio')

  // Check duplicate by nome
  const { rows: dupes } = await pool.query(
    `SELECT id FROM editais WHERE LOWER(nome) = LOWER($1) LIMIT 1`,
    [input.nome],
  )
  if (dupes.length > 0) return fail(`Ja existe um edital com o nome "${input.nome}"`)

  const { rows } = await pool.query(
    `INSERT INTO editais (nome, sigla, esfera, tipo, descricao, data_publicacao, data_encerramento,
       data_inicio_inscricao, data_fim_inscricao, link, cidade, previsto, cancelado, autorizado, ativo, destaque)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      input.nome, input.sigla ?? null, input.esfera ?? null, input.tipo ?? null,
      input.descricao ?? null, input.dataPublicacao ?? null, input.dataEncerramento ?? null,
      input.dataInicioInscricao ?? null, input.dataFimInscricao ?? null, input.link ?? null,
      input.cidade ?? null, input.previsto ?? false, input.cancelado ?? false,
      input.autorizado ?? false, input.ativo ?? true, input.destaque ?? false,
    ],
  )

  await logAdminAction({ actorId, targetType: 'edital', targetId: rows[0].id, action: 'create', details: input })
  return ok(rows[0].id, 'Edital criado')
}

async function atualizarEdital(_: unknown, args: AtualizarEditalArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { id, input } = args

  // Fetch current values for diff
  const { rows: current } = await pool.query(`SELECT * FROM editais WHERE id = $1`, [id])
  if (current.length === 0) return fail('Edital nao encontrado')

  // Build SET clause dynamically
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = {
    nome: 'nome', sigla: 'sigla', esfera: 'esfera', tipo: 'tipo', descricao: 'descricao',
    dataPublicacao: 'data_publicacao', dataEncerramento: 'data_encerramento',
    dataInicioInscricao: 'data_inicio_inscricao', dataFimInscricao: 'data_fim_inscricao',
    link: 'link', cidade: 'cidade', previsto: 'previsto', cancelado: 'cancelado',
    autorizado: 'autorizado', ativo: 'ativo', destaque: 'destaque',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) {
      fields.push(`${col} = $${idx}`)
      values.push((input as any)[key])
      idx++
    }
  }

  if (fields.length === 0) return fail('Nenhum campo para atualizar')

  fields.push(`atualizado_em = NOW()`)
  values.push(id)

  await pool.query(
    `UPDATE editais SET ${fields.join(', ')} WHERE id = $${idx}`,
    values,
  )

  // Build diff for log
  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined && current[0][col] !== (input as any)[key]) {
      diff[key] = { old: current[0][col], new: (input as any)[key] }
    }
  }

  await logAdminAction({ actorId, targetType: 'edital', targetId: id, action: 'update', details: diff })
  return ok(id, 'Edital atualizado')
}

async function deletarEdital(_: unknown, args: DeletarArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)

  const { rows } = await pool.query(`SELECT nome FROM editais WHERE id = $1`, [args.id])
  if (rows.length === 0) return fail('Edital nao encontrado')

  await pool.query(`DELETE FROM editais WHERE id = $1`, [args.id])
  await logAdminAction({ actorId, targetType: 'edital', targetId: args.id, action: 'delete', details: { nome: rows[0].nome } })
  return ok(args.id, 'Edital excluido permanentemente')
}

// ========================
// CARGO MUTATIONS
// ========================

async function criarCargo(_: unknown, args: CriarCargoArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { editalId, input } = args

  if (!input.nome) return fail('Nome e obrigatorio')

  const dup = await checkDuplicate('cargos', 'nome', input.nome, 'edital_id', editalId)
  if (dup) return fail(dup)

  const { rows } = await pool.query(
    `INSERT INTO cargos (edital_id, nome, vagas, remuneracao, data_prova, ativo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [editalId, input.nome, input.vagas ?? 0, input.remuneracao ?? 0, input.dataProva ?? null, input.ativo ?? true],
  )

  await logAdminAction({ actorId, targetType: 'cargo', targetId: rows[0].id, action: 'create', details: { editalId, ...input } })
  return ok(rows[0].id, 'Cargo criado')
}

async function atualizarCargo(_: unknown, args: AtualizarCargoArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { id, input } = args

  const { rows: current } = await pool.query(`SELECT * FROM cargos WHERE id = $1`, [id])
  if (current.length === 0) return fail('Cargo nao encontrado')

  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = {
    nome: 'nome', vagas: 'vagas', remuneracao: 'remuneracao', dataProva: 'data_prova', ativo: 'ativo',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) {
      fields.push(`${col} = $${idx}`)
      values.push((input as any)[key])
      idx++
    }
  }

  if (fields.length === 0) return fail('Nenhum campo para atualizar')

  fields.push(`atualizado_em = NOW()`)
  values.push(id)

  await pool.query(`UPDATE cargos SET ${fields.join(', ')} WHERE id = $${idx}`, values)

  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined && current[0][col] !== (input as any)[key]) {
      diff[key] = { old: current[0][col], new: (input as any)[key] }
    }
  }

  await logAdminAction({ actorId, targetType: 'cargo', targetId: id, action: 'update', details: diff })
  return ok(id, 'Cargo atualizado')
}

async function deletarCargo(_: unknown, args: DeletarArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)

  const { rows } = await pool.query(`SELECT nome FROM cargos WHERE id = $1`, [args.id])
  if (rows.length === 0) return fail('Cargo nao encontrado')

  await pool.query(`DELETE FROM cargos WHERE id = $1`, [args.id])
  await logAdminAction({ actorId, targetType: 'cargo', targetId: args.id, action: 'delete', details: { nome: rows[0].nome } })
  return ok(args.id, 'Cargo excluido permanentemente')
}

// ========================
// DISCIPLINA MUTATIONS
// ========================

async function criarDisciplina(_: unknown, args: CriarDisciplinaArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { cargoId, input } = args

  if (!input.nome) return fail('Nome e obrigatorio')

  const dup = await checkDuplicate('disciplinas', 'nome', input.nome, 'cargo_id', cargoId)
  if (dup) return fail(dup)

  const { rows } = await pool.query(
    `INSERT INTO disciplinas (cargo_id, nome, nome_edital) VALUES ($1,$2,$3) RETURNING id`,
    [cargoId, input.nome, input.nomeEdital ?? null],
  )

  await logAdminAction({ actorId, targetType: 'disciplina', targetId: rows[0].id, action: 'create', details: { cargoId, ...input } })
  return ok(rows[0].id, 'Disciplina criada')
}

async function atualizarDisciplina(_: unknown, args: AtualizarDisciplinaArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { id, input } = args

  const { rows: current } = await pool.query(`SELECT * FROM disciplinas WHERE id = $1`, [id])
  if (current.length === 0) return fail('Disciplina nao encontrada')

  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = { nome: 'nome', nomeEdital: 'nome_edital' }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) {
      fields.push(`${col} = $${idx}`)
      values.push((input as any)[key])
      idx++
    }
  }

  if (fields.length === 0) return fail('Nenhum campo para atualizar')

  fields.push(`atualizado_em = NOW()`)
  values.push(id)

  await pool.query(`UPDATE disciplinas SET ${fields.join(', ')} WHERE id = $${idx}`, values)

  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined && current[0][col] !== (input as any)[key]) {
      diff[key] = { old: current[0][col], new: (input as any)[key] }
    }
  }

  await logAdminAction({ actorId, targetType: 'disciplina', targetId: id, action: 'update', details: diff })
  return ok(id, 'Disciplina atualizada')
}

async function deletarDisciplina(_: unknown, args: DeletarArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)

  const { rows } = await pool.query(`SELECT nome FROM disciplinas WHERE id = $1`, [args.id])
  if (rows.length === 0) return fail('Disciplina nao encontrada')

  await pool.query(`DELETE FROM disciplinas WHERE id = $1`, [args.id])
  await logAdminAction({ actorId, targetType: 'disciplina', targetId: args.id, action: 'delete', details: { nome: rows[0].nome } })
  return ok(args.id, 'Disciplina excluida permanentemente')
}

// ========================
// TOPICO MUTATIONS
// ========================

async function criarTopico(_: unknown, args: CriarTopicoArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { disciplinaId, input } = args

  if (!input.nome) return fail('Nome e obrigatorio')

  // Get next ordem value
  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) + 1 AS next_ordem FROM topicos WHERE disciplina_id = $1`,
    [disciplinaId],
  )
  const ordem = input.ordem ?? maxRows[0].next_ordem

  const { rows } = await pool.query(
    `INSERT INTO topicos (disciplina_id, nome, ordem) VALUES ($1,$2,$3) RETURNING id`,
    [disciplinaId, input.nome, ordem],
  )

  await logAdminAction({ actorId, targetType: 'topico', targetId: rows[0].id, action: 'create', details: { disciplinaId, ...input } })
  return ok(rows[0].id, 'Topico criado')
}

async function atualizarTopico(_: unknown, args: AtualizarTopicoArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { id, input } = args

  const { rows: current } = await pool.query(`SELECT * FROM topicos WHERE id = $1`, [id])
  if (current.length === 0) return fail('Topico nao encontrado')

  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = { nome: 'nome', ordem: 'ordem' }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) {
      fields.push(`${col} = $${idx}`)
      values.push((input as any)[key])
      idx++
    }
  }

  if (fields.length === 0) return fail('Nenhum campo para atualizar')

  fields.push(`atualizado_em = NOW()`)
  values.push(id)

  await pool.query(`UPDATE topicos SET ${fields.join(', ')} WHERE id = $${idx}`, values)

  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined && current[0][col] !== (input as any)[key]) {
      diff[key] = { old: current[0][col], new: (input as any)[key] }
    }
  }

  await logAdminAction({ actorId, targetType: 'topico', targetId: id, action: 'update', details: diff })
  return ok(id, 'Topico atualizado')
}

async function deletarTopico(_: unknown, args: DeletarArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)

  const { rows } = await pool.query(`SELECT nome FROM topicos WHERE id = $1`, [args.id])
  if (rows.length === 0) return fail('Topico nao encontrado')

  await pool.query(`DELETE FROM topicos WHERE id = $1`, [args.id])
  await logAdminAction({ actorId, targetType: 'topico', targetId: args.id, action: 'delete', details: { nome: rows[0].nome } })
  return ok(args.id, 'Topico excluido permanentemente')
}

// ========================
// REORDER TOPICOS
// ========================

async function reordenarTopicos(_: unknown, args: ReordenarTopicosArgs, context: any): Promise<MutationResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { disciplinaId, topicoIds } = args

  // Verify all topicos belong to the disciplina
  const { rows } = await pool.query(
    `SELECT id FROM topicos WHERE disciplina_id = $1 AND id = ANY($2)`,
    [disciplinaId, topicoIds],
  )
  if (rows.length !== topicoIds.length) {
    return fail('Alguns topicos nao pertencem a esta disciplina')
  }

  // Update ordem for each topico
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < topicoIds.length; i++) {
      await client.query(`UPDATE topicos SET ordem = $1, atualizado_em = NOW() WHERE id = $2`, [i + 1, topicoIds[i]])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  await logAdminAction({ actorId, targetType: 'topico', targetId: disciplinaId, action: 'reorder', details: { topicoIds } })
  return ok(null, 'Topicos reordenados')
}

// ========================
// BULK OPERATIONS
// ========================

async function bulkAtivar(_: unknown, args: BulkAtivarArgs, context: any): Promise<BulkResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { tipo, ids, ativo } = args

  if (!VALID_TIPOS.includes(tipo as any)) {
    return { success: false, affected: 0 }
  }
  if (ids.length === 0 || ids.length > 100) {
    return { success: false, affected: 0 }
  }

  const table = TABLE_MAP[tipo]
  const { rowCount } = await pool.query(
    `UPDATE ${table} SET ativo = $1, atualizado_em = NOW() WHERE id = ANY($2)`,
    [ativo, ids],
  )

  const action = ativo ? 'bulk_activate' : 'bulk_deactivate'
  for (const id of ids) {
    await logAdminAction({ actorId, targetType: tipo as any, targetId: id, action, details: { ativo } })
  }

  return { success: true, affected: rowCount ?? 0 }
}

async function bulkDeletar(_: unknown, args: BulkDeletarArgs, context: any): Promise<BulkResult> {
  const actorId = await requireAdmin(context.reply.request)
  const { tipo, ids } = args

  if (!VALID_TIPOS.includes(tipo as any)) {
    return { success: false, affected: 0 }
  }
  if (ids.length === 0 || ids.length > 100) {
    return { success: false, affected: 0 }
  }

  const table = TABLE_MAP[tipo]

  // Fetch names for log before deleting
  const { rows: names } = await pool.query(`SELECT id, nome FROM ${table} WHERE id = ANY($1)`, [ids])
  const nameMap = new Map(names.map(r => [r.id, r.nome]))

  const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = ANY($1)`, [ids])

  for (const id of ids) {
    await logAdminAction({ actorId, targetType: tipo as any, targetId: id, action: 'bulk_delete', details: { nome: nameMap.get(id) } })
  }

  return { success: true, affected: rowCount ?? 0 }
}

// ========================
// ADMIN LOG QUERY
// ========================

async function adminLog(_: unknown, args: AdminLogArgs): Promise<unknown[]> {
  return getAdminLog(args.targetType, args.targetId)
}

// ========================
// EXPORTS
// ========================

export const mutationResolvers = {
  Query: {
    adminLog,
  },
  Mutation: {
    criarEdital,
    atualizarEdital,
    deletarEdital,
    criarCargo,
    atualizarCargo,
    deletarCargo,
    criarDisciplina,
    atualizarDisciplina,
    deletarDisciplina,
    criarTopico,
    atualizarTopico,
    deletarTopico,
    reordenarTopicos,
    bulkAtivar,
    bulkDeletar,
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/resolvers/mutations.ts
git commit -m "feat(admin): add all mutation resolvers (CRUD, bulk, reorder, audit)"
```

---

### Task 6: Register mutations in Fastify server

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import and register mutation resolvers**

Add import at the top with the other resolver imports:

```typescript
import { mutationResolvers } from './resolvers/mutations.js'
```

Add mutations to the resolvers object. Change the resolvers definition to:

```typescript
const resolvers: any = {
  Query: {
    ...editalResolvers.Query,
    ...cargoResolvers.Query,
    ...disciplinaResolvers.Query,
    ...topicoResolvers.Query,
    ...analyticsResolvers.Query,
    ...mutationResolvers.Query,
  },
  Mutation: {
    ...mutationResolvers.Mutation,
  },
  ...editalFieldResolvers,
  ...cargoFieldResolvers,
  ...disciplinaFieldResolvers,
  ...topicoFieldResolvers,
}
```

Also update the Mercurius `context` to pass the reply object (mutations need access to `request.jwtPayload`):

Change:
```typescript
  context: () => ({
    loaders: createLoaders(),
  }),
```

To:
```typescript
  context: (request: any, reply: any) => ({
    loaders: createLoaders(),
    reply,
  }),
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(admin): register mutation resolvers in Fastify server"
```

---

### Task 7: Add ativo column to disciplinas and topicos

The spec requires ativar/inativar at every level, but the current schema only has `ativo` on `editais` and `cargos`. Disciplinas and topicos need it too.

**Files:**
- Create: `scripts/migrate-ativo-columns.sql`

- [ ] **Step 1: Write migration**

```sql
-- scripts/migrate-ativo-columns.sql
-- Add ativo column to disciplinas and topicos for per-item activation

ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

-- Add atualizado_em to tables that might be missing it
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE topicos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();
```

- [ ] **Step 2: Run migration**

```bash
psql "postgresql://editais:vda4FRtsSLXfjJIWRBRuqh1pClhF6tn8HZxopbVvM7tUogAQuvdxPGzbIHENWYEk@95.217.197.95:5435/editais" -f scripts/migrate-ativo-columns.sql
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-ativo-columns.sql
git commit -m "feat(admin): add ativo column to disciplinas and topicos"
```

---

### Task 8: Add Coolify env vars and redeploy

- [ ] **Step 1: Add env vars in Coolify**

Navigate to the api-editais app in Coolify → Environment Variables → + Add:

| Name | Value | Buildtime | Runtime |
|------|-------|-----------|---------|
| `SUPABASE_URL` | `https://xmtleqquivcukwgdexhc.supabase.co` | No | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase Dashboard → Settings → API → service_role) | No | Yes |

- [ ] **Step 2: Push code to trigger Coolify deploy**

```bash
git push origin master
```

- [ ] **Step 3: Verify deploy in Coolify — wait for "Running" status**

- [ ] **Step 4: Test mutations via GraphiQL or curl**

Test creating an edital (requires admin JWT):

```bash
curl -s -X POST "http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{"query":"mutation { criarEdital(input: { nome: \"Teste Admin\", esfera: \"federal\", ativo: true }) { success message id } }"}'
```

Expected: `{ "data": { "criarEdital": { "success": true, "message": "Edital criado", "id": <number> } } }`

Then delete the test edital:

```bash
curl -s -X POST "http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{"query":"mutation { deletarEdital(id: <ID>) { success message } }"}'
```

---

## Execution Order

**1 → 2 → 3 → 4 → 5 → 6 → 7 → 8** (sequential — each builds on the previous)

Task 7 (ativo migration) can technically run in parallel with Tasks 2-6 but is safer after the resolvers are written.
