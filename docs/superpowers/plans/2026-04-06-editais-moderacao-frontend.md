# Editais Moderacao Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/moderacao/editais` section for admin CRUD management of editais, cargos, disciplinas, and topicos, using the existing moderation panel patterns.

**Architecture:** Hybrid navigation: drill-down between hierarchy levels (breadcrumb) + drawer for editing items. Reuses ModerationDataTable, ModerationDrawer, ActionBar, Timeline. One page component with state machine for levels. One generic hook for all GraphQL mutations.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons, editaisQuery (from editais-client.ts)

**Working directory:** `D:\meta novo\Metav2`

**Depends on:** Plan 1 (Backend mutations) must be deployed first.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/moderation/useEditaisAdmin.ts` | GraphQL queries + mutations for admin panel |
| Create | `src/components/moderation/editais/EditaisModerationPage.tsx` | Main page: level state machine, breadcrumb, table routing |
| Create | `src/components/moderation/editais/EditaisDrawer.tsx` | Drawer for editing/creating items at any level |
| Create | `src/components/moderation/editais/EditaisBulkBar.tsx` | Bulk actions bar (ativar/inativar/excluir selecionados) |
| Create | `src/components/moderation/editais/columns.tsx` | Column definitions for each hierarchy level |
| Modify | `src/App.tsx` | Add `/moderacao/editais` route |
| Modify | `src/components/moderation/layout/ModerationSidebar.tsx` | Add "Editais" nav item |
| Modify | `src/lib/editais-client.ts` | Ensure editaisQuery works for mutations too |

---

### Task 1: Update editais-client for mutations

**Files:**
- Modify: `src/lib/editais-client.ts`

- [ ] **Step 1: The existing editaisQuery already supports POST with variables — verify it works for mutations**

The current `editaisQuery` function in `src/lib/editais-client.ts` sends `{ query, variables }` via POST with JWT. Mutations use the same transport — no changes needed to the function itself.

However, we need to export a typed mutation helper for convenience:

Add to the end of `src/lib/editais-client.ts`:

```typescript
// Alias for clarity — mutations use the same transport
export const editaisMutation = editaisQuery
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editais-client.ts
git commit -m "feat(editais-admin): add editaisMutation alias"
```

---

### Task 2: Create useEditaisAdmin hook

**Files:**
- Create: `src/hooks/moderation/useEditaisAdmin.ts`

- [ ] **Step 1: Create the hook**

This hook provides all queries and mutations needed by the admin panel. It manages loading/error states and refetch triggers.

```typescript
// src/hooks/moderation/useEditaisAdmin.ts
import { useState, useCallback, useEffect } from 'react'
import { editaisQuery, editaisMutation } from '@/lib/editais-client'

// ---- Types ----

export interface AdminEdital {
  id: number
  nome: string
  sigla: string | null
  esfera: string | null
  tipo: string | null
  ativo: boolean
  destaque: boolean
  totalCargos: number
  totalDisciplinas: number
  totalTopicos: number
}

export interface AdminCargo {
  id: number
  nome: string
  vagas: number | null
  remuneracao: number | null
  qtdDisciplinas: number | null
  qtdTopicos: number | null
  ativo: boolean
  dataProva: string | null
}

export interface AdminDisciplina {
  id: number
  nome: string
  nomeEdital: string | null
  totalTopicos: number
  ativo: boolean
}

export interface AdminTopico {
  id: number
  nome: string
  ordem: number
  ativo: boolean
}

export interface AdminLogEntry {
  id: number
  actorId: string
  targetType: string
  targetId: number
  action: string
  details: string | null
  criadoEm: string
}

export type HierarchyLevel = 'editais' | 'cargos' | 'disciplinas' | 'topicos'

export interface BreadcrumbItem {
  id: number
  nome: string
  tipo: HierarchyLevel
}

interface MutationResult {
  success: boolean
  message: string | null
  id: number | null
}

interface BulkResult {
  success: boolean
  affected: number
}

// ---- Queries ----

const EDITAIS_ADMIN_QUERY = `
  query EditaisAdmin($filtro: EditalFiltro, $pagina: Int, $porPagina: Int) {
    editais(filtro: $filtro, pagina: $pagina, porPagina: $porPagina) {
      dados {
        id nome sigla esfera tipo totalCargos totalDisciplinas totalTopicos
      }
      paginacao { total pagina porPagina totalPaginas }
    }
  }
`

// For admin, we need ativo field — extend the edital query
const EDITAL_FULL_QUERY = `
  query EditalFull($id: Int!) {
    edital(id: $id) {
      id nome sigla esfera tipo descricao dataPublicacao dataEncerramento
      dataInicioInscricao dataFimInscricao link cidade previsto cancelado
      autorizado ativo destaque totalCargos totalDisciplinas totalTopicos
      cargos { id nome vagas remuneracao qtdDisciplinas qtdTopicos ativo dataProva }
    }
  }
`

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id nome nomeEdital totalTopicos }
  }
`

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id nome ordem }
  }
`

const ADMIN_LOG_QUERY = `
  query AdminLog($targetType: String!, $targetId: Int!) {
    adminLog(targetType: $targetType, targetId: $targetId) {
      id actorId targetType targetId action details criadoEm
    }
  }
`

