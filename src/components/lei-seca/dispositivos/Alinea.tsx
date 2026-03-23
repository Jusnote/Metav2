import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Alinea({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-0.5 pl-[76px] text-zinc-700" data-posicao={item.posicao}>
      <span>{item.texto}</span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="pl-6 mt-1 space-y-0.5">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
