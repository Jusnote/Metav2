import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TopicoSection } from './TopicoSection'
import type { CuradoriaTreeNode } from '@/hooks/moderation/useCuradoriaTree'
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export function DisciplinaSection({
  disciplina, decomposicao, readOnly, onChange,
}: {
  disciplina: CuradoriaTreeNode
  decomposicao: EditalDecomposicao | null
  readOnly: boolean
  onChange: (next: EditalDecomposicao) => void
}) {
  const [open, setOpen] = useState(true)
  const totalSubtopicos = disciplina.topicos.reduce((sum, t) => sum + t.subtopicos.length, 0)

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
          <h3 className="font-medium text-slate-900">{disciplina.disciplinaNome}</h3>
        </div>
        <div className="text-xs text-slate-500">
          {disciplina.topicos.length} tópicos · {totalSubtopicos} subtópicos
        </div>
      </button>
      {open && (
        <div className="pb-3">
          {disciplina.topicos.map((t) => (
            <TopicoSection
              key={t.topicoId}
              topicoId={t.topicoId}
              topicoNome={t.topicoNome}
              decomp={decomposicao}
              readOnly={readOnly}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </section>
  )
}
