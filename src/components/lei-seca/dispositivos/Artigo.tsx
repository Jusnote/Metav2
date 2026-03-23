import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Artigo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div
      className="mb-5 py-3 pl-4 border-l-3 border-indigo-600 bg-indigo-50/30 rounded-r-md"
      data-id={item.id}
      data-posicao={item.posicao}
    >
      <div className="text-slate-800">{item.texto}</div>

      {item.pena && (
        <div className="text-slate-400 italic ml-6 mt-2 text-[13px]">
          {item.pena}
        </div>
      )}

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-6 mt-2 space-y-1">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
