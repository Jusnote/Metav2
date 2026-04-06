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
