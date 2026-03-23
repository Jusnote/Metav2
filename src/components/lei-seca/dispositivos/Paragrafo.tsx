import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Paragrafo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-1.5 pl-7" data-posicao={item.posicao}>
      <span className="text-zinc-900">{item.texto}</span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-7 mt-1 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
