import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Inciso({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="pl-[54px] mb-[1.5px]" data-posicao={item.posicao}>
      {item.texto}
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-6 mt-0.5 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
