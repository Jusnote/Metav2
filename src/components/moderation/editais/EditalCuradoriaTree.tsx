'use client'
// src/components/moderation/editais/EditalCuradoriaTree.tsx
// Accordion tree for editing edital decomposicao (by_topico → subtopicos).
// Debounced onChange (800ms) to avoid hammering the API on each keystroke.

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, X, Plus } from 'lucide-react'
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

interface Props {
  decomposicao: EditalDecomposicao
  readOnly?: boolean
  onChange?: (newDecomposicao: EditalDecomposicao) => void
}

export function EditalCuradoriaTree({ decomposicao, readOnly = false, onChange }: Props) {
  const [local, setLocal] = useState<EditalDecomposicao>(() => structuredClone(decomposicao))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when parent passes a new decomposicao (after re-curar / refetch)
  useEffect(() => {
    setLocal(structuredClone(decomposicao))
  }, [decomposicao])

  function emitChange(next: EditalDecomposicao) {
    if (!onChange || readOnly) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(next), 800)
  }

  function toggleTopico(topicoId: string) {
    setExpanded(prev => ({ ...prev, [topicoId]: !prev[topicoId] }))
  }

  function updateSubtopico(
    topicoId: string,
    subIdx: number,
    patch: Partial<{ nome: string; duracao_min: number }>,
  ) {
    setLocal(prev => {
      const next = structuredClone(prev)
      const sub = next.by_topico[topicoId]?.subtopicos[subIdx]
      if (!sub) return prev
      Object.assign(sub, patch)
      emitChange(next)
      return next
    })
  }

  function deleteSubtopico(topicoId: string, subIdx: number) {
    setLocal(prev => {
      const next = structuredClone(prev)
      next.by_topico[topicoId]?.subtopicos.splice(subIdx, 1)
      emitChange(next)
      return next
    })
  }

  function addSubtopico(topicoId: string) {
    setLocal(prev => {
      const next = structuredClone(prev)
      const topico = next.by_topico[topicoId]
      if (!topico) return prev
      topico.subtopicos.push({
        nome: 'Novo subtópico',
        duracao_min: 30,
        conceito_pai: topico.conceitos_pai[0] ?? 'Geral',
      })
      emitChange(next)
      return next
    })
  }

  const topicoIds = Object.keys(local.by_topico)

  if (topicoIds.length === 0) {
    return <p className="text-xs text-zinc-400 italic">Sem tópicos na decomposição.</p>
  }

  return (
    <div className="space-y-1">
      <p className="mb-2 text-xs text-zinc-400">{topicoIds.length} tópicos</p>

      {topicoIds.map(topicoId => {
        const topico = local.by_topico[topicoId]
        const isOpen = expanded[topicoId] ?? false
        const subCount = topico.subtopicos.length

        return (
          <div key={topicoId} className="rounded-lg border border-zinc-100">
            {/* Topico header */}
            <button
              type="button"
              onClick={() => toggleTopico(topicoId)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50"
            >
              {isOpen
                ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              }
              <span className="flex-1 text-sm font-medium text-zinc-800 truncate">
                {topico.nome_curto}
              </span>
              <span className="shrink-0 text-xs text-zinc-400">{subCount} sub</span>
            </button>

            {/* Subtopicos */}
            {isOpen && (
              <div className="border-t border-zinc-100 px-3 pb-3 pt-2 space-y-2">
                {topico.subtopicos.map((sub, subIdx) => (
                  <div key={subIdx} className="flex items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5">
                    {/* Nome */}
                    <input
                      type="text"
                      value={sub.nome}
                      disabled={readOnly}
                      onChange={e => updateSubtopico(topicoId, subIdx, { nome: e.target.value })}
                      className="flex-1 min-w-0 bg-transparent text-xs text-zinc-700 outline-none placeholder:text-zinc-400 disabled:text-zinc-500"
                      placeholder="Nome do subtópico"
                    />
                    {/* duracao_min */}
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="number"
                        value={sub.duracao_min}
                        disabled={readOnly}
                        min={15}
                        max={120}
                        step={5}
                        onChange={e => updateSubtopico(topicoId, subIdx, { duracao_min: Number(e.target.value) })}
                        className="w-14 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-700 outline-none focus:border-violet-400 disabled:bg-zinc-100"
                      />
                      <span className="text-xs text-zinc-400">min</span>
                    </div>
                    {/* Delete */}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => deleteSubtopico(topicoId, subIdx)}
                        className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        title="Remover subtópico"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add subtopico */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => addSubtopico(topicoId)}
                    className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-200 px-2 py-1.5 text-xs text-zinc-500 hover:border-violet-300 hover:text-violet-600 w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar subtópico
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
