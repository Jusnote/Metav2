import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'
import { BoldPrefix } from '@/lib/lei-text-bold'

export function Paragrafo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="pl-8 mb-0.5" data-posicao={item.posicao}>
      <BoldPrefix texto={item.texto} tipo={item.tipo} />
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-8 mt-0.5 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
