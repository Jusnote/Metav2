import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'
import { BoldPrefix } from '@/lib/lei-text-bold'

export function Artigo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div
      className="py-1 pl-[14px] border-l-[1.5px] border-[#ddd] mb-0.5 hover:border-[#888] transition-colors rounded-r-sm"
      data-id={item.id}
      data-posicao={item.posicao}
    >
      <div><BoldPrefix texto={item.texto} tipo={item.tipo} /></div>

      {item.pena && (
        <div className="pl-[18px] font-light italic text-[#aaa] text-[15px] mt-0.5">
          {item.pena}
        </div>
      )}

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-[18px] mt-0.5 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
