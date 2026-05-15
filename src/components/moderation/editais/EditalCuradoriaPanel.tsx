'use client'
// src/components/moderation/editais/EditalCuradoriaPanel.tsx
// Host component for the admin curation workflow per cargo.

import { useState } from 'react'
import { toast } from 'sonner'
import { useCurarEdital } from '@/hooks/moderation/useCurarEdital'
import { useListaEditaisCurados } from '@/hooks/moderation/useListaEditaisCurados'
import { usePublishEdital } from '@/hooks/moderation/usePublishEdital'
import { useUnpublishEdital } from '@/hooks/moderation/useUnpublishEdital'
import { useUpdateDecomposicao } from '@/hooks/moderation/useUpdateDecomposicao'
import { EditalCuradoriaProgress } from './EditalCuradoriaProgress'
import { EditalCuradoriaStatusBadge } from './EditalCuradoriaStatusBadge'
import { EditalCuradoriaTree } from './EditalCuradoriaTree'
import type { EditalGraphQL, EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

interface Props {
  cargoId: number
  editalId: number
  cargoNome: string
  editalPayload: EditalGraphQL
}

export function EditalCuradoriaPanel({ cargoId, editalId, cargoNome, editalPayload }: Props) {
  const lista = useListaEditaisCurados()
  const curarMut = useCurarEdital()
  const publishMut = usePublishEdital()
  const unpublishMut = useUnpublishEdital()
  const updateMut = useUpdateDecomposicao()

  const [confirmReCurar, setConfirmReCurar] = useState(false)

  const entry = lista.data?.find(x => x.cargo_id === cargoId && x.edital_id === editalId)
  const status = entry?.status ?? 'no_cache'

  // ── Actions ──────────────────────────────────────────────────────────────────

  function handleCurar() {
    curarMut.mutate(editalPayload, {
      onSuccess: (result) => {
        toast.success(`Curadoria concluída: ${result.decomposed_topicos} tópicos decompostos`)
        lista.refetch()
      },
      onError: (err) => {
        toast.error(`Erro na curadoria: ${err.message}`)
      },
    })
  }

  function handlePublish() {
    publishMut.mutate({ cargo_id: cargoId, edital_id: editalId }, {
      onSuccess: () => toast.success('Edital publicado para o V2'),
      onError: (err) => toast.error(`Erro: ${err.message}`),
    })
  }

  function handleUnpublish() {
    unpublishMut.mutate({ cargo_id: cargoId, edital_id: editalId }, {
      onSuccess: () => toast.success('Edital arquivado'),
      onError: (err) => toast.error(`Erro: ${err.message}`),
    })
  }

  function handleReCurar() {
    setConfirmReCurar(false)
    handleCurar()
  }

  function handleTreeChange(newDecomp: EditalDecomposicao) {
    updateMut.mutate(
      { cargo_id: cargoId, edital_id: editalId, decomposicao: newDecomp },
      { onError: (err) => toast.error(`Erro ao salvar: ${err.message}`) },
    )
  }

  // ── Streaming in progress ────────────────────────────────────────────────────

  if (curarMut.isPending) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <EditalCuradoriaStatusBadge status="no_cache" />
          <span className="text-sm text-zinc-500">Executando IA…</span>
        </div>
        <EditalCuradoriaProgress progress={curarMut.progress} />
      </div>
    )
  }

  // ── No cache yet ─────────────────────────────────────────────────────────────

  if (status === 'no_cache' || lista.isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">Curadoria V2</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Este cargo ainda não tem decomposição gerada. Dispare a IA para iniciar.
            </p>
          </div>
          <EditalCuradoriaStatusBadge status="no_cache" />
        </div>
        {lista.isError && (
          <p className="mb-3 text-xs text-red-500">Erro ao carregar lista: {lista.error?.message}</p>
        )}
        <button
          onClick={handleCurar}
          disabled={lista.isLoading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Curar com IA
        </button>
      </div>
    )
  }

  // ── Has cache entry (draft / published / archived) ────────────────────────────

  const readOnly = status === 'published' || status === 'archived'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Curadoria V2</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{cargoNome}</p>
        </div>
        <EditalCuradoriaStatusBadge status={status} />
      </div>

      {/* Tree */}
      <div className="px-6 py-4">
        {entry?.decomposicao ? (
          <EditalCuradoriaTree
            decomposicao={entry.decomposicao}
            readOnly={readOnly}
            onChange={handleTreeChange}
          />
        ) : (
          <p className="text-xs text-zinc-400 italic">Sem dados de decomposição disponíveis.</p>
        )}
        {updateMut.isPending && (
          <p className="mt-2 text-xs text-emerald-600">Salvando alterações…</p>
        )}
      </div>

      {/* Actions footer */}
      <div className="flex items-center gap-2 border-t border-zinc-100 px-6 py-3">
        {/* Draft: Publicar + Re-curar */}
        {status === 'draft' && (
          <>
            <button
              onClick={handlePublish}
              disabled={publishMut.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {publishMut.isPending ? 'Publicando…' : 'Publicar'}
            </button>
            {!confirmReCurar ? (
              <button
                onClick={() => setConfirmReCurar(true)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Re-curar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700">Vai sobrescrever o draft atual. Tem certeza?</span>
                <button
                  onClick={handleReCurar}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmReCurar(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            )}
          </>
        )}

        {/* Published: Re-curar + Arquivar */}
        {status === 'published' && (
          <>
            {!confirmReCurar ? (
              <button
                onClick={() => setConfirmReCurar(true)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Re-curar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700">Vai gerar um novo draft (atual permanece publicado até novo Publicar). Tem certeza?</span>
                <button
                  onClick={handleReCurar}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmReCurar(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            )}
            <button
              onClick={handleUnpublish}
              disabled={unpublishMut.isPending}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              {unpublishMut.isPending ? 'Arquivando…' : 'Arquivar'}
            </button>
          </>
        )}

        {/* Archived: Republicar */}
        {status === 'archived' && (
          <button
            onClick={handlePublish}
            disabled={publishMut.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {publishMut.isPending ? 'Republicando…' : 'Republicar'}
          </button>
        )}
      </div>

      {/* Confirm re-curar dialog (if both re-curar confirmations are shown above, this is n/a) */}
    </div>
  )
}
