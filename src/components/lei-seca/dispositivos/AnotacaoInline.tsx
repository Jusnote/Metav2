import type { Anotacao } from '@/types/lei-api'

export function AnotacaoInline({ anotacao }: { anotacao: Anotacao }) {
  return (
    <div className="text-slate-400 italic text-[11px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
      {anotacao.texto ?? `(${anotacao.tipo})`}
    </div>
  )
}
