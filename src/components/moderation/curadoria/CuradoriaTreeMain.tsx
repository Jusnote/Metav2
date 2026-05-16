'use client'

import { useState } from 'react'
import { useCuradoriaTree } from '@/hooks/moderation/useCuradoriaTree'
import { CuradoriaActions } from './CuradoriaActions'
import { DisciplinaSection } from './DisciplinaSection'
import { useUpdateDecomposicao } from '@/hooks/moderation/useUpdateDecomposicao'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export function CuradoriaTreeMain({
  cargoId, editalId, cargoNome, editalNome,
}: {
  cargoId: number; editalId: number; cargoNome: string; editalNome: string
}) {
  const tree = useCuradoriaTree(cargoId, editalId, cargoNome, editalNome)
  const updateMut = useUpdateDecomposicao()
  const [localDecomp, setLocalDecomp] = useState<EditalDecomposicao | null>(null)
  const decomp = localDecomp ?? tree.decomposicao

  const debouncedSave = useDebouncedCallback((next: EditalDecomposicao) => {
    updateMut.mutate({ cargo_id: cargoId, edital_id: editalId, decomposicao: next })
  }, 800)

  const handleChange = (next: EditalDecomposicao) => {
    setLocalDecomp(next)
    debouncedSave(next)
  }

  if (tree.isLoading) return <div className="p-8 text-slate-500">Carregando…</div>
  if (tree.error) return <div className="p-8 text-rose-600">Erro: {tree.error.message}</div>

  return (
    <div>
      <header className="sticky top-0 bg-white border-b border-slate-200 z-10 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{cargoNome}</h1>
          <span className="text-xs text-slate-500">{editalNome}</span>
        </div>
        <CuradoriaActions
          cargoId={cargoId}
          editalId={editalId}
          cargoNome={cargoNome}
          status={tree.status}
          editalPayload={{
            cargo_id: cargoId,
            edital_id: editalId,
            cargo_nome: cargoNome,
            disciplinas: tree.tree.map((d) => ({ id: d.disciplinaId, nome: d.disciplinaNome })),
            topicos: tree.tree.flatMap((d) =>
              d.topicos.map((t) => ({ id: t.topicoId, disciplina_id: d.disciplinaId, nome: t.topicoNome })),
            ),
          }}
        />
      </header>

      <div className="px-6 py-6 space-y-4">
        {tree.tree.length === 0 && (
          <div className="text-sm text-slate-500">Nenhuma disciplina encontrada no GraphQL.</div>
        )}
        {tree.tree.map((d) => (
          <DisciplinaSection
            key={d.disciplinaId}
            disciplina={d}
            decomposicao={decomp}
            readOnly={tree.status === 'published'}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  )
}
