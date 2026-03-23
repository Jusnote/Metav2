import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'
import { BoldPrefix } from '@/lib/lei-text-bold'

export function Inciso({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-1 pl-[52px]" data-posicao={item.posicao}>
      <span className="text-zinc-900"><BoldPrefix texto={item.texto} tipo={item.tipo} /></span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-6 mt-1 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