// ---- Mutations ----

const CRIAR_EDITAL = `mutation CriarEdital($input: EditalInput!) { criarEdital(input: $input) { success message id } }`
const ATUALIZAR_EDITAL = `mutation AtualizarEdital($id: Int!, $input: EditalInput!) { atualizarEdital(id: $id, input: $input) { success message id } }`
const DELETAR_EDITAL = `mutation DeletarEdital($id: Int!) { deletarEdital(id: $id) { success message } }`

const CRIAR_CARGO = `mutation CriarCargo($editalId: Int!, $input: CargoInput!) { criarCargo(editalId: $editalId, input: $input) { success message id } }`
const ATUALIZAR_CARGO = `mutation AtualizarCargo($id: Int!, $input: CargoInput!) { atualizarCargo(id: $id, input: $input) { success message id } }`
const DELETAR_CARGO = `mutation DeletarCargo($id: Int!) { deletarCargo(id: $id) { success message } }`

const CRIAR_DISCIPLINA = `mutation CriarDisciplina($cargoId: Int!, $input: DisciplinaInput!) { criarDisciplina(cargoId: $cargoId, input: $input) { success message id } }`
const ATUALIZAR_DISCIPLINA = `mutation AtualizarDisciplina($id: Int!, $input: DisciplinaInput!) { atualizarDisciplina(id: $id, input: $input) { success message id } }`
const DELETAR_DISCIPLINA = `mutation DeletarDisciplina($id: Int!) { deletarDisciplina(id: $id) { success message } }`

const CRIAR_TOPICO = `mutation CriarTopico($disciplinaId: Int!, $input: TopicoInput!) { criarTopico(disciplinaId: $disciplinaId, input: $input) { success message id } }`
const ATUALIZAR_TOPICO = `mutation AtualizarTopico($id: Int!, $input: TopicoInput!) { atualizarTopico(id: $id, input: $input) { success message id } }`
const DELETAR_TOPICO = `mutation DeletarTopico($id: Int!) { deletarTopico(id: $id) { success message } }`
const REORDENAR_TOPICOS = `mutation ReordenarTopicos($disciplinaId: Int!, $topicoIds: [Int!]!) { reordenarTopicos(disciplinaId: $disciplinaId, topicoIds: $topicoIds) { success message } }`

const BULK_ATIVAR = `mutation BulkAtivar($tipo: String!, $ids: [Int!]!, $ativo: Boolean!) { bulkAtivar(tipo: $tipo, ids: $ids, ativo: $ativo) { success affected } }`
const BULK_DELETAR = `mutation BulkDeletar($tipo: String!, $ids: [Int!]!) { bulkDeletar(tipo: $tipo, ids: $ids) { success affected } }`

// ---- Hook ----

