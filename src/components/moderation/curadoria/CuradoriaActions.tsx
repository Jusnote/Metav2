'use client'

import { Sparkles, CheckCircle, Archive, RefreshCw, AlertTriangle } from 'lucide-react'
import { useCurarEdital } from '@/hooks/moderation/useCurarEdital'
import { usePublishEdital } from '@/hooks/moderation/usePublishEdital'
import { useUnpublishEdital } from '@/hooks/moderation/useUnpublishEdital'
import type { EditalGraphQL } from '@/lib/cronograma-v2/schemas'

export function CuradoriaActions({
  cargoId, editalId, cargoNome, status, editalPayload,
}: {
  cargoId: number
  editalId: number
  cargoNome: string
  status: 'no_cache' | 'draft' | 'published' | 'archived'
  editalPayload: EditalGraphQL
}) {
  const curar = useCurarEdital()
  const publish = usePublishEdital()
  const unpublish = useUnpublishEdital()

  const handleCurar = () => {
    if (status !== 'no_cache') {
      const ok = window.confirm(
        `Re-curar "${cargoNome}" vai sobrescrever a decomposição atual (incluindo edições manuais). Tem certeza?`,
      )
      if (!ok) return
    }
    curar.mutate(editalPayload)
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      {curar.isPending ? (
        <div className="flex items-center gap-3">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
          <span className="text-sm text-slate-600">
            {curar.progress?.message ?? 'Iniciando…'}
            {curar.progress?.total ? ` (${curar.progress.done}/${curar.progress.total})` : ''}
          </span>
          {curar.progress?.total && (
            <div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.round((curar.progress.done ?? 0) / curar.progress.total * 100)}%` }} />
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleCurar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Sparkles className="h-4 w-4" />
            {status === 'no_cache' ? 'Curar com IA' : 'Re-curar com IA'}
          </button>
          {status === 'draft' && (
            <button
              type="button"
              onClick={() => publish.mutate({ cargo_id: cargoId, edital_id: editalId })}
              disabled={publish.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Publicar
            </button>
          )}
          {status === 'published' && (
            <button
              type="button"
              onClick={() => unpublish.mutate({ cargo_id: cargoId, edital_id: editalId })}
              disabled={unpublish.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              Arquivar
            </button>
          )}
        </>
      )}
      {curar.isError && (
        <div className="flex items-center gap-1.5 text-rose-600 text-sm">
          <AlertTriangle className="h-4 w-4" />
          {curar.error?.message ?? 'Erro'}
        </div>
      )}
    </div>
  )
}
