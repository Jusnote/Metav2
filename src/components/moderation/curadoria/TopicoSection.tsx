import { Plus } from 'lucide-react'
import { SubtopicoRow } from './SubtopicoRow'
import type { SubtopicoDecomposed, EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

export function TopicoSection({
  topicoId, topicoNome, decomp, readOnly, onChange,
}: {
  topicoId: number
  topicoNome: string
  decomp: EditalDecomposicao | null
  readOnly: boolean
  onChange: (next: EditalDecomposicao) => void
}) {
  const subtopicos: SubtopicoDecomposed[] = decomp?.by_topico[String(topicoId)]?.subtopicos ?? []

  const updateSub = (i: number, next: SubtopicoDecomposed) => {
    if (!decomp) return
    const cloned = structuredClone(decomp)
    if (!cloned.by_topico[String(topicoId)]) return
    cloned.by_topico[String(topicoId)].subtopicos[i] = next
    onChange(cloned)
  }

  const deleteSub = (i: number) => {
    if (!decomp) return
    const cloned = structuredClone(decomp)
    cloned.by_topico[String(topicoId)].subtopicos.splice(i, 1)
    onChange(cloned)
  }

  const addSub = () => {
    if (!decomp) return
    const cloned = structuredClone(decomp)
    if (!cloned.by_topico[String(topicoId)]) {
      cloned.by_topico[String(topicoId)] = {
        nome_curto: topicoNome.slice(0, 60),
        conceitos_pai: [],
        subtopicos: [],
        referencias_legais: [],
      }
    }
    cloned.by_topico[String(topicoId)].subtopicos.push({
      nome: 'Novo subtópico',
      duracao_min: 45,
      conceito_pai: topicoNome,
      origin: 'manual',
    })
    onChange(cloned)
  }

  return (
    <div className="ml-6 py-2 border-l-2 border-slate-100 pl-4">
      <div className="text-xs font-medium text-slate-600 mb-1">{topicoNome}</div>
      <div>
        {subtopicos.length === 0 && (
          <div className="text-[11px] text-slate-400 italic py-1 px-3">Sem subtópicos ainda.</div>
        )}
        {subtopicos.map((sub, i) => (
          <SubtopicoRow
            key={i}
            sub={sub}
            readOnly={readOnly}
            onChange={(next) => updateSub(i, next)}
            onDelete={() => deleteSub(i)}
          />
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={addSub}
            className="text-[11px] text-emerald-600 hover:text-emerald-700 px-3 py-1.5 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar subtópico
          </button>
        )}
      </div>
    </div>
  )
}
