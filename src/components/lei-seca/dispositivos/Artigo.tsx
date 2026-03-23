import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'
import { BoldPrefix } from '@/lib/lei-text-bold'

export function Artigo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div
      className="mb-1.5 pl-3 border-l border-zinc-300"
      data-id={item.id}
      data-posicao={item.posicao}
    >
      <div className="text-zinc-900"><BoldPrefix texto={item.texto} tipo={item.tipo} /></div>

      {item.pena && (
        <div className="pl-7 text-[#b4b4b4] text-[13px] mt-1">
          {item.pena}
        </div>
      )}

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-7 mt-1 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
