import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Inciso({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-2 pl-[52px]" data-posicao={item.posicao}>
      <span className="text-slate-700">{item.texto}</span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