export function useEditaisAdmin() {
  const [refreshKey, setRefreshKey] = useState(0)
  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  // --- Fetch lists ---

  async function fetchEditais(filtro?: Record<string, unknown>, pagina = 1, porPagina = 20) {
    const result = await editaisQuery<any>(EDITAIS_ADMIN_QUERY, { filtro, pagina, porPagina })
    return result.data?.editais ?? { dados: [], paginacao: null }
  }

  async function fetchEditalFull(id: number) {
    const result = await editaisQuery<any>(EDITAL_FULL_QUERY, { id })
    return result.data?.edital ?? null
  }

  async function fetchCargos(editalId: number): Promise<AdminCargo[]> {
    const result = await editaisQuery<any>(EDITAL_FULL_QUERY, { id: editalId })
    return result.data?.edital?.cargos ?? []
  }

  async function fetchDisciplinas(cargoId: number): Promise<AdminDisciplina[]> {
    const result = await editaisQuery<any>(DISCIPLINAS_QUERY, { cargoId })
    return result.data?.disciplinas ?? []
  }

  async function fetchTopicos(disciplinaId: number): Promise<AdminTopico[]> {
    const result = await editaisQuery<any>(TOPICOS_QUERY, { disciplinaId })
    return result.data?.topicos ?? []
  }

  async function fetchAdminLog(targetType: string, targetId: number): Promise<AdminLogEntry[]> {
    const result = await editaisQuery<any>(ADMIN_LOG_QUERY, { targetType, targetId })
    return result.data?.adminLog ?? []
  }

  // --- Mutations ---

  async function criarEdital(input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_EDITAL, { input })
    if (result.data?.criarEdital) { refetch(); return result.data.criarEdital }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarEdital(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_EDITAL, { id, input })
    if (result.data?.atualizarEdital) { refetch(); return result.data.atualizarEdital }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarEdital(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_EDITAL, { id })
    if (result.data?.deletarEdital) { refetch(); return result.data.deletarEdital }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function criarCargo(editalId: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_CARGO, { editalId, input })
    if (result.data?.criarCargo) { refetch(); return result.data.criarCargo }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarCargo(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_CARGO, { id, input })
    if (result.data?.atualizarCargo) { refetch(); return result.data.atualizarCargo }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarCargo(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_CARGO, { id })
    if (result.data?.deletarCargo) { refetch(); return result.data.deletarCargo }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function criarDisciplina(cargoId: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_DISCIPLINA, { cargoId, input })
    if (result.data?.criarDisciplina) { refetch(); return result.data.criarDisciplina }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarDisciplina(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_DISCIPLINA, { id, input })
    if (result.data?.atualizarDisciplina) { refetch(); return result.data.atualizarDisciplina }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarDisciplina(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_DISCIPLINA, { id })
    if (result.data?.deletarDisciplina) { refetch(); return result.data.deletarDisciplina }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function criarTopico(disciplinaId: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(CRIAR_TOPICO, { disciplinaId, input })
    if (result.data?.criarTopico) { refetch(); return result.data.criarTopico }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function atualizarTopico(id: number, input: Record<string, unknown>): Promise<MutationResult> {
    const result = await editaisMutation<any>(ATUALIZAR_TOPICO, { id, input })
    if (result.data?.atualizarTopico) { refetch(); return result.data.atualizarTopico }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function deletarTopico(id: number): Promise<MutationResult> {
    const result = await editaisMutation<any>(DELETAR_TOPICO, { id })
    if (result.data?.deletarTopico) { refetch(); return result.data.deletarTopico }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function reordenarTopicos(disciplinaId: number, topicoIds: number[]): Promise<MutationResult> {
    const result = await editaisMutation<any>(REORDENAR_TOPICOS, { disciplinaId, topicoIds })
    if (result.data?.reordenarTopicos) { refetch(); return result.data.reordenarTopicos }
    return { success: false, message: result.error ?? 'Erro desconhecido', id: null }
  }

  async function bulkAtivar(tipo: string, ids: number[], ativo: boolean): Promise<BulkResult> {
    const result = await editaisMutation<any>(BULK_ATIVAR, { tipo, ids, ativo })
    if (result.data?.bulkAtivar) { refetch(); return result.data.bulkAtivar }
    return { success: false, affected: 0 }
  }

  async function bulkDeletar(tipo: string, ids: number[]): Promise<BulkResult> {
    const result = await editaisMutation<any>(BULK_DELETAR, { tipo, ids })
    if (result.data?.bulkDeletar) { refetch(); return result.data.bulkDeletar }
    return { success: false, affected: 0 }
  }

  return {
    refreshKey,
    refetch,

    // Queries
    fetchEditais,
    fetchEditalFull,
    fetchCargos,
    fetchDisciplinas,
    fetchTopicos,
    fetchAdminLog,

    // Mutations
    criarEdital, atualizarEdital, deletarEdital,
    criarCargo, atualizarCargo, deletarCargo,
    criarDisciplina, atualizarDisciplina, deletarDisciplina,
    criarTopico, atualizarTopico, deletarTopico,
    reordenarTopicos,
    bulkAtivar, bulkDeletar,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/moderation/useEditaisAdmin.ts
git commit -m "feat(editais-admin): add useEditaisAdmin hook with all queries and mutations"
```

---

### Task 3: Create column definitions

**Files:**
- Create: `src/components/moderation/editais/columns.tsx`

- [ ] **Step 1: Create column definitions for each hierarchy level**

These define what the ModerationDataTable shows at each level. Separated from the page component for readability.

```typescript
// src/components/moderation/editais/columns.tsx
import type { Column } from '@/components/moderation/shared/ModerationDataTable'
import type { AdminEdital, AdminCargo, AdminDisciplina, AdminTopico } from '@/hooks/moderation/useEditaisAdmin'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

function ActiveBadge({ ativo, parentInactive }: { ativo: boolean; parentInactive?: boolean }) {
  if (parentInactive) {
    return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Pai inativo</span>
  }
  return (
    <span className={cn(
      "rounded px-1.5 py-0.5 text-[10px] font-medium",
      ativo ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
    )}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

export function getEditalColumns(
  selectedIds: Set<number>,
  onToggleSelect: (id: number) => void,
  onToggleAll: () => void,
  allSelected: boolean,
): Column<AdminEdital>[] {
  return [
    {
      key: 'checkbox',
      label: '',
      width: '36px',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelect(row.id)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    { key: 'sigla', label: 'Sigla', width: '80px', render: (row) => <span className="font-semibold text-zinc-900">{row.sigla ?? '—'}</span> },
    { key: 'nome', label: 'Nome', width: '1fr', render: (row) => <span className="text-zinc-700">{row.nome}</span> },
    { key: 'esfera', label: 'Esfera', width: '90px', render: (row) => <span className="text-zinc-500 capitalize">{row.esfera ?? '—'}</span> },
    { key: 'tipo', label: 'Tipo', width: '80px', render: (row) => <span className="text-zinc-500">{row.tipo ?? '—'}</span> },
    { key: 'cargos', label: 'Cargos', width: '60px', render: (row) => <span className="tabular-nums text-zinc-600">{row.totalCargos}</span> },
    { key: 'disc', label: 'Disc', width: '60px', render: (row) => <span className="tabular-nums text-zinc-600">{row.totalDisciplinas}</span> },
    { key: 'topicos', label: 'Tóp', width: '60px', render: (row) => <span className="tabular-nums text-zinc-600">{row.totalTopicos}</span> },
    { key: 'ativo', label: 'Status', width: '70px', render: (row) => <ActiveBadge ativo={row.ativo} /> },
  ]
}

export function getCargoColumns(
  selectedIds: Set<number>,
  onToggleSelect: (id: number) => void,
  parentInactive: boolean,
): Column<AdminCargo>[] {
  return [
    {
      key: 'checkbox', label: '', width: '36px',
      render: (row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelect(row.id)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'nome', label: 'Nome', width: '1fr', render: (row) => <span className="text-zinc-700">{row.nome}</span> },
    { key: 'vagas', label: 'Vagas', width: '60px', render: (row) => <span className="tabular-nums text-zinc-600">{row.vagas ?? 0}</span> },
    { key: 'remuneracao', label: 'Remuneração', width: '100px', render: (row) => <span className="tabular-nums text-zinc-600">{row.remuneracao ? `R$ ${row.remuneracao.toLocaleString('pt-BR')}` : '—'}</span> },
    { key: 'disc', label: 'Disc', width: '60px', render: (row) => <span className="tabular-nums text-zinc-600">{row.qtdDisciplinas ?? 0}</span> },
    { key: 'topicos', label: 'Tóp', width: '60px', render: (row) => <span className="tabular-nums text-zinc-600">{row.qtdTopicos ?? 0}</span> },
    { key: 'ativo', label: 'Status', width: '90px', render: (row) => <ActiveBadge ativo={row.ativo} parentInactive={parentInactive} /> },
  ]
}

export function getDisciplinaColumns(
  selectedIds: Set<number>,
  onToggleSelect: (id: number) => void,
  parentInactive: boolean,
): Column<AdminDisciplina>[] {
  return [
    {
      key: 'checkbox', label: '', width: '36px',
      render: (row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelect(row.id)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'nome', label: 'Nome', width: '1fr', render: (row) => <span className="text-zinc-700">{row.nome}</span> },
    { key: 'nomeEdital', label: 'Nome Edital', width: '1fr', render: (row) => <span className="text-zinc-500">{row.nomeEdital ?? '—'}</span> },
    { key: 'topicos', label: 'Tópicos', width: '70px', render: (row) => <span className="tabular-nums text-zinc-600">{row.totalTopicos}</span> },
    { key: 'ativo', label: 'Status', width: '90px', render: (row) => <ActiveBadge ativo={row.ativo} parentInactive={parentInactive} /> },
  ]
}

export function getTopicoColumns(
  selectedIds: Set<number>,
  onToggleSelect: (id: number) => void,
  parentInactive: boolean,
  onMoveUp: (id: number) => void,
  onMoveDown: (id: number) => void,
  isFirst: (id: number) => boolean,
  isLast: (id: number) => boolean,
): Column<AdminTopico>[] {
  return [
    {
      key: 'checkbox', label: '', width: '36px',
      render: (row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelect(row.id)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'ordem', label: '#', width: '45px', render: (row) => <span className="tabular-nums text-zinc-500">{row.ordem}</span> },
    { key: 'nome', label: 'Nome', width: '1fr', render: (row) => <span className="text-zinc-700">{row.nome}</span> },
    { key: 'ativo', label: 'Status', width: '90px', render: (row) => <ActiveBadge ativo={row.ativo} parentInactive={parentInactive} /> },
    {
      key: 'reorder', label: '', width: '60px',
      render: (row) => (
        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onMoveUp(row.id)} disabled={isFirst(row.id)}
            className="rounded p-0.5 text-zinc-400 hover:text-violet-600 disabled:opacity-20 disabled:cursor-default">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onMoveDown(row.id)} disabled={isLast(row.id)}
            className="rounded p-0.5 text-zinc-400 hover:text-violet-600 disabled:opacity-20 disabled:cursor-default">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/editais/columns.tsx
git commit -m "feat(editais-admin): add column definitions for all hierarchy levels"
```

---

### Task 4: Create EditaisBulkBar

**Files:**
- Create: `src/components/moderation/editais/EditaisBulkBar.tsx`

- [ ] **Step 1: Create the bulk actions bar**

```typescript
// src/components/moderation/editais/EditaisBulkBar.tsx
'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Trash2, Loader2 } from 'lucide-react'

interface EditaisBulkBarProps {
  count: number
  onActivate: () => Promise<void>
  onDeactivate: () => Promise<void>
  onDelete: () => Promise<void>
  onClear: () => void
}

export function EditaisBulkBar({ count, onActivate, onDeactivate, onDelete, onClear }: EditaisBulkBarProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handle = async (action: string, fn: () => Promise<void>) => {
    setLoading(action)
    try { await fn() } finally { setLoading(null); setConfirmDelete(false) }
  }

  if (count === 0) return null

  return (
    <div className="flex items-center gap-3 rounded-lg bg-violet-50 px-4 py-2.5 mb-3">
      <span className="text-[13px] font-medium text-violet-700">
        {count} {count === 1 ? 'selecionado' : 'selecionados'}
      </span>

      <div className="flex gap-1.5 ml-auto">
        <button onClick={() => handle('activate', onActivate)} disabled={!!loading}
          className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[12px] font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-50">
          {loading === 'activate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Ativar
        </button>

        <button onClick={() => handle('deactivate', onDeactivate)} disabled={!!loading}
          className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:opacity-50">
          {loading === 'deactivate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Inativar
        </button>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} disabled={!!loading}
            className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        ) : (
          <button onClick={() => handle('delete', onDelete)} disabled={!!loading}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50">
            {loading === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Confirmar exclusao
          </button>
        )}

        <button onClick={() => { onClear(); setConfirmDelete(false) }}
          className="ml-1 text-[12px] text-violet-500 hover:text-violet-700">
          Limpar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/editais/EditaisBulkBar.tsx
git commit -m "feat(editais-admin): add bulk actions bar component"
```

---

### Task 5: Create EditaisDrawer

**Files:**
- Create: `src/components/moderation/editais/EditaisDrawer.tsx`

- [ ] **Step 1: Create the drawer component**

This drawer handles edit and create for all 4 levels. It detects the level from props, shows the right fields, and calls the right mutation. Includes audit log timeline and delete with double confirmation.

This file is large (~300 lines). Key sections:
- Form fields per level (edital has 15+ fields, topico has 2)
- Toggle ativo/inativo switch
- "Gerenciar [filhos]" button (except topicos)
- Timeline section showing admin_log
- Footer: Salvar | Cancelar | Excluir permanentemente
- Delete confirmation: first click shows "Confirmar?", second click asks to type item name

```typescript
// src/components/moderation/editais/EditaisDrawer.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Trash2, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HierarchyLevel, AdminLogEntry } from '@/hooks/moderation/useEditaisAdmin'
import { toast } from 'sonner'

interface DrawerProps {
  open: boolean
  onClose: () => void
  mode: 'edit' | 'create'
  level: HierarchyLevel
  item?: Record<string, any> | null
  parentInactive?: boolean
  parentId?: number
  onSave: (data: Record<string, unknown>) => Promise<{ success: boolean; message: string | null }>
  onDelete?: (id: number) => Promise<{ success: boolean; message: string | null }>
  onManageChildren?: () => void
  childLabel?: string
  logEntries?: AdminLogEntry[]
}

const levelLabels: Record<HierarchyLevel, string> = {
  editais: 'Edital', cargos: 'Cargo', disciplinas: 'Disciplina', topicos: 'Tópico',
}

export function EditaisDrawer({
  open, onClose, mode, level, item, parentInactive, parentId,
  onSave, onDelete, onManageChildren, childLabel, logEntries,
}: DrawerProps) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const label = levelLabels[level]

  useEffect(() => {
    if (mode === 'edit' && item) {
      setForm({ ...item })
    } else {
      setForm({ ativo: true })
    }
    setDeleteStep(0)
    setDeleteConfirmText('')
  }, [mode, item, open])

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await onSave(form)
      if (result.success) {
        toast.success(result.message ?? `${label} salvo`)
        onClose()
      } else {
        toast.error(result.message ?? 'Erro ao salvar')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item?.id || !onDelete) return
    if (deleteStep === 0) { setDeleteStep(1); return }
    if (deleteStep === 1) { setDeleteStep(2); return }
    if (deleteStep === 2 && deleteConfirmText !== item.nome) {
      toast.error('Digite o nome exato para confirmar')
      return
    }
    setDeleting(true)
    try {
      const result = await onDelete(item.id)
      if (result.success) {
        toast.success(result.message ?? `${label} excluido`)
        onClose()
      } else {
        toast.error(result.message ?? 'Erro ao excluir')
      }
    } finally {
      setDeleting(false)
      setDeleteStep(0)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[440px] bg-white shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[15px] font-bold text-zinc-900">
            {mode === 'create' ? `Novo ${label}` : `Editar ${label}`}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {parentInactive && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 font-medium">
              Pai inativo — este item nao aparece no frontend publico.
            </div>
          )}

          {/* --- Fields per level --- */}
          <Field label="Nome *" value={form.nome ?? ''} onChange={v => set('nome', v)} />

          {level === 'editais' && <>
            <Field label="Sigla" value={form.sigla ?? ''} onChange={v => set('sigla', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Esfera" value={form.esfera ?? ''} onChange={v => set('esfera', v)} />
              <Field label="Tipo" value={form.tipo ?? ''} onChange={v => set('tipo', v)} />
            </div>
            <Field label="Descricao" value={form.descricao ?? ''} onChange={v => set('descricao', v)} multiline />
            <Field label="Link" value={form.link ?? ''} onChange={v => set('link', v)} />
            <Field label="Cidade" value={form.cidade ?? ''} onChange={v => set('cidade', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data Publicacao" value={form.dataPublicacao ?? ''} onChange={v => set('dataPublicacao', v)} type="date" />
              <Field label="Data Encerramento" value={form.dataEncerramento ?? ''} onChange={v => set('dataEncerramento', v)} type="date" />
            </div>
          </>}

          {level === 'cargos' && <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vagas" value={String(form.vagas ?? 0)} onChange={v => set('vagas', Number(v))} type="number" />
              <Field label="Remuneracao" value={String(form.remuneracao ?? 0)} onChange={v => set('remuneracao', Number(v))} type="number" />
            </div>
            <Field label="Data da Prova" value={form.dataProva ?? ''} onChange={v => set('dataProva', v)} type="date" />
          </>}

          {level === 'disciplinas' && <>
            <Field label="Nome no Edital" value={form.nomeEdital ?? ''} onChange={v => set('nomeEdital', v)} />
          </>}

          {level === 'topicos' && <>
            <Field label="Ordem" value={String(form.ordem ?? 0)} onChange={v => set('ordem', Number(v))} type="number" />
          </>}

          {/* Ativo toggle */}
          <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
            <span className="text-[13px] font-medium text-zinc-700">Ativo</span>
            <button
              onClick={() => set('ativo', !form.ativo)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                form.ativo ? "bg-violet-600" : "bg-zinc-300"
              )}
            >
              <div className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                form.ativo ? "translate-x-[22px]" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Manage children button */}
          {mode === 'edit' && onManageChildren && childLabel && (
            <button onClick={onManageChildren}
              className="flex w-full items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] font-medium text-violet-700 hover:bg-violet-100 transition-colors">
              Gerenciar {childLabel}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Audit log */}
          {mode === 'edit' && logEntries && logEntries.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Historico</h3>
              <div className="space-y-2">
                {logEntries.slice(0, 10).map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-[11px]">
                    <Clock className="h-3 w-3 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-zinc-700">{entry.action}</span>
                      <span className="text-zinc-400 ml-1.5">{new Date(entry.criadoEm).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-6 py-4 flex items-center gap-2">
          {mode === 'edit' && onDelete && (
            <div className="mr-auto">
              {deleteStep === 0 && (
                <button onClick={handleDelete} className="text-[12px] text-red-500 hover:text-red-700">
                  Excluir permanentemente
                </button>
              )}
              {deleteStep === 1 && (
                <button onClick={handleDelete} className="text-[12px] font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                  Tem certeza? Clique novamente
                </button>
              )}
              {deleteStep === 2 && (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder={`Digite "${item?.nome}" para confirmar`}
                    className="text-[12px] border border-red-200 rounded px-2 py-1 w-48 outline-none focus:border-red-400"
                  />
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-[12px] font-medium text-white bg-red-600 px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50">
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Excluir'}
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.nome}
            className="rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Simple field component ---
function Field({ label, value, onChange, type = 'text', multiline }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-zinc-500 mb-1 block">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-violet-400 resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-violet-400" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/editais/EditaisDrawer.tsx
git commit -m "feat(editais-admin): add EditaisDrawer with edit/create, audit log, delete confirmation"
```

---

### Task 6: Create EditaisModerationPage (main page)

**Files:**
- Create: `src/components/moderation/editais/EditaisModerationPage.tsx`

- [ ] **Step 1: Create the main page**

This is the orchestrator. It manages:
- Level state machine (editais → cargos → disciplinas → topicos)
- Breadcrumb with counters
- Fetching data for current level
- Selected items for bulk actions
- Drawer open/close state
- Search and filter state

```typescript
// src/components/moderation/editais/EditaisModerationPage.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, Plus, Search, ClipboardList } from 'lucide-react'
import { ModerationDataTable } from '@/components/moderation/shared/ModerationDataTable'
import { EditaisDrawer } from './EditaisDrawer'
import { EditaisBulkBar } from './EditaisBulkBar'
import { getEditalColumns, getCargoColumns, getDisciplinaColumns, getTopicoColumns } from './columns'
import { useEditaisAdmin, type HierarchyLevel, type BreadcrumbItem } from '@/hooks/moderation/useEditaisAdmin'
import { useUserRole } from '@/hooks/moderation/useUserRole'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LEVEL_CHILD_LABEL: Record<HierarchyLevel, string | null> = {
  editais: 'Cargos', cargos: 'Disciplinas', disciplinas: 'Tópicos', topicos: null,
}
const LEVEL_SINGULAR: Record<HierarchyLevel, string> = {
  editais: 'edital', cargos: 'cargo', disciplinas: 'disciplina', topicos: 'topico',
}

export function EditaisModerationPage() {
  const { isAdmin } = useUserRole()
  const admin = useEditaisAdmin()

  // Navigation state
  const [level, setLevel] = useState<HierarchyLevel>('editais')
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [parentId, setParentId] = useState<number | null>(null)
  const [parentInactive, setParentInactive] = useState(false)

  // Data state
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'edit' | 'create'>('edit')
  const [drawerItem, setDrawerItem] = useState<Record<string, any> | null>(null)
  const [logEntries, setLogEntries] = useState<any[]>([])

  // Filters (level 1 only)
  const [esferaFilter, setEsferaFilter] = useState<string>('')
  const [tipoFilter, setTipoFilter] = useState<string>('')
  const [ativoFilter, setAtivoFilter] = useState<string>('')

  // Fetch data for current level
  const fetchData = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())
    try {
      if (level === 'editais') {
        const filtro: Record<string, unknown> = {}
        if (esferaFilter) filtro.esfera = esferaFilter
        if (tipoFilter) filtro.tipo = tipoFilter
        if (ativoFilter === 'ativo') filtro.ativo = true
        if (ativoFilter === 'inativo') filtro.ativo = false
        if (search) filtro.busca = search
        const result = await admin.fetchEditais(filtro, 1, 100)
        setData(result.dados ?? [])
      } else if (level === 'cargos' && parentId) {
        const cargos = await admin.fetchCargos(parentId)
        setData(cargos)
      } else if (level === 'disciplinas' && parentId) {
        const disc = await admin.fetchDisciplinas(parentId)
        setData(disc)
      } else if (level === 'topicos' && parentId) {
        const tops = await admin.fetchTopicos(parentId)
        setData(tops)
      }
    } catch (err) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [level, parentId, esferaFilter, tipoFilter, ativoFilter, search, admin.refreshKey])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter data by search (client-side for sub-levels)
  const filteredData = search && level !== 'editais'
    ? data.filter((item: any) => item.nome?.toLowerCase().includes(search.toLowerCase()))
    : data

  // Navigate to child level
  const drillDown = (item: any, nextLevel: HierarchyLevel) => {
    const count = nextLevel === 'cargos' ? item.totalCargos ?? data.length
      : nextLevel === 'disciplinas' ? item.qtdDisciplinas ?? data.length
      : nextLevel === 'topicos' ? item.totalTopicos ?? data.length : 0
    setBreadcrumb(prev => [...prev, { id: item.id, nome: `${item.sigla ?? item.nome} (${count})`, tipo: level }])
    setParentId(item.id)
    setParentInactive(parentInactive || item.ativo === false)
    setLevel(nextLevel)
    setSearch('')
    setDrawerOpen(false)
  }

  // Navigate back via breadcrumb
  const navigateTo = (index: number) => {
    if (index < 0) {
      setLevel('editais')
      setBreadcrumb([])
      setParentId(null)
      setParentInactive(false)
    } else {
      const target = breadcrumb[index]
      const levels: HierarchyLevel[] = ['editais', 'cargos', 'disciplinas', 'topicos']
      const targetLevelIdx = levels.indexOf(target.tipo)
      setLevel(levels[targetLevelIdx + 1])
      setBreadcrumb(breadcrumb.slice(0, index + 1))
      setParentId(target.id)
      // Recalculate parentInactive
      setParentInactive(false) // simplified — will refetch
    }
    setSearch('')
    setDrawerOpen(false)
  }

  // Open drawer
  const openEdit = async (item: any) => {
    setDrawerItem(item)
    setDrawerMode('edit')
    setDrawerOpen(true)
    // Fetch log
    const log = await admin.fetchAdminLog(LEVEL_SINGULAR[level], item.id)
    setLogEntries(log)
  }

  const openCreate = () => {
    setDrawerItem(null)
    setDrawerMode('create')
    setDrawerOpen(true)
    setLogEntries([])
  }

  // Save handler
  const handleSave = async (formData: Record<string, unknown>) => {
    const tipo = LEVEL_SINGULAR[level]
    if (drawerMode === 'create') {
      if (level === 'editais') return admin.criarEdital(formData)
      if (level === 'cargos' && parentId) return admin.criarCargo(parentId, formData)
      if (level === 'disciplinas' && parentId) return admin.criarDisciplina(parentId, formData)
      if (level === 'topicos' && parentId) return admin.criarTopico(parentId, formData)
    } else {
      const id = drawerItem?.id
      if (!id) return { success: false, message: 'ID nao encontrado' }
      if (level === 'editais') return admin.atualizarEdital(id, formData)
      if (level === 'cargos') return admin.atualizarCargo(id, formData)
      if (level === 'disciplinas') return admin.atualizarDisciplina(id, formData)
      if (level === 'topicos') return admin.atualizarTopico(id, formData)
    }
    return { success: false, message: 'Nivel desconhecido', id: null }
  }

  // Delete handler
  const handleDelete = async (id: number) => {
    if (level === 'editais') return admin.deletarEdital(id)
    if (level === 'cargos') return admin.deletarCargo(id)
    if (level === 'disciplinas') return admin.deletarDisciplina(id)
    if (level === 'topicos') return admin.deletarTopico(id)
    return { success: false, message: 'Nivel desconhecido', id: null }
  }

  // Manage children from drawer
  const handleManageChildren = () => {
    if (!drawerItem) return
    const childLevel: Record<string, HierarchyLevel> = { editais: 'cargos', cargos: 'disciplinas', disciplinas: 'topicos' }
    const next = childLevel[level]
    if (next) drillDown(drawerItem, next)
  }

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredData.map((d: any) => d.id)))
    }
  }

  // Bulk handlers
  const bulkActivate = async () => {
    await admin.bulkAtivar(LEVEL_SINGULAR[level], [...selectedIds], true)
    toast.success(`${selectedIds.size} itens ativados`)
    setSelectedIds(new Set())
  }
  const bulkDeactivate = async () => {
    await admin.bulkAtivar(LEVEL_SINGULAR[level], [...selectedIds], false)
    toast.success(`${selectedIds.size} itens inativados`)
    setSelectedIds(new Set())
  }
  const bulkDelete = async () => {
    await admin.bulkDeletar(LEVEL_SINGULAR[level], [...selectedIds])
    toast.success(`${selectedIds.size} itens excluidos`)
    setSelectedIds(new Set())
  }

  // Topico reorder
  const moveTopico = async (topicoId: number, direction: 'up' | 'down') => {
    const idx = data.findIndex((t: any) => t.id === topicoId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= data.length) return
    const newOrder = [...data]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    setData(newOrder)
    if (parentId) {
      await admin.reordenarTopicos(parentId, newOrder.map((t: any) => t.id))
    }
  }

  // Build columns for current level
  const columns = level === 'editais'
    ? getEditalColumns(selectedIds, toggleSelect, toggleAll, selectedIds.size === filteredData.length)
    : level === 'cargos'
    ? getCargoColumns(selectedIds, toggleSelect, parentInactive)
    : level === 'disciplinas'
    ? getDisciplinaColumns(selectedIds, toggleSelect, parentInactive)
    : getTopicoColumns(
        selectedIds, toggleSelect, parentInactive,
        (id) => moveTopico(id, 'up'), (id) => moveTopico(id, 'down'),
        (id) => filteredData[0]?.id === id, (id) => filteredData[filteredData.length - 1]?.id === id,
      )

  return (
    <>
      {/* Header */}
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">Editais</h1>
            <p className="text-[13px] text-zinc-400">Gerencie editais, cargos, disciplinas e topicos.</p>
          </div>
          {isAdmin && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700">
              <Plus className="h-4 w-4" />
              Novo {level === 'editais' ? 'Edital' : level === 'cargos' ? 'Cargo' : level === 'disciplinas' ? 'Disciplina' : 'Topico'}
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 mt-3 text-[13px]">
            <button onClick={() => navigateTo(-1)} className="text-violet-600 hover:text-violet-800 font-medium">
              Editais
            </button>
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                <button onClick={() => navigateTo(i)} className={cn(
                  i === breadcrumb.length - 1 ? "text-zinc-700 font-semibold" : "text-violet-600 hover:text-violet-800 font-medium"
                )}>
                  {item.nome}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-4 text-[13px] outline-none focus:border-violet-400" />
          </div>
          {level === 'editais' && <>
            <select value={esferaFilter} onChange={e => setEsferaFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-600 outline-none">
              <option value="">Esfera</option>
              <option value="federal">Federal</option>
              <option value="estadual">Estadual</option>
              <option value="municipal">Municipal</option>
            </select>
            <select value={ativoFilter} onChange={e => setAtivoFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-600 outline-none">
              <option value="">Status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </>}
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {isAdmin && (
          <EditaisBulkBar
            count={selectedIds.size}
            onActivate={bulkActivate}
            onDeactivate={bulkDeactivate}
            onDelete={bulkDelete}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        <ModerationDataTable
          columns={columns as any}
          data={filteredData}
          onRowClick={isAdmin ? openEdit : undefined}
          rowKey={(row: any) => String(row.id)}
          emptyMessage="Nenhum item encontrado"
          emptyIcon={<ClipboardList className="h-10 w-10 text-zinc-300" />}
          pageSize={20}
        />
      </div>

      {/* Drawer */}
      <EditaisDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        level={level}
        item={drawerItem}
        parentInactive={parentInactive}
        parentId={parentId ?? undefined}
        onSave={handleSave}
        onDelete={isAdmin ? handleDelete : undefined}
        onManageChildren={LEVEL_CHILD_LABEL[level] ? handleManageChildren : undefined}
        childLabel={LEVEL_CHILD_LABEL[level] ?? undefined}
        logEntries={logEntries}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/editais/EditaisModerationPage.tsx
git commit -m "feat(editais-admin): add main EditaisModerationPage with drill-down, drawer, bulk"
```

---

### Task 7: Wire up route and sidebar

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/moderation/layout/ModerationSidebar.tsx`

- [ ] **Step 1: Add route in App.tsx**

Import at top:
```typescript
import { EditaisModerationPage } from './components/moderation/editais/EditaisModerationPage';
```

Add route inside the `/moderacao` block, after the `lei-seca` route:
```tsx
<Route path="editais" element={<EditaisModerationPage />} />
```

- [ ] **Step 2: Add nav item in ModerationSidebar.tsx**

Add import:
```typescript
import { ClipboardList } from 'lucide-react';
```

Add to `navItems` array, after the "Lei Seca" entry:
```typescript
{
  label: 'Editais',
  href: '/moderacao/editais',
  icon: <ClipboardList className="h-[15px] w-[15px]" />,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/moderation/layout/ModerationSidebar.tsx
git commit -m "feat(editais-admin): wire up /moderacao/editais route and sidebar nav"
```

---

### Task 8: Smoke test

- [ ] **Step 1: Verify backend is deployed with mutations (Plan 1 complete)**

```bash
curl -s "http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/health"
```

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

- [ ] **Step 3: Navigate to http://localhost:3000/moderacao/editais**

Verify:
- "Editais" appears in moderation sidebar
- Table loads with editais from API
- Search filters by name
- Esfera and Status filters work
- Click edital → drawer opens with editable fields + audit log
- "Gerenciar Cargos" button drills down to cargos table
- Breadcrumb shows with counters, clickable to navigate back
- "+ Novo" creates items
- Bulk select + activate/deactivate/delete works
- Topico level shows reorder buttons
- Delete has double confirmation (type name)
- Non-admin user sees read-only (no edit/create buttons)

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(editais-admin): smoke test fixes"
```

---

## Execution Order

**1 → 2 → 3 → 4 → 5 → 6 → 7 → 8** (sequential)

Tasks 1-4 are independent and could be parallelized by separate agents.
Task 5 (drawer) depends on types from Task 2.
Task 6 (page) depends on all previous components.
Task 7 wires everything up.
Task 8 is the final verification.
