import { Trash2 } from 'lucide-react'
import { OriginBadge } from './OriginBadge'
import type { SubtopicoDecomposed } from '@/lib/cronograma-v2/schemas'

export function SubtopicoRow({
  sub, readOnly, onChange, onDelete,
}: {
  sub: SubtopicoDecomposed
  readOnly: boolean
  onChange: (next: SubtopicoDecomposed) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-slate-50 rounded-lg">
      <OriginBadge origin={sub.origin ?? 'ai'} />
      <input
        type="text"
        value={sub.nome}
        disabled={readOnly}
        onChange={(e) => onChange({ ...sub, nome: e.target.value })}
        className="flex-1 text-sm bg-transparent border-none focus:outline-none focus:bg-white focus:px-2 focus:rounded disabled:cursor-not-allowed"
      />
      <input
        type="number"
        value={sub.duracao_min}
        disabled={readOnly}
        min={15} max={120}
        onChange={(e) => onChange({ ...sub, duracao_min: Number(e.target.value) || 45 })}
        className="w-16 text-xs text-right bg-transparent border-none focus:outline-none focus:bg-white focus:rounded disabled:cursor-not-allowed"
      />
      <span className="text-[10px] text-slate-400">min</span>
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-300 hover:text-rose-500 transition"
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
