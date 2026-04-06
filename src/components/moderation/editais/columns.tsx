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
