import { cn } from '@/lib/utils'
import type { CargoCurado } from '@/hooks/moderation/useCargosCurados'

const STATUS_COLOR: Record<CargoCurado['status'], { bg: string; text: string; label: string }> = {
  no_cache:  { bg: 'bg-slate-100',    text: 'text-slate-600',    label: 'Sem cache' },
  draft:     { bg: 'bg-amber-100',    text: 'text-amber-800',    label: 'Em curadoria' },
  published: { bg: 'bg-emerald-100',  text: 'text-emerald-800',  label: 'Publicado' },
  archived:  { bg: 'bg-slate-200',    text: 'text-slate-500',    label: 'Arquivado' },
}

export function CargoListItem({
  cargo, selected, onClick,
}: {
  cargo: CargoCurado
  selected: boolean
  onClick: () => void
}) {
  const c = STATUS_COLOR[cargo.status]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-slate-100 transition',
        selected ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{cargo.cargoNome}</div>
          <div className="text-xs text-slate-500 truncate mt-0.5">{cargo.editalNome}</div>
        </div>
        <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full whitespace-nowrap', c.bg, c.text)}>
          {c.label}
        </span>
      </div>
      {cargo.topicosCount > 0 && (
        <div className="text-[10px] text-slate-400 mt-1">
          {cargo.topicosCount} tópicos curados
        </div>
      )}
    </button>
  )
}
